"""Package a tiny self-contained Kaggle probe. Never executes a model locally."""
import ast
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
fixture = json.loads((HERE/'variety-fixture.json').read_text(encoding='utf-8'))
selected = ['Sầu riêng Ri6', 'Sầu riêng RD6', 'Sầu riêng Dona', 'sau rieng ri6',
            'Sầu riêng Musang King', 'Cần Ri6, không mua Monthong', 'Xoài Cát Chu',
            'Xoài Cát Chu, không lấy Cát Hòa Lộc', 'Bưởi Năm Roi', 'Lúa ST25',
            'Gạo ST25, không phải ST24', 'Chuối Cavendish']
query_by_text = {q['text']: q for q in fixture['queries']}
queries = [query_by_text[text] for text in selected]
payload = {'catalog': fixture['catalog'], 'queries': queries,
           'version': 'kaggle-tiny-12-v1'}
assert len(queries) == 12
cells = []


def md(source):
    cells.append({'cell_type': 'markdown', 'metadata': {}, 'source': source.splitlines(True)})


def code(source):
    ast.parse(source)
    cells.append({'cell_type': 'code', 'execution_count': None, 'metadata': {},
                  'outputs': [], 'source': source.splitlines(True)})


md('''# LogStar — E5: 12 ca tên giống

Chạy trên Kaggle, không dùng tài nguyên inference của laptop. Hai model small/base, mỗi model một lượt, không train hoặc fine-tune.

31 tên sản phẩm làm ứng viên để giữ các giống dễ nhầm; chỉ **12 truy vấn**, trong đó 10 có nhãn, RD6 và Chuối Cavendish không chấm đúng/sai. Dữ liệu tổng hợp; chưa đại diện truy vấn người dùng. Không kết nối Supabase, không có secret.

Notebook cần **Internet** để tải model công khai. CPU Kaggle đủ cho mẫu này; GPU là tùy chọn. Các bảng cosine và top-3 xuất ra `/kaggle/working/e5-tiny-results/`.
''')
code('''import os
assert os.path.isdir('/kaggle/working'), 'Chạy notebook này trên Kaggle; không chạy inference local.'
import subprocess, sys
subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-q',
                       'sentence-transformers==5.7.0', 'transformers==5.19.0'])
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
''')
code('''import gc, json, time, platform, importlib.metadata
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import torch
from sentence_transformers import SentenceTransformer
from IPython.display import display

torch.set_num_threads(2)
torch.manual_seed(0)
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
print('Kaggle device:', DEVICE, torch.cuda.get_device_name(0) if DEVICE == 'cuda' else '')
OUT = Path('/kaggle/working/e5-tiny-results')
OUT.mkdir(exist_ok=True)
''')
code('PAYLOAD = json.loads('+repr(json.dumps(payload, ensure_ascii=False))+')\n'+'''
catalog, queries = PAYLOAD['catalog'], PAYLOAD['queries']
names = [p['name'] for p in catalog]
print(len(catalog), 'ứng viên;', len(queries), 'truy vấn; ', sum(q['target'] is not None for q in queries), 'ca có nhãn')
display(pd.DataFrame(queries)[['text','target','category']])
''')
code('''MODEL_SPECS = [
    ('small', 'intfloat/multilingual-e5-small', '614241f622f53c4eeff9890bdc4f31cfecc418b3'),
    ('base', 'intfloat/multilingual-e5-base', 'd13f1b27baf31030b7fd040960d60d909913633f'),
]
all_rows, summaries, score_rows = [], [], []
for label, model_id, revision in MODEL_SPECS:
    print('Loading', model_id, flush=True)
    started = time.perf_counter()
    model = SentenceTransformer(model_id, revision=revision, device=DEVICE, trust_remote_code=False)
    model.max_seq_length = 512
    loaded = time.perf_counter()-started
    if DEVICE == 'cuda': torch.cuda.synchronize()
    started = time.perf_counter()
    with torch.inference_mode():
        passages = model.encode(['passage: '+n for n in names], batch_size=8,
                                normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
        vectors = model.encode(['query: '+q['text'] for q in queries], batch_size=8,
                               normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
    if DEVICE == 'cuda': torch.cuda.synchronize()
    encode_seconds = time.perf_counter()-started
    cosine = vectors @ passages.T
    assert np.isfinite(cosine).all()
    hit1, hit3, reciprocal, count = 0, 0, 0., 0
    for q, scores in zip(queries, cosine):
        order = sorted(range(len(catalog)), key=lambda i: (-float(scores[i]), catalog[i]['id']))
        target_index = next((i for i,p in enumerate(catalog) if p['id']==q['target']), None)
        rank = order.index(target_index)+1 if target_index is not None else None
        if rank is not None:
            count+=1; hit1+=int(rank==1); hit3+=int(rank<=3); reciprocal+=1/rank
        top = order[:3]
        all_rows.append({'model': label, 'query': q['text'], 'category': q['category'],
                         'expected': names[target_index] if target_index is not None else 'Không gán đích',
                         'target_rank': rank, 'top1': names[top[0]], 'cosine_top1': float(scores[top[0]]),
                         'top2': names[top[1]], 'cosine_top2': float(scores[top[1]]),
                         'top3': names[top[2]], 'cosine_top3': float(scores[top[2]]),
                         'top1_top2_margin': float(scores[top[0]]-scores[top[1]])})
        for position, i in enumerate(order, 1):
            score_rows.append({'model': label, 'query': q['text'], 'target': q['target'],
                               'rank': position, 'candidate': names[i], 'cosine': float(scores[i])})
    summaries.append({'model': label, 'model_id': model_id, 'revision': revision,
                      'labelled_queries': count, 'top1_correct': hit1, 'top1_accuracy': hit1/count,
                      'hit_at_3': hit3/count, 'mrr': reciprocal/count,
                      'device': DEVICE, 'model_load_seconds': loaded, 'encode_all_seconds': encode_seconds})
    del model, passages, vectors, cosine
    gc.collect()
    if DEVICE == 'cuda': torch.cuda.empty_cache()
    print(label, 'finished', flush=True)
''')
code('''summary = pd.DataFrame(summaries)
details = pd.DataFrame(all_rows)
display(summary[['model','top1_correct','labelled_queries','top1_accuracy','hit_at_3','mrr','device','encode_all_seconds']])
display(details[['model','query','expected','top1','cosine_top1','top2','cosine_top2','target_rank']])
summary.to_csv(OUT/'summary.csv', index=False)
details.to_csv(OUT/'top3.csv', index=False, encoding='utf-8-sig')
pd.DataFrame(score_rows).to_csv(OUT/'cosine-all.csv', index=False, encoding='utf-8-sig')
result = {'created_at': datetime.now(timezone.utc).isoformat(), 'environment': {
    'python': platform.python_version(), 'torch': torch.__version__,
    'sentence_transformers': importlib.metadata.version('sentence-transformers'),
    'transformers': importlib.metadata.version('transformers'), 'device': DEVICE},
    'fixture': PAYLOAD, 'summary': summaries, 'rows': all_rows,
    'limits': '12 author-labelled probes only, 10 scored; not comparable to the larger local probe. No cosine threshold is calibrated. RD6 is unlabelled.'}
(OUT/'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print('DONE — kết quả:', str(OUT))
''')
md('''## Đọc kết quả

- So điểm đúng giống và giống sai gần nhất; cosine không phải xác suất đúng.
- Với RD6: chỉ xem các gợi ý, chưa coi RD6 là alias đã xác nhận của Ri6.
- Câu có `không lấy/không mua` cần kiểm tra riêng: embedding có thể vẫn ưu tiên giống bị phủ định.
- Mẫu nhỏ dùng để kiểm tra nhanh; không chọn ngưỡng production từ 10 ca có nhãn.
''')
notebook = {'cells': cells, 'metadata': {
    'kernelspec': {'display_name':'Python 3','language':'python','name':'python3'},
    'language_info': {'name':'python','version':'3.12.0'},
    'kaggle': {'isGpuEnabled': False, 'isInternetEnabled': True, 'language':'python',
               'sourceType':'notebook'}}, 'nbformat':4, 'nbformat_minor':5}
for i, cell in enumerate(cells): cell['id'] = f'logstar-{i+1:02d}'
target = HERE/'logstar-e5-kaggle-12-cases.ipynb'
target.write_text(json.dumps(notebook, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Packaged {len(cells)} cells / 12 queries; SHA256 '+hashlib.sha256(target.read_bytes()).hexdigest())
