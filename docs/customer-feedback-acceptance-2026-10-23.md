# Nghiệm thu feedback khách hàng 23/10/2026

## Phạm vi đã triển khai

- Giữ thiết kế Forest Logistics; bỏ breadcrumb và giới thiệu dư thừa cho Farmer/Buyer. Menu bỏ Thông báo nhưng chuông và URL cũ vẫn hoạt động. Thêm Dự báo giá cho cả hai vai trò.
- Dashboard: thống kê nhỏ gọn; bản đồ mật độ theo tỉnh ở phía trên khối kết nối. Farmer dùng nhu cầu thu mua còn mở/hạn; Buyer dùng lô đang công bố/còn hạn. Điểm đại diện tỉnh không phải GPS riêng. Điểm đánh giá dùng năm sao vàng có phần lẻ, không đưa bình luận dài lên dashboard; nút chatbot có nhãn Trợ lý.
- Lô hàng và yêu cầu thu mua có nhãn và vạch màu trạng thái. Yêu cầu, kết quả tìm lô và matching bố cục ngang trên desktop, xếp dọc khi hẹp. Không hiển thị E5/cosine/công thức trên giao diện; thuật toán và điểm giữ nguyên.
- Form lô: combobox tìm không dấu theo danh mục loại/giống, dùng được bằng bàn phím và chuột; nhập tự do chưa chọn mục hợp lệ không lưu. Mỗi lô một loại/giống, giữ thông tin danh mục cũ khi sửa.
- Trang đánh giá: Chưa đánh giá / Đã đánh giá, mỗi giao dịch có form trực tiếp. Chỉ giao dịch hai bên xác nhận hoàn tất mới được chấm, mỗi bên chấm một lần.
- Hồ sơ thương lái: bốn khối cơ bản/liên hệ/pháp lý/minh chứng theo ảnh tham chiếu, thêm người đại diện; cam đoan trước lưu, Hủy khôi phục bản đã lưu. Trạng thái luôn Chưa xác minh, chưa có quy trình admin duyệt.
- Lưu tên hiển thị + hồ sơ + danh sách ảnh qua RPC transaction. Ảnh riêng tư JPG/PNG, 5 MB/ảnh, tối đa 10 ảnh, có xem trước/nhãn/xóa, cleanup ảnh tạm. Các trường cũ vẫn đọc được; lưu theo form mới yêu cầu đủ trường bắt buộc. Cập nhật tên trong AuthProvider không làm mất thông báo lưu.
- Dự báo giá: giao diện dùng chung, bộ lọc và biểu đồ giá lịch sử/dự báo nét đứt, bảng giá, nhận định và thời điểm tham khảo. Toàn bộ giá là mẫu cố định ngày 23/10/2026, chưa có dự báo thật.
- Carrier tracking: hai chuyến mẫu, tuyến/xe/ETA/cảm biến mô phỏng, chạy/tạm dừng/đặt lại. MapLibre/Leaflet dùng cùng nguồn nền bản đồ với dashboard; lỗi nền vẫn có tuyến và thông tin dạng chữ.
- Đánh giá tài xế: hai tài xế, ba nhận xét mẫu 4–5 sao; chưa gửi đánh giá tài xế thật.
- Chính sách: giữ nguyên 12 mục đã đối chiếu file khách cung cấp.

## Supabase và dữ liệu trình diễn

- Người dùng tự áp `supabase/migrations/202610230001_buyer_evidence.sql`. Đã kiểm tra cloud có các cột mới, bảng buyer_evidence và bucket buyer-evidence riêng tư, giới hạn 5 MB.
- Đã xác nhận notifications/transport_requests và RPC summary sẵn sàng trước khi seed.
- `node scripts/seed-carrier-feedback.mjs` là dry run; thêm `--apply` để tạo ba yêu cầu [MẪU] cho carrier3, từ farmer3/buyer3. Script xác thực đúng project/tài khoản và dùng ID cố định theo batch. Đã chạy apply hai lần: lần đầu tạo PENDING/QUOTED/ACCEPTED, lần hai giữ nguyên ba bản ghi, không thêm trùng.
- `node scripts/check-feedback23-browser.mjs`: đọc giao diện localhost với ba tài khoản thật, chờ thống kê/bản đồ mount; cả ba đăng nhập được, không lỗi JavaScript, carrier3 thấy đủ ba yêu cầu mẫu, Buyer form mới tải được.
- `node scripts/check-business-storage-live.mjs`: upload một PNG kiểm thử tạm không gắn vào hồ sơ, chủ tài khoản ký/tải được; Farmer và khách chưa đăng nhập bị chặn; RPC không có cam đoan bị chặn. Ảnh tạm đã được xóa. Không thay thông tin pháp lý của buyer3 bằng dữ liệu giả.

## Kiểm thử

- Unit: 387/387, 40 file; kiểm tra riêng matching sau thay đổi hiển thị cuối cùng cũng đạt.
- Database: npm run test:database đạt toàn bộ: 96 deploy + 99 migration/schema + 27 trading/deletion + 11 registration + 14 feedback + 8 nhóm hồ sơ doanh nghiệp. PGlite kiểm tra transaction, ownership, RLS và không lộ trường pháp lý vào marketplace_profiles.
- Browser: 67 tình huống liên quan đều đã đạt sau sửa lỗi. Lượt tổng đạt 66/67; một lỗi màu Đã đóng đã được sửa và chạy lại 7/7 tình huống liên quan, gồm cả lỗi bản đồ và lưu ảnh. Log nghiệm thu ở tmp/feedback23-browser-acceptance.log và tmp/feedback23-final-fixes.log.
- Build/typecheck cuối cùng đạt với cấu hình thật; đã quét dist theo mẫu secret và so trực tiếp với secret key/OpenRouter key trong môi trường, không có thông tin bí mật trong bundle.
- Responsive: 1440/768/390/320; upload lỗi giữ thông tin, thử lại và tải lại được minh chứng; Hủy bỏ sửa chưa lưu; điều kiện đánh giá và chống trùng; chuông thông báo; bản đồ lỗi và WebGL không khả dụng có fallback.

## Giới hạn và bàn giao

- Carrier / Theo dõi chuyến: nút đỏ Báo cáo sự cố chuyến đi mở biểu mẫu loại sự cố và mô tả bắt buộc. Ghi nhận báo cáo mẫu theo chuyến trong bộ nhớ màn hình; chưa gửi đến đối tác/hỗ trợ hoặc lưu database. Browser test kiểm tra gửi, chuyển chuyến, Hủy và modal ở 1440/768/390/320 đạt.

- Bổ sung theo ảnh nguồn cung: Tổng quan buyer dùng các thẻ gọn, tự chia cột theo màn hình; vạch trái màu cam cho Mít, vàng cho Sầu riêng, hồng đỏ cho Thanh long. Giữ số lô, tổng lượng và khoảng giá chào bán từ RPC hiện có. Kiểm thử trình duyệt 1440/768/390/320 không tràn ngang; build/typecheck đạt.

- Dự báo giá, GPS/ETA/cảm biến và đánh giá tài xế đều là minh họa; không tạo booking hoặc cập nhật giao dịch thật.
- Chưa có xác minh pháp lý, GPS trực tiếp hay nguồn giá thị trường.
- Chưa commit, push hoặc deploy. Thay đổi chính sách còn có từ đợt trước được giữ nguyên trong workspace.

## Bổ sung thẻ Người mua phù hợp theo ảnh khách nhắc lại

- Thẻ hai hàng: avatar chữ viết tắt và tên người mua/khu vực công khai; loại quả/tên nhu cầu; ba cột lượng nhập, giá nhập, thời gian nhập; badge phần trăm phù hợp. Footer có chip yêu cầu chất lượng/đóng gói và Xem chi tiết / Nhắn tin / Gửi đề nghị.
- Không thêm ảnh đại diện hoặc khoảng cách giả, không hiển thị E5/cosine/công thức. Yêu cầu chất lượng là nội dung người mua khai báo, không coi là chứng nhận đã xác minh.
- Xem chi tiết mở modal từ dữ liệu nhu cầu công khai, không ghi dữ liệu. Nhắn tin/Gửi đề nghị dùng luồng kết nối hiện có: đã ACCEPTED thì mở đúng hội thoại và focus ô tương ứng; chưa chấp nhận thì chuyển tới lời mời kèm thông báo chờ phản hồi. Không tự chấp nhận lời mời hay tự gửi tin nhắn/giá.
- Không đổi thuật toán/điểm matching, không có migration mới. Query nhu cầu bổ sung các trường công khai quality_requirements, packaging_options, notes.
- Kiểm thử bổ sung: 24 unit test và 11 browser test đạt, gồm bố cục 1440/768/390/320, chi tiết không tạo lời mời, kết nối không trùng và giao dịch hai chiều tới đánh giá. Build/typecheck đạt.
