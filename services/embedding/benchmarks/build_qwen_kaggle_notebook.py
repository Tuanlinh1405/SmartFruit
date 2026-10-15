"""Package one Qwen Kaggle run; reuse the frozen 12-case E5 fixture/results."""
import ast
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
nb = json.loads((HERE/'logstar-e5-kaggle-12-cases.ipynb').read_text(encoding='utf-8'))
baseline = json.loads((HERE.parents[2]/'docs/benchmarks/kaggle-e5-12-cases/rendered-tables.json').read_text(encoding='utf-8'))
instruction = ('Given a Vietnamese agricultural purchase query, retrieve product names matching '
               'the requested fruit and cultivar. Prioritize the requested cultivar and avoid '
               'cultivars explicitly excluded by the buyer.')


def set_source(i, text):
    nb['cells'][i]['source'] = text.splitlines(True)
    if nb['cells'][i]['cell_type'] == 'code':
        ast.parse(text)


set_source(0, '''# LogStar — Qwen3 Embedding: 12 ca so với E5

Chỉ chạy Qwen3-Embedding-0.6B **một lượt trên Kaggle CPU**, không train, không chạy inference local.
Giữ nguyên 31 tên sản phẩm, 12 truy vấn và nhãn từ phép thử E5: 10 ca có nhãn, RD6 và Chuối Cavendish chỉ xem gợi ý.

So với kết quả E5 đã chạy ở Version 1 trước đó, không chạy lại E5. Dữ liệu tổng hợp nhỏ, không đại diện accuracy thực tế. Chỉ dẫn được đặt trước lượt Qwen này nhưng có tham khảo lỗi E5 đã biết; đây không phải tập test độc lập.
Không tách query bằng LLM khác hoặc luật giống, không alias enrichment, không lọc loại trước. Toàn bộ query + instruction đi thẳng vào Qwen để tạo vector.
''')
set_source(2, ''.join(nb['cells'][2]['source']).replace('e5-tiny-results','qwen-e5-tiny-results'))
source = ''.join(nb['cells'][4]['source'])
start = source.index('all_rows, summaries, score_rows')
source = '''MODEL_SPECS = [
    ('qwen3-embedding-0.6b', 'Qwen/Qwen3-Embedding-0.6B', '97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3'),
]
TASK = '''+repr(instruction)+'''
QUERY_PROMPT = 'Instruct: '+TASK+'\\nQuery:'
print('Fixed instruction:', TASK)
'''+source[start:]
source = source.replace('trust_remote_code=False)',
                        "trust_remote_code=False, tokenizer_kwargs={'padding_side': 'left'}, model_kwargs={'torch_dtype': torch.float32})")
source = source.replace("model.encode(['passage: '+n for n in names], batch_size=8,",
                        "model.encode(names, prompt='', batch_size=8,")
source = source.replace("model.encode(['query: '+q['text'] for q in queries], batch_size=8,",
                        "model.encode([q['text'] for q in queries], prompt=QUERY_PROMPT, batch_size=8,")
source = source.replace('assert np.isfinite(cosine).all()',
                        "assert np.isfinite(cosine).all()\n    assert vectors.shape == (12, 1024)\n    assert np.allclose(np.linalg.norm(vectors, axis=1), 1, atol=1e-5)")
set_source(4, source)
export = ''.join(nb['cells'][5]['source'])
prefix = 'ARCHIVED_E5 = json.loads('+repr(json.dumps(baseline,ensure_ascii=False))+')\n'+'''
archived_summary = pd.DataFrame(ARCHIVED_E5['tables'][1][1:], columns=ARCHIVED_E5['tables'][1][0]).drop(columns=[''])
for column in ['top1_correct','labelled_queries','top1_accuracy','hit_at_3','mrr','encode_all_seconds']:
    archived_summary[column] = pd.to_numeric(archived_summary[column])
archived_summary['source'] = 'Archived E5 Kaggle Version 1 (not rerun)'
print('Previous E5 source:', ARCHIVED_E5['source'])
'''
export = prefix+export
export = export.replace("display(summary[['model'", "display(summary[['model'", 1)
export = export.replace("details = pd.DataFrame(all_rows)",
                        "details = pd.DataFrame(all_rows)\nsummary['source'] = 'Current Qwen Kaggle run'\ncomparison = pd.concat([archived_summary, summary], ignore_index=True)\ndisplay(comparison[['model','top1_correct','labelled_queries','top1_accuracy','hit_at_3','mrr','source']])\ncomparison.to_csv(OUT/'comparison.csv', index=False)")
export = export.replace("'fixture': PAYLOAD, 'summary': summaries, 'rows': all_rows,",
                        "'fixture': PAYLOAD, 'instruction': TASK, 'query_prompt': QUERY_PROMPT, 'precision': 'FP32',\n    'archived_e5_source': ARCHIVED_E5['source'], 'summary': summaries, 'rows': all_rows,")
set_source(5, export)
set_source(6, '''## Giới hạn

- Qwen được encode cả câu cùng instruction; passage chỉ là tên sản phẩm, theo hướng dẫn chính thức.
- Prefix E5 và Qwen khác nhau theo convention từng model; cosine giữa các model không cùng thang hiệu chỉnh.
- Chấm cùng một nhãn đích và tập ứng viên; chỉ so chất lượng thứ hạng, không so một ngưỡng cosine chung.
- RD6 không mặc định là Ri6; sản phẩm không có trong catalog không được ép coi top-1 là đáp án đúng.
- Không điều chỉnh instruction theo kết quả Qwen trong lượt này. Chưa đo trên tập độc lập.
- Tài liệu model: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B
''')
for i, cell in enumerate(nb['cells']):
    cell['id'] = f'qwen-probe-{i+1:02d}'
    if cell['cell_type']=='code': cell.update(execution_count=None, outputs=[])
path = HERE/'logstar-qwen-embedding-12-cases.ipynb'
path.write_text(json.dumps(nb, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
print(f'Packaged {len(nb["cells"])} cells: same 12 queries, one Qwen model, archived E5 comparison; no inference executed.')
