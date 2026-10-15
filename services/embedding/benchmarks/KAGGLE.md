# Chạy nhanh trên Kaggle

Notebook: [LogStar E5 12 Variety Cases](https://www.kaggle.com/code/tunlnh/logstar-e5-12-variety-cases).

Đã thử thêm **Qwen3-Embedding-0.6B + instruction** trên cùng 12 ca: [notebook](https://www.kaggle.com/code/tunlnh/logstar-qwen-embedding-12-cases?scriptVersionId=358653978), [báo cáo](../../../docs/benchmarks/kaggle-qwen-12-cases/README.md). Qwen đúng 8/10, còn E5-base 9/10; chưa thay model trong app. Chỉ chạy Qwen một lượt trên Kaggle CPU, không chạy lại E5.

File nguồn tự chứa: `logstar-e5-kaggle-12-cases.ipynb`; tạo lại bằng `python services/embedding/benchmarks/build_kaggle_notebook.py` (chỉ đóng gói, không chạy model).

- 12 truy vấn / 31 tên ứng viên; 10 truy vấn có nhãn, RD6 và sản phẩm ngoài catalog chỉ xem gợi ý.
- E5-small và E5-base: mỗi model encode một lượt, không train, không benchmark tải đồng thời.
- Chạy CPU trên Kaggle; Internet bật để lấy model/version đã pin. Không dùng GPU quota cho mẫu này.
- Chỉ có dữ liệu tên giống mẫu. Không tải `.env`, mật khẩu, tài khoản test hoặc dữ liệu Supabase lên Kaggle.
- Output: `e5-tiny-results/summary.csv`, `top3.csv`, `cosine-all.csv`, `results.json`.
- Bộ 12 ca khác bộ local 155 ca có nhãn, không so trực tiếp tỷ lệ giữa hai bộ.

Đã chạy xong Version 1 trên Kaggle ngày 15/10/2026, runtime 2m 8s (gồm cài thư viện/tải model). Small đúng 8/10, base đúng 9/10; cả hai có đích trong top-3 ở 10/10 ca có nhãn. [Báo cáo và bảng lấy từ Kaggle](../../../docs/benchmarks/kaggle-e5-12-cases/README.md). App vẫn dùng rule-only và không backfill vector cloud trong bước này.
