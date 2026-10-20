# Công nghệ nổi bật của SmartFruit

Bản tóm tắt phục vụ proposal và demo • Cập nhật ngày 20/10/2026

## Các công nghệ chính

| Thành phần | Công nghệ nổi bật | Cách hoạt động |
| --- | --- | --- |
| **Trợ lý AI** | **OpenRouter Free · Context Grounding** | Chọn model miễn phí để trả lời dựa trên bộ tài liệu nông nghiệp được cung cấp, kèm nguồn tham chiếu. Backend kiểm tra cấu trúc và mã nguồn trước khi hiển thị. |
| **Tìm kiếm nông sản** | **Multilingual E5 base · pgvector** | Chuyển tên sản phẩm thành vector 768 chiều, tìm tối đa 20 ứng viên gần với nhu cầu bằng Cosine Similarity. |
| **Xử lý tên tiếng Việt** | **Unicode Normalization · Fuzzy Matching** | Chuẩn hóa có dấu/không dấu và nhận lỗi gõ nhỏ bằng thuật toán Optimal String Alignment. Giữ phân biệt mã giống như Ri6 và Ri7. |
| **Bản đồ khu vực thu mua** | **Leaflet · OpenStreetMap** | Hiển thị nhu cầu mua theo tỉnh, hỗ trợ bấm marker và lọc theo vùng hoặc loại quả. Marker là điểm đại diện tỉnh, chưa phải vị trí kho hay định tuyến vận chuyển. |
| **Thời tiết tại vườn** | **Open-Meteo Forecast · Geocoding API** | Lấy nhiệt độ, độ ẩm, gió, khả năng mưa và dự báo ba ngày theo tọa độ hồ sơ hoặc địa điểm được chọn. |

## Thuật toán tìm và xếp hạng đối tác

1. **Rule-based Filtering:** loại các lô không thỏa loại/giống, thời gian, trạng thái hoặc lượng tối thiểu.

2. **Cosine Similarity:** đo độ gần giữa vector nhu cầu và vector sản phẩm.

   `cosine = (u · v) / (‖u‖ × ‖v‖)`

   Trong đó u và v là hai vector biểu diễn nội dung.

3. **Exact & Fuzzy Matching:** so tên chính xác hoặc gần đúng; xử lý một số cụm loại trừ như “không lấy”.

4. **Name-based Reranking:** ưu tiên khớp toàn bộ từ khóa → gần khớp → khớp một phần.

5. **Weighted Scoring:** kết hợp điểm ngữ nghĩa, giá và lượng.

   **Hybrid:** `100 × (0,45 × cosine + 0,25 × giá + 0,20 × lượng) / 0,90`

   **Rule only:** `100 × (0,40 × giá + 0,35 × lượng) / 0,75`

6. **Điểm thành phần:** lượng tính theo tỷ lệ đáp ứng, tối đa 100%; giá đạt tối đa khi nằm trong khoảng mong muốn và giảm khi lệch khỏi khoảng.

Cosine được giới hạn trong khoảng 0 đến 1 khi đưa vào điểm kết hợp; điểm giá và lượng cũng ở thang 0 đến 1.

## Cách các thành phần liên kết

**E5 tìm ứng viên → bộ xử lý tiếng Việt kiểm tra tên → công thức chấm điểm giúp xếp hạng.** Mức khớp tên được ưu tiên trước điểm tổng hợp.

**Map và weather hiện là các tính năng riêng trên Tổng quan Farmer**, chưa đưa dữ liệu vào chatbot và chưa dùng khoảng cách để tính điểm matching. Trợ lý hiện cũng chưa gọi công cụ tìm kiếm web.
