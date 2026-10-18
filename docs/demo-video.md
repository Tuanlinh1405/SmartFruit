# Kịch bản video E2E SmartFruit trên Supabase thật

Đã quay ngày 18/10/2026: video MP4 dài 5 phút 16 giây, gồm phần giới thiệu và 21 chương nghiệp vụ, chú thích tiếng Việt, không lồng tiếng. Giao diện ứng dụng local kết nối Supabase thật, không dùng API mock.

## Kết quả quay

- Video: `tmp/smartfruit-demo-video-final/SmartFruit-E2E-Live-2026-10-18.mp4`.
- Mục lục thời gian và giới hạn: `tmp/smartfruit-demo-video-final/Muc-luc.md`.
- Xác minh cloud sau quay: thỏa thuận COMPLETED, 2 tin nhắn, 2 đánh giá, 1 ảnh đã lưu; xe phụ đã xóa và các tài khoản test đều không bị khóa.
- Chatbot đã phản hồi từ backend thật trên origin `http://localhost:5173` được cloud cho phép.
- Giới hạn ghi nhận: xóa lô phụ bị backend từ chối. Video giữ nguyên lỗi, không coi thao tác này là đã nghiệm thu thành công. Các tiện ích vận chuyển/tracking/giá/thời tiết/bản đồ/thông báo còn minh họa được ghi rõ trong từng chương.

## Điều kiện trước khi quay

- Cần tài khoản test có mật khẩu và vai trò FARMER, BUYER, CARRIER, ADMIN. File `tmp/test-accounts.json` từ script seed hiện có được hỗ trợ; không commit hoặc đưa mật khẩu/backend key lên video.
- Dùng hai phiên trình duyệt tách biệt cho Farmer và Buyer. Kiểm tra đăng nhập và role trước khi bật ghi hình.
- Chỉ tạo và thao tác bản ghi mang tiền tố `[VIDEO DEMO]` thuộc các tài khoản test. Không chạy migration hoặc reset dữ liệu dùng chung.
- Dùng khoảng ngày thu hoạch/thu mua giao nhau, bắt đầu sau ngày quay. Chọn loại/giống từ catalog hiện hành.
- Chatbot cần Edge Function và cấu hình inference hoạt động. Nếu không có, ghi rõ phần chưa demo được thay vì dùng câu trả lời giả.

## Các chương

| Chương | Nội dung quay | Bằng chứng trên màn hình |
| --- | --- | --- |
| 1. Đăng nhập và phân quyền | Đăng nhập các vai trò; thử đường dẫn Admin bằng Farmer; đăng xuất | Đúng workspace, không tự cấp quyền, mất quyền truy cập sau đăng xuất |
| 2. Hồ sơ Farmer | Lưu hồ sơ nhà vườn và tải lại | Dữ liệu đã lưu còn sau F5 |
| 3. Lô hàng và ảnh | Tạo nháp, sửa thông tin, upload ảnh, lưu giá sàn/ghi chú riêng, công bố lô | Trạng thái nháp/đã đăng, ảnh lưu thành công; không đưa giá sàn vào màn hình Buyer |
| 4. Buyer và nhu cầu | Lưu hồ sơ, tạo/sửa/công bố nhu cầu thu mua | Nhu cầu thật và trạng thái còn sau F5 |
| 5. Matching hai phía | Buyer tìm lô theo nhu cầu; Farmer chọn lô tìm Buyer | Lô vừa tạo xuất hiện, lượng mua một phần và lý do matching hiển thị; ghi rõ rule-only nếu hybrid chưa deploy |
| 6. Kết nối và thỏa thuận | Gửi lời mời, phía còn lại đồng ý; chat hai chiều; rút/từ chối một đề nghị; chấp nhận đề nghị cuối | Đúng cùng `connectionId`, tin nhắn còn sau F5, điều kiện thống nhất giống nhau ở hai phía |
| 7. Hoàn tất và đánh giá | Một bên xác nhận trước, bên còn lại xác nhận sau; cả hai lưu đánh giá | Một xác nhận chưa mở đánh giá; hai xác nhận chuyển COMPLETED; mỗi bên đánh giá một lần |
| 8. Trợ lý nhà vườn | Chọn cây/chủ đề, gửi câu hỏi, xem nguồn, bổ sung câu hỏi, xóa hội thoại | Phản hồi từ backend thật và thông tin nguồn; không đọc câu trả lời như chẩn đoán chuyên môn |
| 9. Carrier | Lưu hồ sơ nhà xe; thêm/sửa/ngừng/kích hoạt/xóa một xe demo | Thay đổi lưu thật, còn sau F5; Carrier không mở được trang Farmer |
| 10. Admin | Tổng quan; tìm/lọc người dùng; chi tiết/sửa hồ sơ test; khóa rồi mở lại tài khoản test; xem thị trường và thỏa thuận; đóng một tin phụ | Thao tác quản trị thành công; không hiển thị nội dung chat riêng hoặc giá sàn |
| 11. Tiện ích minh họa và mobile | Vận chuyển/báo giá/tracking demo, giá/thời tiết/bản đồ/thông báo demo; mở một luồng chính ở chiều rộng điện thoại | Ghi rõ MINH HỌA trên đoạn video; không gọi là tích hợp vận tải/GPS/thanh toán thật |
| 12. Kết thúc | Hiển thị giao dịch hoàn tất, dữ liệu demo và các giới hạn triển khai | Phân biệt phần đã chạy thật, phần minh họa, phần chưa khả dụng |

## Dữ liệu mẫu thống nhất

- Lô: `[VIDEO DEMO] Sầu riêng Ri6`, 5 tấn, 65.000 đ/kg.
- Nhu cầu: 10 tấn, 60.000–70.000 đ/kg, cho phép mua một phần.
- Đề nghị được chấp nhận: 2 tấn, 65.000 đ/kg, ngày lấy hàng nằm trong cả hai khoảng ngày.
- Chỉ đóng tin phụ sau khi quay giao dịch; không đóng/xóa lô đang cần để chấp nhận đề nghị.

## Đầu ra và kiểm tra

- Xuất MP4 có tiêu đề chương và chú thích tiếng Việt; kèm mục lục thời gian, ghi rõ ngày quay và môi trường.
- Kiểm tra các đoạn đầu/giữa/cuối, chữ không bị cắt, không lộ mật khẩu/token/secret hoặc dữ liệu người dùng ngoài phạm vi test.
- Bản ghi không có tài khoản hoặc chưa thực hiện trên cloud không phải bằng chứng demo live.
- Cuối buổi mở lại mọi tài khoản đã khóa tạm. Giữ lịch sử giao dịch demo có nhãn; không xóa cưỡng bức lịch sử hoặc sửa dữ liệu không thuộc lượt quay.
