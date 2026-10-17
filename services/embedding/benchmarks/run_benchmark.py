"""Real CPU inference; frozen fixture; no Supabase writes or remote code."""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import statistics
import threading
import time
import unicodedata

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['MPLCONFIGDIR'] = str(Path('tmp/matplotlib').resolve())

import numpy as np
import psutil
import torch
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).resolve().parent
MODELS = {
    'small': ('intfloat/multilingual-e5-small', '614241f622f53c4eeff9890bdc4f31cfecc418b3', 384),
    'base': ('intfloat/multilingual-e5-base', 'd13f1b27baf31030b7fd040960d60d909913633f', 768),
}


def normalized(text):
    value = ''.join(c for c in unicodedata.normalize('NFD', text.lower())
                    if unicodedata.category(c) != 'Mn').replace('đ', 'd')
    return ' '.join(''.join(c if c.isalnum() else ' ' for c in value).split())


def metrics(rows):
    scored = [r for r in rows if r['target'] is not None]
    if not scored:
        return {'n': 0}
    ranks = [r['target_rank'] for r in scored]
    return {'n': len(scored), 'top1': sum(r == 1 for r in ranks)/len(ranks),
            'hit3': sum(r <= 3 for r in ranks)/len(ranks),
            'mrr': statistics.mean(1/r for r in ranks),
            'ndcg10': statistics.mean(1/np.log2(r+1) if r <= 10 else 0 for r in ranks),
            'mean_same_group_margin': statistics.mean(r['same_group_margin'] for r in scored)}


def summarize(rows):
    by = defaultdict(list)
    for row in rows:
        by[row['category']].append(row)
    return {'all_labelled': metrics(rows),
            'non_exact': metrics([r for r in rows if r['category'] != 'exact']),
            'by_category': {k: metrics(v) for k, v in by.items()},
            'by_group': {g: metrics([r for r in rows if r['target_group'] == g])
                         for g in sorted({r['target_group'] for r in rows if r['target_group']})}}


def rank_rows(scores, fixture):
    catalog = fixture['catalog']
    lookup = {p['id']: i for i, p in enumerate(catalog)}
    rows = []
    for q, vector in zip(fixture['queries'], scores):
        order = sorted(range(len(catalog)), key=lambda i: (-float(vector[i]), catalog[i]['id']))
        target_i = lookup.get(q['target'])
        wrong_same = [i for i in order if target_i is not None and
                      catalog[i]['group'] == catalog[target_i]['group'] and i != target_i]
        margin = float(vector[target_i]-vector[wrong_same[0]]) if wrong_same else None
        rows.append({**q, 'target_group': catalog[target_i]['group'] if target_i is not None else None,
                     'target_rank': order.index(target_i)+1 if target_i is not None else None,
                     'target_cosine': float(vector[target_i]) if target_i is not None else None,
                     'same_group_margin': margin,
                     'top1_top2_margin': float(vector[order[0]]-vector[order[1]]),
                     'ranking': [{'id': catalog[i]['id'], 'name': catalog[i]['name'],
                                  'group': catalog[i]['group'], 'score': float(vector[i])} for i in order]})
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', choices=MODELS, required=True)
    parser.add_argument('--model-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('docs/benchmarks/e5-varieties-2026-10-15'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    fixture_path = ROOT/'variety-fixture.json'
    fixture = json.loads(fixture_path.read_text(encoding='utf-8'))
    assert len({p['id'] for p in fixture['catalog']}) == len(fixture['catalog'])
    assert all(q['target'] is None or q['target'] in {p['id'] for p in fixture['catalog']} for q in fixture['queries'])
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    torch.manual_seed(0)
    np.random.seed(0)
    process = psutil.Process()
    peak = [process.memory_info().rss]
    stop = threading.Event()

    def monitor():
        while not stop.wait(.05):
            peak[0] = max(peak[0], process.memory_info().rss)

    thread = threading.Thread(target=monitor, daemon=True)
    thread.start()
    start = time.perf_counter()
    model = SentenceTransformer(str(args.model_dir.resolve()), device='cpu',
                                local_files_only=True, trust_remote_code=False)
    load_seconds = time.perf_counter()-start
    model.max_seq_length = 512
    names = [p['name'] for p in fixture['catalog']]
    query_texts = [q['text'] for q in fixture['queries']]

    def encode(texts, prefix):
        with torch.inference_mode():
            return model.encode([prefix+': '+t for t in texts], batch_size=8,
                                normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)

    encode(['Sầu riêng Ri6'], 'query')  # unmeasured warmup
    start = time.perf_counter()
    passage = encode(names, 'passage')
    doc_seconds = time.perf_counter()-start
    start = time.perf_counter()
    query = encode(query_texts, 'query')
    query_seconds = time.perf_counter()-start
    assert query.shape == (len(query_texts), MODELS[args.model][2])
    assert np.allclose(np.linalg.norm(query, axis=1), 1, atol=1e-5)
    scores = query@passage.T
    name_rows = rank_rows(scores, fixture)
    enriched = [p['name'] + ('. Tên gọi khác: '+', '.join(p['aliases']) if p['aliases'] else '')
                for p in fixture['catalog']]
    enriched_scores = query@encode(enriched, 'passage').T
    enriched_rows = rank_rows(enriched_scores, fixture)
    lexical = np.array([[SequenceMatcher(None, normalized(q), normalized(p)).ratio()
                         for p in names] for q in query_texts])
    lexical_rows = rank_rows(lexical, fixture)
    catalog_queries = encode(names, 'query')
    name_pair_scores = catalog_queries@passage.T
    # Warm single-query latency, excluding model load, network and database.
    latency = []
    for _ in range(2):
        for text in query_texts[::max(1, len(query_texts)//12)][:12]:
            start = time.perf_counter(); encode([text], 'query')
            latency.append((time.perf_counter()-start)*1000)
    peak[0] = max(peak[0], process.memory_info().rss)
    stop.set(); thread.join()
    result = {
        'model': args.model, 'model_id': MODELS[args.model][0], 'revision': MODELS[args.model][1],
        'dimensions': MODELS[args.model][2], 'created_at': datetime.now(timezone.utc).isoformat(),
        'fixture_sha256': hashlib.sha256(fixture_path.read_bytes()).hexdigest(),
        'products': len(names), 'queries': len(query_texts),
        'method': 'FP32 CPU; query:/passage: prefixes; normalized embeddings; cosine=dot; full exact search over all 31 names; no filters/reranker/threshold; stable ID ties.',
        'environment': {'python': platform.python_version(), 'platform': platform.platform(),
                        'cpu': platform.processor(), 'logical_cores': os.cpu_count(), 'torch_threads': 4,
                        'packages': {p: importlib.metadata.version(p) for p in ['torch','transformers','sentence-transformers','numpy','psutil']}},
        'performance': {'model_load_seconds': load_seconds, 'encode_catalog_seconds': doc_seconds,
                        'encode_queries_seconds': query_seconds, 'query_batch_size': 8,
                        'warm_single_query_p50_ms': float(np.percentile(latency, 50)),
                        'warm_single_query_p95_ms': float(np.percentile(latency, 95)),
                        'warm_latency_samples': len(latency), 'peak_process_rss_mib': peak[0]/2**20,
                        'local_model_files_mib': sum(p.stat().st_size for p in args.model_dir.rglob('*')
                                                    if p.is_file() and '.cache' not in p.parts)/2**20},
        'name_only': {'summary': summarize(name_rows), 'rows': name_rows},
        'alias_enriched': {'summary': summarize(enriched_rows), 'rows': enriched_rows},
        'character_baseline': {'method': 'Normalized Unicode/unaccented SequenceMatcher character ratio, no aliases',
                               'summary': summarize(lexical_rows)},
        'catalog_name_query_passage_cosine': name_pair_scores.tolist(),
    }
    destination = args.output/f'{args.model}.json'
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    np.savez_compressed(args.output/f'{args.model}-scores.npz', name_only=scores,
                        alias_enriched=enriched_scores, catalog_pairs=name_pair_scores)
    print(json.dumps({'model': args.model, 'name_only': result['name_only']['summary'],
                      'alias_enriched': result['alias_enriched']['summary'],
                      'performance': result['performance'], 'output': str(destination)}, ensure_ascii=True), flush=True)


if __name__ == '__main__':
    main()
