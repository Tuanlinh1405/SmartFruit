# Kế hoạch triển khai phản hồi khách hàng ngày 22 tháng 10 năm 2026

Tài liệu chốt phạm vi và thứ tự thực hiện sau khi người dùng trả lời năm câu hỏi làm rõ. Đây là kế hoạch triển khai; chưa phải biên bản đã sửa hoặc đã deploy. Không còn câu hỏi bắt buộc trước khi bắt đầu phát triển trong phạm vi dưới đây.

## 1. Phạm vi đã chốt

- Dashboard Nhà vườn đưa các tiện ích vào Tổng quan, thu nhỏ để xem được nhiều thông tin cùng lúc. Giữ thao tác mở chi tiết khi cần.
- Chatbot thu thành biểu tượng mở cửa sổ hội thoại, sử dụng trợ lý hiện có.
- Tạo một vài đánh giá mẫu cho farmer3 và buyer3 bằng dữ liệu giao dịch mẫu hợp lệ.
- Triển khai thông báo cho sự kiện có ích, ưu tiên yêu cầu người dùng xử lý hoặc thay đổi kết quả giao dịch.
- Tích hợp nội dung file policy.html do người dùng cung cấp thành trang chính sách trong ứng dụng.
- Tìm xe ở mức tối thiểu, dùng xe và hồ sơ nhà xe hiện có; cách chọn nguồn hàng, lọc, xếp hạng và giải thích kết quả tương tự matching Buyer–Farmer.

Nguồn yêu cầu: WEBSITE .docx và phản hồi trực tiếp của người dùng. File HTML là nguồn nội dung chính sách và tham khảo trình bày; các mô tả tính năng trong đó không tự mở rộng phạm vi phát triển.

## 2. Hiện trạng làm cơ sở

| Phần | Có thể tận dụng | Phần cần bổ sung |
| --- | --- | --- |
| Dashboard | FarmerDashboard, thống kê lô, WeatherCard, BuyingAreasCard, trợ lý | Bố cục Tổng quan, phiên bản thẻ gọn, đánh giá và vận chuyển |
| Đánh giá | trade_reviews, API và RPC giao dịch, màn đánh giá | Tổng hợp điểm nhận được, tên người đánh giá trong phạm vi được phép, seed mẫu |
| Dữ liệu bàn giao | scripts/seed-handover-data.mjs định nghĩa farmer3, buyer3, carrier3 và ba bộ lô/nhu cầu/xe | Kiểm tra tài khoản thực và manifest trước khi ghi; thêm giao dịch mẫu cho đánh giá |
| Thông báo | Chuông và Drawer | Lưu thông báo, sự kiện server, trạng thái đã đọc, điều hướng, cập nhật |
| Tìm xe | vehicles, carrier_profiles, CRUD phương tiện, form và giao diện matching | Projection xe cho người tìm, yêu cầu vận chuyển, kết nối nhà xe và báo giá |
| Chính sách | Route chính sách đang là placeholder, shell và font hiện có | Trang dùng chung, mục lục, liên kết công khai và theo vai trò |

Đây là đánh giá từ mã nguồn và tài liệu trong repository, chưa xác nhận trạng thái cloud trong lượt lập kế hoạch này. Script bàn giao có định nghĩa tài khoản không đồng nghĩa tài khoản và dữ liệu chắc chắn đang tồn tại trên cloud.

## 3. Dashboard và chatbot

Tổng quan dùng hàng thống kê gọn, bên dưới là các thẻ: kết nối/nhu cầu phù hợp, đánh giá giao dịch, thời tiết, bản đồ vùng thu mua và vận chuyển. Các thẻ danh sách hiển thị vài mục gần nhất cùng nút xem tất cả; số tổng được truy vấn riêng, không suy ra từ danh sách bị giới hạn.

- Hiển thị thời tiết tóm tắt và bản đồ gọn ngay trong Tổng quan, tái sử dụng nguồn dữ liệu, cache, attribution và xử lý lỗi hiện có.
- Không bắt người dùng đổi tab để xem thông tin chính. Các URL tab cũ vẫn dẫn đến tiện ích tương ứng để tránh mất liên kết.
- Điểm đánh giá là trung bình đánh giá nhận được, kèm số lượt; hiển thị tối đa ba nhận xét mới nhất. Không có đánh giá thì ghi rõ, không mặc định 4.9.
- Thẻ vận chuyển hiển thị yêu cầu gần nhất, số báo giá và cước nhà xe thực sự đã báo. Chưa có báo giá thì ghi “Chờ báo giá”; giá tham khảo nông sản không bị đổi thành cước xe.
- Chatbot dùng nút biểu tượng có tên truy cập được, mở cửa sổ bằng bàn phím, hỗ trợ Escape và trả focus về nút khi đóng. Tái sử dụng state và luồng gọi trợ lý hiện có.
- Desktop ưu tiên xem tổng hợp trong một trang; điện thoại xếp dọc và cho cuộn, không ép nội dung vào một màn hình gây khó đọc.

Tệp chính dự kiến: src/features/farmer/dashboard/FarmerDashboard.tsx, dashboard.css, WeatherCard.tsx, BuyingAreasCard.tsx và src/features/farmer/assistant/farmer-assistant.tsx. Chỉ bổ sung các phần tóm tắt cần thiết vào dashboard Buyer để buyer3 cũng xem được đánh giá nhận về.

## 4. Đánh giá mẫu farmer3 và buyer3

Mở rộng script bàn giao bằng manifest riêng cho giao dịch đánh giá. Xác định đúng farmer3@logstar.test và buyer3@logstar.test qua đăng nhập/UUID/role; hiểu “famer3” trong phản hồi là farmer3 theo bộ dữ liệu đã có, không tạo thêm một danh tính sai chính tả.

- Tạo ba giao dịch mẫu riêng và đánh giá hai chiều, tức tối đa sáu nhận xét. Điểm 4–5 sao và nội dung ngắn, có nhãn “Đánh giá mẫu”. Điểm hiển thị do dữ liệu quyết định.
- Thực hiện đúng luồng kết nối, chấp nhận, đề nghị, thỏa thuận, hai bên hoàn tất rồi đánh giá qua RPC hiện có.
- Dùng lô/nhu cầu dành riêng cho giao dịch mẫu; giữ ba bộ lô/nhu cầu mở hiện có để vẫn trình diễn matching.
- Chạy lại script không nhân bản đánh giá, không reset mật khẩu, không sửa đánh giá cũ và không đánh dấu hoàn tất giao dịch thật.
- Chỉ hai bên giao dịch xem được nhận xét theo quyền hiện hành. Không biến nhận xét thành nội dung công khai trong đợt này.

## 5. Thông báo

Mặc định đợt này là thông báo trong website: chuông, số chưa đọc, danh sách có phân trang, đánh dấu đã đọc và liên kết đến đúng ngữ cảnh. Khi quay lại website, người dùng vẫn thấy các thông báo chưa đọc. Ít dữ liệu chỉ làm ít sự kiện, không cản trở triển khai.

| Sự kiện | Người nhận | Cách hiển thị |
| --- | --- | --- |
| Lời mời kết nối mới, chấp nhận/từ chối/hủy | Đối tác liên quan | Mở lời mời hoặc hội thoại |
| Tin nhắn mới | Người nhận | Gom theo hội thoại; hạn chế báo khi đang đọc đúng hội thoại |
| Đề nghị mới, được chấp nhận/từ chối/rút | Bên còn lại | Mở đề nghị |
| Cần xác nhận hoàn tất, hai bên đã hoàn tất, có đánh giá mới | Bên liên quan | Mở thỏa thuận hoặc đánh giá |
| Nhu cầu thu mua mới phù hợp lô đang công bố | Farmer liên quan | Gom theo nhu cầu và tài khoản; mở kết quả matching |
| Lô mới phù hợp nhu cầu đang mở | Buyer liên quan | Gom theo lô và tài khoản; mở kết quả matching |
| Yêu cầu xe mới, nhà xe nhận/từ chối, báo giá mới, chấp nhận/hủy | Người yêu cầu hoặc nhà xe liên quan | Mở yêu cầu vận chuyển |

Không phát thông báo cho chính tác giả sự kiện. Không gửi lại mỗi lần tải trang. Thông báo matching chỉ phát khi có nguồn mới hoặc thay đổi đáng kể làm xuất hiện kết quả phù hợp; dùng quy tắc hiện có và điều kiện trạng thái/thời hạn. Thông báo không thay đổi thuật toán matching Buyer–Farmer.

Thiết kế lưu notifications có recipient_id, loại sự kiện, khóa chống trùng, tham chiếu đối tượng, created_at và read_at. Tạo sự kiện trực tiếp trong nghiệp vụ server; phần matching xử lý qua tác vụ server có lưu tiến độ và chống trùng. Người dùng chỉ đọc và đánh dấu thông báo của mình, không tự tạo thông báo cho người khác. Không đưa nội dung chat hoặc dữ liệu riêng tư vào payload ngoài phạm vi quyền người nhận.

Giao diện tải khi mở chuông, khi quay lại cửa sổ và cập nhật khoảng 30 giây khi trang đang hiển thị. Dừng polling khi trang bị ẩn. Thông báo hệ điều hành khi đã đóng website là phần mở rộng Web Push, chưa nằm trong đợt tối thiểu này.

## 6. Chính sách

Tích hợp nội dung bài chính sách từ policy.html vào component React dùng shell, kiểu chữ và màu ứng dụng. Không nhúng nguyên trang HTML vì sẽ lặp sidebar và tạo CSS toàn cục xung đột.

- Có trang /policy đọc được trước đăng nhập; liên kết từ đăng nhập, đăng ký và menu từng vai trò. Các URL chính sách hiện có dùng cùng component.
- Giữ nội dung 12 mục, ngày cập nhật 22/10/2026 và thông tin liên hệ do khách cung cấp; thêm mục lục điều hướng theo mục và liên kết điện thoại/email.
- Tách mục thông báo và chính sách ở những menu đang gộp hai chức năng; chuông luôn mở trung tâm thông báo.
- Không tự thêm điều khoản, cơ chế thu thập dữ liệu hoặc tính năng chỉ vì file HTML có nhắc đến.

File nguồn có mô tả IoT/tracking, AI giá/dự báo và matching theo khoảng cách vượt quá chức năng hiện có. Khi tích hợp, ghi rõ trạng thái khả dụng bên cạnh các mô tả tính năng này để tránh trình bày như đang vận hành. Nội dung khách cung cấp được phân biệt với kết quả rà soát pháp lý; kế hoạch này không xác nhận tính phù hợp pháp luật của chính sách.

## 7. Tìm xe tối thiểu

### Luồng sử dụng

1. Farmer chọn lô của mình, hoặc Buyer chọn thỏa thuận mình tham gia; điền lượng vận chuyển, điểm lấy/giao ở mức tỉnh và địa chỉ, ngày dự kiến, loại xe và nhiệt độ nếu có.
2. Xem xe phù hợp từ dữ liệu đã đăng. Kết quả gồm loại xe, tải trọng, vùng phục vụ, đơn vị vận chuyển và lý do phù hợp.
3. Chọn xe và gửi yêu cầu. Nhà xe xem yêu cầu được gửi cho mình, nhận hoặc từ chối, và nhập báo giá theo chuyến.
4. Người yêu cầu chấp nhận báo giá hoặc hủy yêu cầu. Hai bên xem được điều kiện đã thống nhất; cước xuất hiện ở Tổng quan.

MVP mỗi yêu cầu gắn một xe, một nhà xe, một báo giá hiện hành. Không gửi đồng thời nhiều yêu cầu còn hoạt động cho cùng một nhu cầu vận chuyển; muốn chọn xe khác thì hủy yêu cầu trước. Báo giá sau khi chấp nhận lưu thành snapshot và không được sửa trực tiếp.

### Ghép xe

- Điều kiện bắt buộc: xe active, nhà xe không bị khóa, tải trọng đủ, loại xe đáp ứng, vùng phục vụ bao phủ nơi lấy và giao đã chọn; nhiệt độ yêu cầu nằm trong khoảng xe hỗ trợ nếu cần xe lạnh.
- Thông tin bắt buộc bị thiếu được yêu cầu bổ sung hoặc loại khỏi kết quả có cam kết phù hợp, không suy ra dữ liệu thuận lợi.
- Trong nhóm đủ điều kiện, ưu tiên tải trọng vừa đủ để giảm dư tải, sau đó dùng thứ tự ổn định. Hiển thị lý do và các trường thực tế thay vì điểm “AI” không có cơ sở.
- Không dùng giá để xếp hạng trước khi có báo giá; không suy ra xe còn trống vào ngày lấy chỉ từ active. Giao diện ghi rõ lịch xe cần nhà xe xác nhận.
- Tận dụng component chọn lô, bộ lọc, danh sách kết quả, trạng thái tải/lỗi/rỗng và mẫu giải thích matching. Dùng bộ chấm phù hợp xe riêng; không áp điểm tên nông sản/E5 vào phương tiện.

### Backend và quyền

Thêm migration cho transport_requests và các RPC gửi, phản hồi/báo giá, chấp nhận và hủy. Bản ghi giữ tham chiếu nguồn hàng, chủ yêu cầu, carrier_id, vehicle_id, thông tin lấy/giao, lượng/ngày, báo giá và trạng thái. Một bảng đủ cho phạm vi một báo giá hiện hành; chỉ thêm lịch sử riêng khi cần kiểm toán các thay đổi.

Không tái sử dụng trực tiếp trade_connections: RPC và schema hiện ràng buộc Buyer/Farmer. Tái sử dụng mô hình kiểm tra participant/trạng thái và UI, bổ sung nghiệp vụ vận chuyển riêng.

Xe hiện có RLS chỉ cho chủ xe đọc. Bổ sung RPC tìm xe trả projection giới hạn cho Farmer/Buyer: không công khai toàn bộ hồ sơ hoặc cấp SELECT toàn bảng. Quyền trên yêu cầu chỉ cho chủ yêu cầu và nhà xe được chỉ định; server tự xác định chủ xe từ vehicle_id và kiểm tra lại mọi điều kiện lúc gửi/chấp nhận. Chủ nguồn hàng, vai trò và trạng thái được kiểm tra server, không tin thông tin client truyền lên.

Lịch xe được nhà xe xác nhận thủ công trong MVP. Chấp nhận báo giá không được hiển thị như bảo đảm tự động giữ chỗ xe. GPS, tracking, thanh toán, tối ưu tuyến, ghép nhiều xe và API hãng vận tải nằm ngoài đợt này.

## 8. Thứ tự thực hiện và nghiệm thu

| Đợt | Công việc | Điều kiện hoàn thành |
| --- | --- | --- |
| 1 | Dashboard gọn, chatbot, trang chính sách | Các tiện ích xuất hiện ở Tổng quan; mở/đóng chatbot; chính sách truy cập trước/sau đăng nhập; URL cũ hoạt động |
| 2 | Tổng hợp đánh giá và script mẫu | farmer3/buyer3 có ba đánh giá nhận về mỗi bên; điểm đúng; chạy lại seed không tăng số bản ghi |
| 3 | Tìm xe tối thiểu | Dùng được xe carrier3 đã có; tìm → gửi → báo giá → chấp nhận/hủy hoạt động giữa các vai trò |
| 4 | Thông báo chung và nối sự kiện | Sự kiện giao dịch/vận chuyển/matching tạo đúng thông báo; số chưa đọc và điều hướng đúng; không trùng hoặc lộ dữ liệu |
| 5 | Kiểm thử tổng thể và bàn giao | Build/typecheck đạt, kiểm thử quyền và luồng chính đạt, giao diện desktop/mobile được xem trực tiếp |

Có thể chuẩn bị schema thông báo cùng migration vận chuyển ở đợt 3 để nối sự kiện trong cùng transaction; thứ tự trên là thứ tự hoàn tất tính năng, không yêu cầu trì hoãn thiết kế backend.

Kiểm thử tập trung vào rủi ro nghiệp vụ: đánh giá chỉ sau hoàn tất; người thứ ba không đọc được; giả mạo chủ yêu cầu/nhà xe bị từ chối; xe thiếu tải/ngừng hoạt động không thể gửi hoặc nhận sai; thao tác chấp nhận/hủy lặp hoặc đồng thời không phá trạng thái; thông báo chỉ người nhận được đọc/đánh dấu; matching không báo lặp. Kiểm tra 1440px và 390px, cùng kiểm tra không tràn ở 320px.

Migration mới phải được thử trên database kiểm thử trước khi áp cloud; không chạy lại baseline hoặc reset dữ liệu chung. Kiểm tra tài khoản, quyền triển khai và cấu hình hiện có ở đầu giai đoạn thực hiện. Nếu thiếu credential thì hoàn tất phần local và ghi rõ phần cloud chưa thực hiện, không mô phỏng deploy thành công.

Đợt lập kế hoạch chỉ tạo tài liệu này. Chưa sửa ứng dụng, seed đánh giá, áp migration hoặc deploy.
