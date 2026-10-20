# Báo cáo mini về trợ lý AI và hệ thống matching SmartFruit

Cập nhật ngày 20/10/2026 theo mã nguồn hiện tại. Trong tài liệu này, E5 là mô hình tìm kiếm ngữ nghĩa được nhắc đến trong yêu cầu.

## 1 Tech stack của trợ lý AI

Trợ lý hỗ trợ nhà vườn hỏi đáp về bệnh và phân loại trái dựa trên tài liệu có sẵn. Backend hiện dùng OpenRouter Free thay cho Gemini.

| Công nghệ hoặc kỹ thuật | Vai trò |
| --- | --- |
| React và TypeScript | Xây dựng giao diện chat và kiểm tra cấu trúc dữ liệu |
| Supabase Edge Functions và Deno | Xử lý yêu cầu, giữ khóa API phía server và gọi dịch vụ AI |
| Supabase Auth và JWT | Xác thực tài khoản, chỉ cho phép vai trò Farmer sử dụng |
| OpenRouter Free với cấu hình openrouter/free | Định tuyến yêu cầu tới mô hình miễn phí; không cố định một model |
| Context Grounding | Cung cấp tài liệu đúng chủ đề để mô hình có căn cứ trả lời |
| Metadata Filtering | Chọn kiến thức theo loại cây và chủ đề; gửi thêm giai đoạn làm ngữ cảnh |
| Structured Output và JSON Schema | Yêu cầu câu trả lời theo cấu trúc gồm nội dung, mã nguồn và câu hỏi làm rõ |
| Source Validation | Kiểm tra mã nguồn có thuộc tập tài liệu đã gửi; lấy tên và link từ backend |
| Single Turn Processing | Mỗi câu hỏi độc lập, không gửi lịch sử hội thoại cho model |

Luồng hoạt động: chọn cây và chủ đề → xác thực → lọc tài liệu → gọi OpenRouter → kiểm tra JSON và nguồn → hiển thị câu trả lời.

Bộ kiến thức có 27 mục về sầu riêng, mít và thanh long, gồm 14 mục bệnh và 13 mục phân loại. Trợ lý dùng mô tả trong câu hỏi và dữ liệu được đóng gói ở backend; chưa tự tìm Internet, đọc ảnh hoặc truy vấn lô hàng, thời tiết và giá thị trường. Các thẻ thời tiết và bản đồ trên dashboard là luồng riêng, chưa nối vào chatbot. Tài liệu nền và câu trả lời cần được đối soát chuyên môn; kiểm tra nguồn không tự chứng minh mọi phát biểu đều đúng.

Câu giới thiệu cho proposal: “Trợ lý nhà vườn kết hợp OpenRouter Free, Context Grounding và Structured Output để cung cấp câu trả lời theo tài liệu tham chiếu, có kiểm tra nguồn phía server.”

## 2 Xử lý tên nông sản tiếng Việt và liên kết với E5

Hai thành phần có vai trò bổ sung: E5 tìm ứng viên gần về nghĩa; bộ xử lý tên kiểm tra mức khớp từ và xếp lại ứng viên, chú ý mã giống và yêu cầu loại trừ.

| Kỹ thuật | Ứng dụng trong dự án |
| --- | --- |
| Unicode NFD Normalization | Chuẩn hóa chữ thường, bỏ dấu khi so sánh và quy đổi đ thành d |
| Tokenization và Noise Word Filtering | Tách từ, bỏ bớt từ giao dịch và lượng kèm đơn vị |
| Exact Token Matching | So từ đầy đủ; giữ Ri6 khác Ri60 |
| Fuzzy Matching bằng Optimal String Alignment | Nhận lỗi thêm, xóa, thay ký tự và hoán đổi hai ký tự liền nhau |
| Numeric Cultivar Code Protection | Mã có số chỉ khớp chính xác; không tự đổi Ri6 thành Ri7 hoặc RD6 |
| Pattern Based Exclusion | Xử lý một số mẫu “không lấy”, “ngoại trừ”, “không phải” |
| Multilingual E5 base và pgvector | Biểu diễn nội dung bằng vector 768 chiều và tìm tối đa 20 ứng viên theo cosine |
| Name Based Reranking | Xếp lại chính tập ứng viên theo độ khớp tên trước khi xét điểm kết hợp |

Pipeline hybrid: từ khóa hoặc tên từ danh mục → E5 embedding → cosine top 20 trong nhóm đủ điều kiện → kiểm tra lại dữ liệu và so tên → chấm điểm giá, lượng → xếp hạng.

Ví dụ “xoài cát Chu không lấy cát Hòa Lộc”: E5 tìm các lô liên quan; bộ xử lý tên có thể loại lô Hòa Lộc trong tập đã lấy. Đây là xử lý theo mẫu câu, chưa hiểu mọi cách diễn đạt phủ định.

Không lấy ứng viên thứ 21 để bù khi top 20 bị loại bớt. Bộ so tên cũng hoạt động khi không có E5, trong chế độ theo quy tắc hoặc dự phòng. Màn hình matching Farmer hiện dùng rule only; hybrid phía Buyer phụ thuộc cấu hình.

## 3 Thuật toán xếp hạng đối tác

Đây là cơ chế xếp hạng nhiều tiêu chí với trọng số định sẵn trong mã, chưa phải mô hình tự học từ lịch sử giao dịch.

1. **Rule Based Eligibility Filtering:** kiểm tra trạng thái tin, loại và giống, thời gian giao nhau, giá và lượng hợp lệ, lượng tối thiểu và yêu cầu đáp ứng đủ một lô.
2. **Cosine Similarity:** đo độ gần của vector query và sản phẩm để lấy top 20 trong nhánh hybrid.
3. **Name Match Coverage:** tính độ phủ tên từ độ giống của từng từ khóa.
4. **Tiered Ranking:** ưu tiên khớp toàn bộ từ khóa → gần khớp toàn bộ → khớp một phần → chưa khớp.
5. **Weighted Scoring:** kết hợp cosine, giá và lượng sau khi xét nhóm và độ khớp tên.
6. **Deterministic Tie Breaking:** khi các tiêu chí bằng nhau, dùng ID để giữ thứ tự ổn định.

Các công thức chính:

- **Cosine:** C = (u · v) / (||u|| × ||v||), với u và v là hai vector. Điểm C được giới hạn trong khoảng 0 đến 1 khi đưa vào điểm kết hợp.
- **Độ phủ tên:** N = tổng độ giống của các từ khóa / số từ khóa. Từ chưa khớp nhận 0, từ khớp chính xác nhận 1.
- **Điểm lượng:** Q = min(lượng lô / lượng cần mua, 1).
- **Điểm giá trong khoảng mong muốn:** P = 1.
- **Giá thấp hơn cận dưới:** P = clamp(1 − (cận dưới − giá lô) / (0,2 × cận dưới)).
- **Giá cao hơn cận trên:** P = clamp(1 − (giá lô − cận trên) / (0,2 × cận trên)).
- **Điểm hybrid:** S = 100 × (0,45C + 0,25P + 0,20Q) / 0,90.
- **Điểm rule only:** S = 100 × (0,40P + 0,35Q) / 0,75.

clamp giới hạn giá trị trong khoảng 0 đến 1. Giá ngoài khoảng mong muốn làm giảm điểm, không mặc định bị loại. Trọng số hybrid sau chuẩn hóa tương đương 50% cosine, 27,8% giá và 22,2% lượng.

Ví dụ hybrid: cosine 0,90; giá trong khoảng nên P = 1; lô đáp ứng 80% lượng nên Q = 0,8. Điểm S khoảng 90,6/100. Lô này chỉ được xét nếu thỏa điều kiện mua một phần và lượng tối thiểu. Tên chỉ khớp một phần vẫn đứng sau tên khớp toàn bộ dù có điểm S cao hơn.

Điểm phù hợp không phải xác suất giao dịch thành công. Khoảng cách, uy tín và tốc độ phản hồi chưa nằm trong công thức hiện tại.

## Nguồn đối chiếu trong dự án

- `supabase/functions/farmer-chat/service.ts` và `handler.ts`: provider, grounding, schema và xác thực.
- `src/features/farmer/assistant/contract.ts`: ngữ cảnh và hợp đồng dữ liệu.
- `src/features/matching/name-match.ts`: chuẩn hóa, so từ và thứ tự khớp tên.
- `src/features/matching/core.ts`: điều kiện, công thức và xếp hạng.
- `src/features/matching/search-service.ts` và `embedding-config.ts`: E5, top 20 và rerank.
- `src/features/farmer/matching/shared-scorer.ts`: rule only trên màn hình Farmer.
- `docs/farmer-chatbot.md` và `docs/openrouter-dashboard-acceptance.md`: phạm vi và kết quả kiểm tra chuyển OpenRouter; không suy ra đã triển khai cloud mới chỉ từ source local.
