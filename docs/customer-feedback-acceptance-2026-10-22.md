# Triển khai phản hồi khách hàng ngày 22 tháng 10 năm 2026

## Kết quả

- Dashboard Farmer chỉ còn một trang Tổng quan, đã bỏ thanh tab. Thời tiết, bản đồ vùng thu mua, điểm đánh giá, vận chuyển và giá tham khảo nằm ngay trên trang này. Bộ lọc, thay đổi địa điểm và danh sách nhu cầu mở rộng trong từng khối. Desktop lớn ba cột, tablet hai cột, điện thoại một cột. Các URL /farmer/prices, /farmer/weather, /farmer/map và query tab cũ đều chuyển về Tổng quan; các query không liên quan vẫn được giữ. Chatbot thành nút biểu tượng nổi mở cửa sổ hiện có.
- Farmer và Buyer có khối đánh giá nhận về: điểm trung bình, số lượt và ba nhận xét gần nhất kèm tên đối tác. RPC chỉ trả thống kê tài khoản đang đăng nhập.
- Chính sách tích hợp từ file HTML khách cung cấp, giữ nguyên 12 mục/ngày cập nhật/liên hệ và dòng cuối trang. Đã đối chiếu 44 khối nội dung với file gốc, không có khác biệt về văn bản. Theo yêu cầu khách, bỏ ghi chú trạng thái tính năng tự thêm khỏi trang chính sách. Trang /policy dùng trước đăng nhập; menu vai trò dùng chung component. Tách thông báo khỏi chính sách.
- Tìm xe từ lô Farmer hoặc thỏa thuận Buyer. Lọc tải trọng/loại/vùng phục vụ/nhiệt độ, xếp theo tải trọng vừa đủ, gửi yêu cầu đến một nhà xe, nhà xe báo cước trọn chuyến hoặc từ chối, chủ yêu cầu chấp nhận/hủy. Server kiểm tra lại nguồn hàng, quyền, xe và trạng thái. Không có thanh toán hoặc giữ chỗ xe tự động.
- Chuông có số chưa đọc, phân trang, đánh dấu đã đọc, liên kết đúng ngữ cảnh; cập nhật mỗi 30 giây khi trang đang hiển thị. Sự kiện giao dịch/vận chuyển sinh thông báo trong transaction. Tin nhắn gom theo hội thoại; hội thoại đang mở được đánh dấu đọc khi trang hiển thị.
- Nguồn hàng/nhu cầu mới có thông báo khi khớp danh mục, thời hạn, lượng và giá nằm trong khoảng mong muốn. Đây là tín hiệu bảo thủ từ điều kiện nghiệp vụ, không khẳng định kết quả E5/top-20. Không đổi thuật toán tìm kiếm hiện có, không thêm khoảng cách.

## Dữ liệu cloud đã thực hiện

Ngày 22/10/2026 đã chạy `node scripts/seed-customer-reviews.mjs --apply` thành công và chạy lại để kiểm tra không tạo trùng. Script dùng thông tin đăng nhập tại tmp/handover-accounts.json (không commit), UUID trong tmp/customer-reviews-manifest.json và các RPC giao dịch hiện hành. Không cần migration mới để tạo đánh giá trong bảng đã có.

| Tài khoản | Đánh giá nhận về mới | Điểm trung bình kiểm tra |
| --- | --- | --- |
| farmer3@logstar.test | 3 | 4,7/5 |
| buyer3@logstar.test | 3 | 5,0/5 |

Ba giao dịch riêng được ghi rõ MẪU ĐÁNH GIÁ và nhận xét ghi rõ Đánh giá mẫu. Lô/nhu cầu riêng được đóng sau hoàn tất; không sửa ba bộ dữ liệu matching bàn giao hoặc giao dịch cũ. Không reset mật khẩu.

## Backend mới và giới hạn triển khai cloud

Migration: supabase/migrations/202610220001_customer_feedback.sql, chạy trong một transaction. Thêm notifications, transport_requests, các RPC có allowlist, RLS theo người nhận/participant và trigger thông báo. Không chạy lại baseline hoặc reset database.

Kiểm tra API thật xác nhận cả ba tài khoản số 3 đăng nhập được. Secret key sẵn có trong .env.local dùng được Data API. OpenAPI và GET xác nhận bảng notifications/transport_requests chưa tồn tại, my_review_summary chưa được cài. Secret/service-role key không phải database password hoặc Supabase Management API token; không thể chạy DDL migration chỉ bằng key Data API này. Phiên trình duyệt Supabase đang ở trang đăng nhập.

Chưa áp migration mới và chưa publish frontend trong đợt này. Để hoàn tất cloud, cần một phiên SQL Editor đã đăng nhập hoặc kết nối PostgreSQL/Management API được cấp sẵn. Sau đó chạy đúng migration mới, kiểm tra lại bằng `npm run check:feedback`, nghiệm thu luồng tìm xe và thông báo với các tài khoản test rồi publish bản frontend đã kiểm thử.

Đã kiểm tra lại khi người dùng báo farmer3 không thấy thông báo: Data API vẫn trả PGRST205 cho notifications và PGRST202 cho my_review_summary. Script `scripts/seed-demo-notifications.mjs` đã xác thực dữ liệu cloud và chuẩn bị 7 thông báo cho đúng farmer3: ba đánh giá nhận từ buyer3, một giao dịch mẫu đã hoàn tất và ba nhu cầu thu mua còn mở phù hợp lô của farmer3. Lượt xem trước không ghi dữ liệu vì bảng chưa được cài. Sau migration chạy `npm run seed:notifications -- --apply`; khóa event_key cố định giữ nguyên trạng thái đã đọc khi chạy lại. Các thông báo đều có nhãn Mẫu và dẫn tới dữ liệu đã xác thực, không tạo lời mời hoặc chuyến xe giả ở trạng thái không tồn tại.

Web Push khi đã đóng website, GPS, thanh toán, ghép nhiều xe, lịch giữ chỗ và tự động tối ưu tuyến không thuộc phạm vi MVP này. Danh sách nguồn hàng lấy tối đa 200 mục gần nhất còn hiệu lực và có ghi giới hạn trên UI.

## Kiểm thử

Sau khi gộp main tại c98447a vào feature/dev-a-features: đã giải quyết bốn conflict, giữ MetricCard/palette/menu mobile Forest Logistics và route /admin/dashboard của main, kết hợp với dashboard không tab, thông báo và vận chuyển của đợt này. Build Vercel gồm 384 unit test/TypeScript/quét artifact đã đạt; 57 E2E trên desktop/mobile và 14 nhóm database cho tính năng mới cũng đạt. Localhost đã được khởi động lại trên cổng 5173. Chưa commit hoặc push phần thay đổi này.

Cập nhật sau khi chốt bỏ tab: TypeScript/build và 33 E2E cho Tổng quan duy nhất, các đường dẫn cũ, mở rộng danh sách nhu cầu tại chỗ, xử lý lỗi nhà cung cấp/WebGL và responsive đã đạt. Chỉ một bản thời tiết/bản đồ được mount trên dashboard; không còn nội dung tab ẩn bị lặp.

- Build và TypeScript đã đạt trong quá trình triển khai; bản build có cảnh báo bundle MapLibre lớn hơn 500 kB như trước.
- Database cục bộ: toàn bộ lệnh npm --prefix supabase/tests test đã đạt: baseline deploy 96, full migrations 99, giao dịch/xóa lô 27, đăng ký 11 và nghiệp vụ mới 14 nhóm kiểm tra. Đã cập nhật bộ kiểm tra RLS để bao phủ 25 bảng và allowlist RPC mới. Bao phủ anonymous/wrong-role, giả mạo nguồn hàng, tải trọng/vùng/loại, chống trùng, báo giá, recheck lúc chấp nhận, hủy, quyền đánh dấu đọc và thống kê đánh giá.
- Năm kiểm tra trình duyệt mới đã đạt: chính sách công khai, dashboard/chatbot/thông báo ở 1440/390/320px và luồng Farmer → Carrier báo giá → Farmer chấp nhận/hủy. API được giả lập, không thay nghiệm thu cloud.
- Unit test: 38 file, 377 kiểm tra đạt. Các lỗi kỳ vọng cũ về trang vận chuyển bị hoãn đã được cập nhật theo chức năng thực tế.
- Hồi quy production: 165/167 đạt ở lượt toàn bộ; hai lỗi là kỳ vọng trang vận chuyển còn bị hoãn và locator lỗi bản đồ trùng giữa tab ẩn/hiện. Đã sửa kiểm thử và chạy lại các màn ảnh hưởng; 17 kiểm tra đạt trong lượt sau, ca lỗi bản đồ chạy riêng đã đạt sau khi giới hạn locator vào vùng đang hiển thị. Đã xem ảnh desktop 1440px và mobile 390px của bố cục cuối; không tràn ngang, chồng lấp hoặc mất thao tác.

## Cách chạy lại

```powershell
npm run build
npm test
npm --prefix supabase/tests run test:customer-feedback
npm run test:system -- --project=production
npm run seed:reviews
# Chỉ khi cần ghi dữ liệu mẫu trên đúng project đã kiểm tra
npm run seed:reviews -- --apply
npm run check:feedback
npm run seed:notifications
# Sau khi áp migration và kiểm tra đúng project
npm run seed:notifications -- --apply
```

Script kiểm tra cloud chỉ in trạng thái/codes, không in key, JWT hoặc mật khẩu. Trên môi trường sandbox hạn chế mạng/cổng localhost, các kiểm tra cloud và Playwright cần quyền kết nối phù hợp.
