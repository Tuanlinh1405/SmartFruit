# Matching E5: vector top 20 rồi rerank

Quyết định hiện hành ngày 15/10/2026. Tài liệu này thay bước union semantic/keyword/graph và RRF trong plan vector/graph cũ. Chỉ xét sản phẩm, giá, lượng; giữ dữ liệu khu vực để dùng sau.

## Luồng tìm kiếm

1. Đọc nguồn thuộc đúng tài khoản: nhu cầu Buyer hoặc lô Farmer. Query là từ khóa người dùng, hoặc tên nguồn kèm tên loại/giống từ catalog; không ghép giá/lượng/địa chỉ/ghi chú vào query mặc định.
2. E5 tạo query vector. Giữ `intfloat/multilingual-e5-base`, revision `d13f1b27baf31030b7fd040960d60d909913633f`, 768 chiều, prefix `query:` / `passage:`, L2 normalization. Không dùng Qwen hoặc đổi sang E5-small 384 chiều trong schema 768 chiều.
3. PostgreSQL/pgvector tìm **tối đa 20 ứng viên bằng cosine**. Áp RLS, trạng thái tin, loại/giống đã chọn, giao ngày, lượng tối thiểu và điều kiện đáp ứng toàn bộ trước khi lấy top 20. Chỉ đọc vector đúng model và đúng content hash hiện tại. Sort cosine giảm dần, ID tăng dần khi bằng nhau.
4. Rerank **chính tập 20 đó** bằng so từ chính xác/gần đúng. Không union ứng viên lexical/graph; không tìm thêm record ngoài top 20. Kiểm tra lại eligibility sau khi đọc bản ghi, rồi áp loại trừ rõ trong tên.
5. Thứ tự: nhóm khớp toàn bộ từ → nhóm gần khớp toàn bộ từ → nhóm khớp một phần → chưa khớp từ. Trong nhóm, ưu tiên độ phủ/độ gần tên, rồi điểm cosine/giá/lượng, cuối cùng ID. Giá hoặc lượng tốt không đẩy tên chỉ khớp một phần lên trên tên khớp toàn bộ.
6. Phân trang sau rerank. Tối đa 20 kết quả trước phân trang; có thể ít hơn nếu chưa đủ vector hoặc ứng viên bị đóng/loại trừ. Không bù bằng ứng viên thứ 21.

Cosine gốc được trả qua `cosineSimilarity` (không phải xác suất). Điểm phụ trong hybrid là `100 × (0.45 × clamp(cosine) + 0.25 × priceFit + 0.20 × quantityFit) / 0.90`; `clamp` giới hạn [0,1]. Điểm này xét sau mức khớp tên, nên danh sách không nhất thiết giảm dần theo điểm phụ. Khi tên giống nhau, giá/lượng quyết định cùng cosine. Giá/lượng vẫn dùng công thức đã có, không lấy giá sàn riêng.

## So từ

- Chuẩn hóa chữ thường, dấu tiếng Việt, `đ`, khoảng trắng và dấu câu; so từ đầy đủ, không dùng substring như `Ri6` trong `Ri60`.
- Bỏ từ ngữ thu mua và lượng/giá có đơn vị phổ biến; ghép mã giống viết cách như `Ri 6`, `Booth 7`, `Bơ 034`. Không có danh sách giống viết cứng; tên chuẩn lấy từ catalog.
- Gần khớp dùng khoảng cách chỉnh sửa có hoán đổi hai ký tự liền nhau (optimal string alignment): từ dài 4–6 ký tự cho tối đa 1 sửa; từ từ 7 ký tự cho tối đa 2 sửa; similarity tối thiểu 0,75. Mã chứa số và từ dưới 4 ký tự chỉ khớp chính xác: không tự sửa `RD6` thành `Ri6`, `Ri6` thành `Ri7`, hoặc `034` thành `036`.
- Các mẫu loại trừ đơn giản như “không lấy”, “không phải”, “ngoại trừ”, “trừ” được tách khỏi phần tên muốn mua. Ví dụ “xoài cát Chu không lấy cát Hòa Lộc” loại Hòa Lộc trong top 20. Đây là parser giới hạn theo cụm từ, chưa hiểu mọi câu phủ định/phép lựa chọn. Không coi “giá không quá 70000” là loại trừ sản phẩm.
- Tên đồng nghĩa không gần về chữ như Dona/Monthong cần alias đã xác nhận hoặc tín hiệu từ E5; fuzzy không tự kết luận hai tên đó tương đương. Chưa có bước đoán nhãn bằng LLM.

## Mã và trạng thái triển khai

- `src/features/matching/name-match.ts`: so từ/tên, dùng chung Buyer/Farmer và fallback trên web.
- `core.ts`: `ruleVersion = e5-top20-name-rerank-v2`, rerank và điểm giá/lượng.
- `search-service.ts`: giữ pool tối đa 20 trước đọc bản ghi/rerank; metadata `rankingScope=vector_top20`, `candidateCount`, `eligibleCount`, `resultCount`.
- `supabase/migrations/202610150003_vector_top20.sql`: hai RPC `search_lot_vector_top20`, `search_request_vector_top20`, SECURITY INVOKER và RLS hiện có. Không thêm bảng hoặc quyền quản trị. Đây là migration mới, **chưa áp cloud**.
- Edge Function đã nối RPC mới và kiểm tra đúng model version từ inference response. **Inference/worker/Edge Function chưa deploy**, vector thật chưa backfill; app vẫn `VITE_MATCHING_MODE=rule-only`. Đã code luồng top 20, chưa tuyên bố E5 đang phục vụ web.

Khi không có inference hợp lệ, mode `degraded` dùng ứng viên theo quy tắc cũ và so từ mới, có nhãn rõ; không gọi đó là vector top 20. Khi E5 có query vector nhưng database chưa có passage vector thì trả rỗng, không mở rộng sang lexical/graph.

Để bật E5 thật: áp migration mới một lần; có host HTTPS cho inference và worker; backfill embedding; deploy Edge Function; kiểm tra bằng account thật rồi bật cờ hybrid. Hướng dẫn secret/host ở [embedding README](../services/embedding/README.md). Không chạy inference lâu trên laptop hoặc dùng notebook Kaggle như API web thường trực.

## Kiểm thử

`npm test` kiểm tra so từ, lỗi gõ, mã giống, loại trừ, thứ tự tên trước giá/lượng, lấy top 20 trước rerank và phân trang, không lấy ứng viên thứ 21, hai chiều Buyer/Farmer và trường hợp suy giảm. Không chạy model.

```powershell
cd supabase/tests
npm ci --ignore-scripts
npm run test:vector
```

Test database dùng PostgreSQL + [pgvector của PGlite](https://pglite.dev/extensions/#pgvector), 768 chiều với 2 phần tử có giá trị. Kiểm tra cosine thật, top 20, stale hash, model khác, chưa có vector, eligibility, ownership/RLS, anonymous, null/zero query và tie-break. Đây là kiểm thử pipeline; benchmark E5 thực trước đây trên Kaggle là phép đo chất lượng riêng.
