"""Export actual cosine rows, figures and a readable local benchmark report."""
import csv
import json
from pathlib import Path
import os

os.environ['MPLCONFIGDIR'] = str(Path('tmp/matplotlib').resolve())
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parent
OUT = Path('docs/benchmarks/e5-varieties-2026-10-15')
CATEGORY = {'exact': 'Tên chính xác', 'unaccented': 'Không dấu', 'bare_name': 'Chỉ tên giống',
            'purchase_sentence': 'Câu mua hàng', 'typo_spacing': 'Lỗi gõ/khoảng trắng',
            'alias': 'Tên gọi khác', 'hard_context': 'Ngữ cảnh khó',
            'ambiguous': 'Mơ hồ', 'out_of_catalog': 'Ngoài danh mục'}


def pct(value):
    return f'{value*100:.1f}%'


def main():
    fixture = json.loads((ROOT/'variety-fixture.json').read_text(encoding='utf-8'))
    catalog = fixture['catalog']
    lookup = {p['id']: p for p in catalog}
    models = [json.loads(p.read_text(encoding='utf-8')) for p in [OUT/'small.json', OUT/'base.json'] if p.exists()]
    assert models, 'Run at least one real model first.'
    assert len({m['fixture_sha256'] for m in models}) == 1
    plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10})
    exported = []
    for model in models:
        for mode in ['name_only', 'alias_enriched']:
            for row in model[mode]['rows']:
                for rank, candidate in enumerate(row['ranking'], 1):
                    exported.append({'model': model['model'], 'mode': mode, 'query_id': row['id'],
                                     'category': row['category'], 'query': row['text'],
                                     'expected': lookup[row['target']]['name'] if row['target'] else '',
                                     'rank': rank, 'candidate': candidate['name'],
                                     'cosine': candidate['score'], 'correct': candidate['id'] == row['target'],
                                     'target_rank': row['target_rank'], 'same_group_margin': row['same_group_margin']})
        indices = [i for i,p in enumerate(catalog) if p['group'] == 'durian']
        pair = np.array(model['catalog_name_query_passage_cosine'])[np.ix_(indices, indices)]
        fig, ax = plt.subplots(figsize=(9.5, 7))
        im = ax.imshow(pair, vmin=.7, vmax=1, cmap='YlGnBu')
        labels = [catalog[i]['variety'] for i in indices]
        ax.set_xticks(range(len(labels)), labels, rotation=35, ha='right')
        ax.set_yticks(range(len(labels)), labels)
        for i in range(len(labels)):
            for j in range(len(labels)):
                ax.text(j,i,f'{pair[i,j]:.3f}',ha='center',va='center',fontsize=9,
                        color='white' if pair[i,j]>.91 else '#12263a')
        ax.set(xlabel='Tên sản phẩm (passage)', ylabel='Tên tìm kiếm (query)',
               title=f"E5-{model['model']}: cosine giữa các giống sầu riêng\nTên đầy đủ; không alias, không lọc catalog")
        fig.colorbar(im, ax=ax, label='Cosine similarity')
        fig.tight_layout(); fig.savefig(OUT/f"{model['model']}-durian.png",dpi=180);plt.close(fig)
        with (OUT/f"{model['model']}-name-pairs.csv").open('w',encoding='utf-8-sig',newline='') as f:
            writer=csv.writer(f);writer.writerow(['query / passage']+[p['name'] for p in catalog])
            for p, values in zip(catalog, model['catalog_name_query_passage_cosine']): writer.writerow([p['name']]+values)
    with (OUT/'all-rankings.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(exported[0]));writer.writeheader();writer.writerows(exported)
    categories = [c for c in CATEGORY if c not in ['ambiguous','out_of_catalog']]
    fig, ax = plt.subplots(figsize=(12, 5.2))
    x=np.arange(len(categories)); width=.8/(len(models)+1)
    series=[(f"E5-{m['model']}",[m['name_only']['summary']['by_category'][c]['top1']*100 for c in categories]) for m in models]
    series.append(('So khớp ký tự', [models[0]['character_baseline']['summary']['by_category'][c]['top1']*100 for c in categories]))
    for i,(label, values) in enumerate(series):
        bars=ax.bar(x+(i-(len(series)-1)/2)*width,values,width,label=label)
        ax.bar_label(bars,fmt='%.0f',fontsize=8,padding=2)
    ax.set_xticks(x,[CATEGORY[c] for c in categories],rotation=18,ha='right')
    ax.set(ylabel='Top-1 đúng giống (%)',ylim=(0,115),title='31 sản phẩm / 8 nhóm · dữ liệu tổng hợp, không phải benchmark thị trường')
    ax.legend(loc='upper right');ax.grid(axis='y',alpha=.15);ax.set_axisbelow(True)
    fig.tight_layout();fig.savefig(OUT/'accuracy.png',dpi=180);plt.close(fig)
    fig, axes=plt.subplots(1,len(models),figsize=(6*len(models),4.8),squeeze=False)
    for ax,m in zip(axes[0],models):
        rows=[r for r in m['name_only']['rows'] if r['target'] and r['category']!='exact']
        correct=[r['target_cosine'] for r in rows]
        wrong=[r['target_cosine']-r['same_group_margin'] for r in rows]
        ax.hist(correct,bins=np.linspace(.6,1,25),alpha=.65,label='Đúng giống',color='#17875b')
        ax.hist(wrong,bins=np.linspace(.6,1,25),alpha=.5,label='Giống khác cùng loại cao nhất',color='#d57235')
        ax.set(title=f"E5-{m['model']} · bỏ nhóm tên chính xác",xlabel='Cosine',ylabel='Số truy vấn')
        ax.legend(fontsize=8)
    fig.tight_layout();fig.savefig(OUT/'cosine-overlap.png',dpi=180);plt.close(fig)
    lines=['# Benchmark local E5 với tên giống nông sản', '',
           'Ngày 15/10/2026 · CPU local · không fine-tune · không ghi dữ liệu Supabase · chưa bật hybrid trong app.', '',
           f"Fixture: **{len(catalog)} tên sản phẩm / 8 nhóm / {len(fixture['queries'])} truy vấn**; "
           f"{sum(q['target'] is not None for q in fixture['queries'])} có nhãn đích và 16 ca mơ hồ/ngoài danh mục chỉ quan sát.", '',
           'Đây là phép thử kỹ thuật nhỏ với nhãn do tác giả đặt trước khi chạy model, chưa có chuyên gia gán nhãn độc lập. '
           'Các biến thể cùng sản phẩm có tương quan; số liệu không phải ước lượng accuracy ngoài thực tế. '
           'Danh mục gồm cả nhóm tên thương mại, không phải hệ thống phân loại giống thực vật đã kiểm định.', '',
           '## Nhận xét từ lượt chạy này', '',
           '- E5-small đúng 145/155, E5-base đúng 147/155 ở name-only. Bỏ 31 ca exact dễ: small đúng 114/124, base đúng 116/124. Chênh lệch nhỏ, chưa đủ để kết luận model nào tốt hơn trên thị trường.',
           '- Cả hai đúng 41/45 ca sầu riêng có nhãn; tên giống chuẩn phân biệt được trong catalog này. Dữ liệu không dấu vẫn gây nhầm sang cả loại quả khác.',
           '- Với `Sầu riêng RD6`: small ưu tiên Ri6 (0.9281), base ưu tiên Ri6 (0.9030). RD6 không có nhãn chuẩn nên đây là gợi ý, không được tính là một ca đúng.',
           '- Với `Xoài Cát Chu, không lấy Cát Hòa Lộc`: cả hai ưu tiên sai Cát Hòa Lộc. Cosine không đủ để thực thi điều kiện phủ định.',
           '- Thêm alias làm đúng 8/8 ca alias nhưng không bảo đảm cải thiện tổng thể. Cần đối chiếu alias có cấu trúc trong catalog thay vì chỉ nối mọi alias vào đoạn encode.',
           '- Small khoảng 25 ms/query và 1.17 GiB peak RSS; base khoảng 51 ms và 1.80 GiB. Small phù hợp prototype local nhẹ hơn; chưa thay model/dimension trong app.',
           '- Hướng triển khai: dùng tên/alias/catalog xác định sản phẩm, cosine gợi ý khi chưa rõ; xác nhận trường hợp mơ hồ rồi mới so giá/lượng/khoảng cách. Chưa chọn ngưỡng cosine production.', '',
           '## Phương pháp', '',
           '- Tập ứng viên cố định: một passage tên chuẩn cho mỗi sản phẩm; tìm kiếm toàn bộ 31 ứng viên bằng cosine, không lọc loại trước.',
           '- Dùng prefix `query:` / `passage:`, vector chuẩn hóa L2, FP32, CPU 4 luồng, batch 8, tối đa 512 token.',
           '- Primary: **name_only**. Thử nghiệm phụ **alias_enriched** thêm tên gọi khác vào passage; không trộn hai kết quả.',
           '- Baseline ký tự: bỏ dấu/chữ thường/ký tự phân cách rồi so SequenceMatcher; không có alias hay embedding. Đây không phải BM25 hoặc search production.',
           '- Hit@1: top đầu đúng giống; Hit@3: đích có trong top 3; MRR: trung bình nghịch đảo thứ hạng. Mỗi query có đúng một đích.',
           '- Margin cùng loại = cosine đích trừ cosine cao nhất của giống khác cùng loại. Margin âm nghĩa là model ưu tiên sai giống.',
           '- RD6/mô tả chung/ngoài danh mục không có nhãn đích: không tính chúng vào accuracy và không tự sửa RD6 thành Ri6.',
           '- Giá/lượng/vị trí trong câu chỉ là từ gây nhiễu; không đánh giá lọc nghiệp vụ, khoảng cách hoặc graph ở phép thử này.',
           '- Không chọn hay công bố ngưỡng cosine an toàn trên chính tập thử này. Chưa có validation/test độc lập.', '',
           f"SHA256 fixture: `{models[0]['fixture_sha256']}`", '',
           '## Kết quả chính: tên chuẩn trong catalog', '',
           '| Phương án | Có nhãn | Top-1 | Hit@3 | MRR | Top-1 bỏ exact |', '| --- | ---: | ---: | ---: | ---: | ---: |']
    for m in models:
        s=m['name_only']['summary']; a=s['all_labelled']
        lines.append(f"| E5-{m['model']} | {a['n']} | {pct(a['top1'])} | {pct(a['hit3'])} | {a['mrr']:.3f} | {pct(s['non_exact']['top1'])} |")
    s=models[0]['character_baseline']['summary'];a=s['all_labelled']
    lines.append(f"| Baseline ký tự | {a['n']} | {pct(a['top1'])} | {pct(a['hit3'])} | {a['mrr']:.3f} | {pct(s['non_exact']['top1'])} |")
    lines+=['','![Kết quả theo loại truy vấn](accuracy.png)','','## Tách nhóm truy vấn','',
            '| Nhóm | Số ca | '+' | '.join(f"E5-{m['model']} Top-1" for m in models)+' | Ký tự Top-1 |',
            '| --- | ---: | '+' | '.join('---:' for _ in models)+' | ---: |']
    for c in categories:
        baseline=models[0]['character_baseline']['summary']['by_category'][c]
        lines.append(f"| {CATEGORY[c]} | {baseline['n']} | "+' | '.join(pct(m['name_only']['summary']['by_category'][c]['top1']) for m in models)+f" | {pct(baseline['top1'])} |")
    lines+=['','## Tách nhóm nông sản (gồm các ca exact)','',
            '| Nhóm | Số ca | '+' | '.join(f"E5-{m['model']} Top-1" for m in models)+' |',
            '| --- | ---: | '+' | '.join('---:' for _ in models)+' |']
    for g in sorted({p['group'] for p in catalog}):
        n=models[0]['name_only']['summary']['by_group'][g]['n']
        lines.append(f"| {g} | {n} | "+' | '.join(pct(m['name_only']['summary']['by_group'][g]['top1']) for m in models)+' |')
    lines+=['','## Thử thêm alias vào passage','',
            'Đây là thí nghiệm có cấp thêm thông tin: alias dùng trong một số query xuất hiện trong passage enriched. '
            'Mức tăng không phải bằng chứng model tự biết alias hoặc khả năng tổng quát sang alias mới.', '',
            '| Model | Name-only Top-1 | Enriched Top-1 | Alias name-only | Alias enriched |', '| --- | ---: | ---: | ---: | ---: |']
    for m in models:
        a=m['name_only']['summary']; b=m['alias_enriched']['summary']
        lines.append(f"| {m['model']} | {pct(a['all_labelled']['top1'])} | {pct(b['all_labelled']['top1'])} | {pct(a['by_category']['alias']['top1'])} | {pct(b['by_category']['alias']['top1'])} |")
    lines+=['','## Cosine giữa các giống sầu riêng','',
            'Trục dọc là query tên đầy đủ, trục ngang là passage tên đầy đủ; cosine query→passage không bắt buộc đối xứng. '
            'Đường chéo và nhiều giống khác đều có thể có điểm cao. Điểm không phải xác suất đúng giống.', '']
    for m in models: lines += [f"![Sầu riêng E5-{m['model']}]({m['model']}-durian.png)",'']
    lines+=['![Phân bố điểm đúng và sai giống](cosine-overlap.png)','','## Các trường hợp cần xem trực tiếp','',
            '| Model | Query | Đích | Top-1 · cosine | Top-2 · cosine | Hạng đích |', '| --- | --- | --- | --- | --- | ---: |']
    selected=['Sầu riêng Ri6','Sầu riêng RD6','RD6','Sầu riêng R16','Sầu riêng Dona',
              'Cần Ri6, không mua Monthong','Cần Monthong, không mua Ri6',
              'Gạo ST25, không phải ST24','Xoài Cát Chu, không lấy Cát Hòa Lộc',
              'Thanh long ruột đỏ LĐ1, không lấy ruột trắng','Sầu riêng D9999','Chuối Cavendish']
    for text in selected:
        for m in models:
            row=next(r for r in m['name_only']['rows'] if r['text']==text); top=row['ranking'][:2]
            target=lookup[row['target']]['name'] if row['target'] else 'Không gán đích'
            lines.append(f"| {m['model']} | {text} | {target} | {top[0]['name']} · {top[0]['score']:.4f} | {top[1]['name']} · {top[1]['score']:.4f} | {row['target_rank'] or '—'} |")
    lines+=['','## Mọi trường hợp top-1 sai (name-only)','',
            '| Model | Query | Đích (cosine) | Top sai (cosine) | Hạng đích |', '| --- | --- | --- | --- | ---: |']
    for m in models:
        for r in m['name_only']['rows']:
            if r['target'] and r['target_rank']!=1:
                top=r['ranking'][0]
                lines.append(f"| {m['model']} | {r['text']} | {lookup[r['target']]['name']} ({r['target_cosine']:.4f}) | {top['name']} ({top['score']:.4f}) | {r['target_rank']} |")
    lines+=['','## Hiệu năng local','',
            'Độ trễ đã warmup, 24 lần encode một query, loại thời gian tải model/network/database. '
            'Đây là đo trên laptop dùng chung đang chạy ứng dụng khác, không phải tải đồng thời hoặc cam kết SLA. '
            'RSS là bộ nhớ tiến trình đo bằng psutil, không phải tổng RAM máy.', '',
            '| Model | Chiều | Trọng số + tokenizer local | Load | Encode toàn bộ query | p50 / p95 một query | Peak RSS |',
            '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for m in models:
        p=m['performance']
        lines.append(f"| {m['model']} | {m['dimensions']} | {p['local_model_files_mib']:.0f} MiB | {p['model_load_seconds']:.1f}s | {p['encode_queries_seconds']:.1f}s | {p['warm_single_query_p50_ms']:.1f} / {p['warm_single_query_p95_ms']:.1f} ms | {p['peak_process_rss_mib']:.0f} MiB |")
    lines+=['','## Tái lập và dữ liệu thô','',
            '- Fixture: `services/embedding/benchmarks/variety-fixture.json` (nhãn được tạo trước chạy inference).',
            '- `small.json`, `base.json`: toàn bộ thứ hạng, metadata thư viện/CPU/revision, metrics và thời gian.',
            '- [CSV mọi điểm cosine](all-rankings.csv); `*-name-pairs.csv`: ma trận tên query→passage toàn catalog.',
            '- `*-scores.npz`: ma trận số cho phân tích lại, không cần tải model.', '',
            '```powershell',
            r'services/embedding/.venv/Scripts/python.exe services/embedding/benchmarks/run_benchmark.py --model small --model-dir tmp/e5-models/small',
            r'services/embedding/.venv/Scripts/python.exe services/embedding/benchmarks/run_benchmark.py --model base --model-dir tmp/e5-models/base',
            r'services/embedding/.venv/Scripts/python.exe services/embedding/benchmarks/report_benchmark.py',
            '```','', 'Model và môi trường ảo nằm trong thư mục Git ignore. Không push trong lượt này.', '',
            '## Nguồn đối chiếu tên/alias', '']
    for source in fixture['sources']: lines.append(f"- [{source['use']}]({source['url']})")
    for m in models:
        lines+=['',f"Model: `{m['model_id']}` · revision `{m['revision']}` · thư viện `{json.dumps(m['environment']['packages'])}`"]
    (OUT/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(f'Wrote {OUT}/README.md, {len(exported)} ranked CSV rows and figures.')


if __name__ == '__main__':
    main()
