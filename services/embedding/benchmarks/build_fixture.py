"""Freeze a synthetic, hand-labelled variety-name probe BEFORE running models."""
import hashlib
import json
from pathlib import Path
import unicodedata

ROOT = Path(__file__).resolve().parent


def ascii_text(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text)
                   if unicodedata.category(c) != 'Mn').replace('đ', 'd').replace('Đ', 'D')


def main():
    groups = {
        'durian': ('Sầu riêng', ['Ri6', 'Monthong', 'Musang King', 'Black Thorn', 'Chín Hóa', 'Khổ qua xanh', 'Chuồng bò']),
        'mango': ('Xoài', ['Cát Hòa Lộc', 'Cát Chu', 'Keo', 'Tượng da xanh']),
        'pomelo': ('Bưởi', ['Da xanh', 'Năm Roi', 'Diễn', 'Đoan Hùng']),
        'jackfruit': ('Mít', ['Thái', 'Ruột đỏ', 'Tố nữ']),
        'longan': ('Nhãn', ['Xuồng cơm vàng', 'Tiêu da bò', 'Ido']),
        'dragonfruit': ('Thanh long', ['Ruột trắng', 'Ruột đỏ LĐ1', 'Ruột tím hồng LĐ5']),
        'rice': ('Lúa', ['ST24', 'ST25', 'OM5451', 'OM18', 'IR50404']),
        'grape': ('Nho', ['NH01-48', 'NH01-152']),
    }
    aliases = {'durian-0': ['Ri 6', 'RI-6'], 'durian-1': ['Dona', 'Đô Na', 'Mon Thong'],
               'durian-2': ['Musangking'], 'durian-3': ['Blackthorn'],
               'dragonfruit-1': ['Long Định 1', 'LĐ1', 'LD1'],
               'dragonfruit-2': ['Long Định 5', 'LĐ5', 'LD5']}
    catalog = []
    for group, (fruit, varieties) in groups.items():
        for i, variety in enumerate(varieties):
            identifier = f'{group}-{i}'
            catalog.append({'id': identifier, 'group': group, 'fruit': fruit, 'variety': variety,
                            'name': f'{fruit} {variety}', 'aliases': aliases.get(identifier, [])})
    queries = []

    def add(text, target, category, note=''):
        queries.append({'id': f'q{len(queries)+1:03d}', 'text': text, 'target': target,
                        'category': category, 'note': note})

    for item in catalog:
        add(item['name'], item['id'], 'exact')
        add(ascii_text(item['name']).lower(), item['id'], 'unaccented')
        add(item['variety'], item['id'], 'bare_name')
        add(f"Cần mua 10 tấn {item['name']}, giá dưới 70 nghìn/kg, vườn gần Đồng Nai",
            item['id'], 'purchase_sentence')
    for text, target in [
        ('Sầu riêng R16', 'durian-0'), ('Sầu riêng Ri 66', 'durian-0'),
        ('Sầu riêng Rii6', 'durian-0'), ('sau rieng monthon', 'durian-1'),
        ('Sầu riêng Mongthong', 'durian-1'), ('Sầu riêng Musan King', 'durian-2'),
        ('Sầu riêng Blak Thorn', 'durian-3'), ('Sầu riêng Chín Hoá', 'durian-4'),
        ('xoai cat hoa locc', 'mango-0'), ('Xoài Cát Chuu', 'mango-1'),
        ('buoi nam roii', 'pomelo-1'), ('Bưởi da xah', 'pomelo-0'),
        ('nhan xuong com vang', 'longan-0'), ('Nhãn tiêu da bo', 'longan-1'),
        ('Thanh long ruot tim hong LD5', 'dragonfruit-2'),
        ('Lúa ST 25', 'rice-1'), ('Lúa OM 5451', 'rice-2'),
        ('Nho NH01 152', 'grape-1'), ('Nho NH01 48', 'grape-0'),
        ('mit to nu', 'jackfruit-2'),
    ]:
        add(text, target, 'typo_spacing', 'Nhãn theo ý định lỗi gõ do tác giả fixture đặt; chưa được chuyên gia độc lập gán nhãn.')
    for text, target in [
        ('Sầu riêng Dona', 'durian-1'), ('Sầu riêng Đô Na', 'durian-1'),
        ('Sầu riêng Mon Thong', 'durian-1'), ('Sầu riêng Musangking', 'durian-2'),
        ('Sầu riêng Blackthorn', 'durian-3'), ('Thanh long Long Định 1', 'dragonfruit-1'),
        ('Thanh long Long Định 5', 'dragonfruit-2'), ('Thanh long LD5', 'dragonfruit-2'),
    ]:
        add(text, target, 'alias', 'Alias trong fixture; thí nghiệm enriched cung cấp alias này cho passage một cách công khai.')
    for text, target in [
        ('Cần Ri6, không mua Monthong', 'durian-0'),
        ('Cần Monthong, không mua Ri6', 'durian-1'),
        ('Sầu riêng Ri6 cơm vàng hạt lép, cần 10 tấn', 'durian-0'),
        ('Sầu riêng Monthong cơm vàng hạt lép, cần 10 tấn', 'durian-1'),
        ('Xoài Cát Chu, không lấy Cát Hòa Lộc', 'mango-1'),
        ('Bưởi Năm Roi, không lấy bưởi da xanh', 'pomelo-1'),
        ('Gạo ST25, không phải ST24', 'rice-1'),
        ('Thanh long ruột đỏ LĐ1, không lấy ruột trắng', 'dragonfruit-1'),
    ]:
        add(text, target, 'hard_context')
    for text in ['Sầu riêng RD6', 'RD6', 'Sầu riêng', 'Xoài cát', 'Cơm vàng hạt lép',
                 'Thanh long ruột đỏ hoặc ruột trắng', 'Sầu riêng Ri6 hoặc Monthong', 'Nho NH01']:
        add(text, None, 'ambiguous', 'Không có một đáp án duy nhất; chỉ quan sát top/margin, không tính accuracy.')
    for text in ['Chuối Cavendish', 'Táo Fuji', 'Sầu riêng D9999', 'Xoài XYZ123',
                 'Cà phê Robusta', 'Khoai lang tím', 'Cam xoàn', 'Dưa hấu không hạt']:
        add(text, None, 'out_of_catalog', 'Không có trong catalog đóng; cosine top cao vẫn không chứng minh có giống phù hợp.')
    # Avoid counting identical authored query strings twice across categories.
    unique = {}
    for q in queries:
        key = q['text'].strip().casefold()
        if key in unique:
            assert unique[key]['target'] == q['target']
        else:
            unique[key] = q
    queries = list(unique.values())
    for i, q in enumerate(queries):
        q['id'] = f'q{i+1:03d}'
    sources = [
        {'url': 'https://khuyennong.lamdong.gov.vn/UpLoaded/files/2025/sauriengVIETGAP.pdf', 'use': 'Ri6 và DONA (Monthong)'},
        {'url': 'https://khuyennongvn.gov.vn/portals/0/tailieu/2018/05/quynhkn/sach_thanh_long_in.pdf', 'use': 'LĐ1 và LĐ5'},
        {'url': 'https://khuyennongvn.gov.vn/hoat-dong-khuyen-nong/chuyen-giao-tbkt/ninh-thuan-giong-nho-moi-tren-vung-dat-nang-16700.html', 'use': 'NH01-48 và NH01-152'},
        {'url': 'https://khuyennongvn.gov.vn/hoat-dong-khuyen-nong/thong-tin-huan-luyen/mot-so-giai-phap-de-trien-khai-tot-san-xuat-vu-dong-xuan-2024-2025-vung-dbscl-28180.html', 'use': 'Mã lúa ST24/ST25/OM18/OM5451'},
    ]
    payload = {'version': 'variety-probe-v1', 'description': 'Synthetic closed-catalog product-name probe, not a representative production benchmark or botanical taxonomy. Names include commercial product groups.',
               'catalog': catalog, 'queries': queries, 'sources': sources,
               'limitations': ['Labels authored before model runs; no independent annotation.',
                              'One canonical document per variety; exact queries are easy sanity checks.',
                              'Price, quantity and location are distractor text only: not evaluated as trade constraints.',
                              'RD6 is unlabelled/ambiguous, never assumed to be Ri6.',
                              'No threshold fitting, fine tuning, API calls or database writes.']}
    path = ROOT / 'variety-fixture.json'
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'Frozen {len(catalog)} products / {len(groups)} groups / {len(queries)} queries; SHA256 {hashlib.sha256(path.read_bytes()).hexdigest()}')


if __name__ == '__main__':
    main()
