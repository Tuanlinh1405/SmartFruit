# Trạng thái triển khai

## OpenRouter và Tổng quan Farmer — cập nhật 19/10/2026

Đã thay adapter Gemini bằng OpenRouter Free; giữ JWT/role/CORS, không paid fallback. Tổng quan Farmer có thời tiết Open-Meteo theo hồ sơ/chọn địa điểm và bản đồ Leaflet/OpenStreetMap từ nhu cầu thu mua thật. Không migration, không đổi matching hoặc Carrier. Xem [hướng dẫn](farmer-dashboard-live.md), [cấu hình trợ lý](farmer-chatbot.md) và [kết quả kiểm thử/deploy của đợt này](openrouter-dashboard-acceptance.md). Nghiệm thu trước đây bên dưới là ảnh chụp trước đợt tích hợp này.

## Nghiệm thu ngày 19/10/2026

Trạng thái và bằng chứng mới nhất nằm trong [biên bản nghiệm thu trước bàn giao](handover-acceptance-2026-10-19.md). Farmer CRUD lô/ảnh và Carrier CRUD xe đã dùng dữ liệu thật. Buyer E5 hybrid đã được kiểm tra trên cloud; màn hình matching Farmer hiện dùng rule-only. Không dùng các ghi chú chưa deploy/chưa thực hiện của bản chụp 15/10 bên dưới để suy ra trạng thái hiện tại. Đăng ký email đã bổ sung và RPC đã cài; người dùng đã xác nhận nhận/xác nhận email và vào đúng vai trò trên cloud ngày 19/10.

## Bản chụp và quyết định ngày 15/10/2026

Yêu cầu hiện hành: dùng tài khoản test email/mật khẩu, chuyển tính năng đang mô phỏng sang dữ liệu thật; hoãn các tích hợp bên ngoài như vận chuyển. OTP và đăng ký demo đã bỏ.

Cập nhật 19/10/2026: bổ sung đăng ký email/mật khẩu thật theo yêu cầu mới, cho Farmer/Buyer/Carrier; xem [luồng đăng ký và migration cần áp dụng](registration.md). SMS OTP vẫn chưa triển khai. Kết quả local/mock không thay thế nghiệm thu email xác nhận và cấp role trên cloud.

## Tích hợp UI Dev A

Đã lấy nền từ PR #2 `Feature/UI skeleton` (commit `47d988a`) và ghép Auth/Buyer/Admin/giao dịch/workspace thật vào shell chung trên nhánh `Linh`. Giữ các đường dẫn cũ, thêm menu/route theo PR; sau khi gộp tên nông sản, 91 test và build đạt. Chi tiết, ảnh và giới hạn QA tại [biên bản tích hợp UI](ui-integration.md). Chưa merge PR UI trên GitHub.

## Quyết định matching mới nhất

Quyết định mới nhất ngày 15/10/2026: trước mắt matching chỉ xét **tên/loại/giống sản phẩm, khối lượng và giá**. Hoãn map, API địa chỉ, tọa độ, khoảng cách và điểm ưu tiên theo tỉnh. Các trường tỉnh/huyện/địa chỉ vẫn được lưu và hiển thị để tham khảo; thay đổi khu vực không lọc ứng viên hoặc thay đổi điểm/thứ hạng. Thời gian giao nhau và trạng thái tin vẫn là điều kiện khả dụng.

Core dùng `ruleVersion = e5-top20-name-rerank-v2`. Quyết định tiếp theo: **E5 embed query → pgvector lấy top 20 cosine → rerank đúng 20 ứng viên bằng khớp từ/gần đúng → xét giá/lượng**. Không union thêm lexical/graph; không lấy ứng viên thứ 21 để bù sau khi loại kết quả. Loại/giống đã chỉ định vẫn phải khớp, trạng thái/ngày và điều kiện lượng được kiểm tra trước retrieval và sau khi đọc bản ghi.

Đã chốt giữ `intfloat/multilingual-e5-base` 768 chiều, không dùng Qwen. Đã code reranker chung cho Buyer/Farmer: chuẩn hóa tiếng Việt, token chính xác, lỗi gõ/hoán đổi ký tự nhỏ, giữ phân biệt mã giống có số, loại trừ bằng một số cụm từ rõ. Tên khớp toàn bộ đứng trên gần khớp, rồi khớp một phần; sau đó mới xét điểm cosine/giá/lượng. Tên chuẩn lấy từ catalog, không viết cứng danh sách giống. Chi tiết và giới hạn: [E5 top 20 + rerank](matching-e5-top20.md).

Fallback trên web dùng so từ mới và điểm giá/lượng theo tỷ lệ 40:35 chuẩn hóa về 100. Nhánh E5 dùng cosine/giá/lượng theo tỷ lệ 45:25:20, chuẩn hóa về 100, sau mức khớp tên. Kết quả trả cosine gốc, không phải xác suất. Kết quả [Kaggle trước đây](benchmarks/kaggle-qwen-12-cases/README.md): E5-base 9/10, Qwen 8/10 trên mẫu nhỏ, chưa đo reranker mới với model thật.

Đã có migration `202610150003_vector_top20.sql` và Edge Function gọi hai RPC mới; **chưa áp migration này lên cloud, chưa deploy inference/worker/Edge Function hoặc backfill vector thật**. App vẫn mặc định rule-only; không chạy model thêm trên máy. Farmer CRUD lô/ảnh và Carrier CRUD xe nâng cao vẫn theo phân công Dev A. Khoảng cách được hoãn.

## Tính năng dùng database

- Auth email hoặc SĐT + mật khẩu, session, role; tài khoản bị khóa không gọi được nghiệp vụ.
- Buyer profile và CRUD nhu cầu; danh mục, lô PUBLISHED, điểm matching theo quy tắc và đọc ảnh private.
- Kết nối Buyer/Farmer: gửi lời mời, người nhận đồng ý/từ chối, người gửi hủy khi đang chờ.
- Chat riêng trong kết nối đã được chấp nhận. Lưu Supabase; cập nhật mỗi 5 giây; hiển thị 100 tin mới nhất.
- Đề nghị giá/lượng/ngày, chấp nhận/từ chối/rút. Chỉ người nhận chấp nhận, server kiểm tra lại lô và nhu cầu.
- Thỏa thuận lưu snapshot điều kiện. Buyer và Farmer xác nhận hoàn tất riêng; chỉ khi cả hai xác nhận mới mở đánh giá.
- Đánh giá: mỗi bên một lần cho mỗi thỏa thuận hoàn tất; target do server xác định; chỉ các bên xem nội dung.
- Admin: dashboard, danh sách/chi tiết/sửa hồ sơ, khóa quyền dùng app, đóng tin đang công bố/mở, xem tổng quan kết nối. RPC trả projection giới hạn; Admin không đọc nội dung chat hoặc giá sàn riêng.
- Dashboard Buyer: số nhu cầu, số đối tác đã kết nối và tổng nguồn cung từ database; không còn biểu đồ thị trường/timeline giả.
- Farmer: đọc lô của mình, đối chiếu nhu cầu OPEN, gửi kết nối và dùng chung chat/thỏa thuận/đánh giá. Carrier: hồ sơ và danh sách phương tiện của mình. Hồ sơ hai vai trò lưu thật.

Khóa tài khoản giữ nguyên lịch sử và ngăn nghiệp vụ; đây không phải ban/xóa Supabase Auth. Không có nút tự đổi role hoặc xóa vĩnh viễn tài khoản. Xóa account, xử lý tranh chấp và đổi vai trò cần quy trình riêng.

Thỏa thuận hiện không tự giữ hàng, trừ tồn kho, gom nhiều lô hoặc phát sinh thanh toán. Hai bên tự xác nhận việc hoàn tất thực tế. Các tên có `[TEST]`/`[DEMO]` vẫn là dữ liệu hư cấu để test dù được lưu thật trong database.

## Hoãn, không mô phỏng thành công

| Phần | Trạng thái / điều kiện để thực hiện |
| --- | --- |
| Đặt xe, báo giá vận chuyển, chọn nhà vận tải tự động | Hoãn đến khi chọn nhà cung cấp và có API/credential |
| GPS, tracking, nhiệt độ/IoT | Hoãn; cần nguồn dữ liệu thiết bị/API thật |
| Bản đồ, geocoding, khoảng cách và ưu tiên khu vực trong matching | Hoãn theo quyết định mới nhất; giữ trường dữ liệu. Admin chỉ tổng hợp theo tỉnh khai báo |
| Thanh toán, đối soát, subscription | Hoãn; chưa có nhà cung cấp/quy trình |
| Chính sách chính thức | Chờ nội dung được đội dự án phê duyệt |
| E5 vector top 20 + so từ rerank | Đã code/test; migration top 20 chưa áp cloud, inference/worker/Edge Function chưa deploy; mặc định rule-only |
| Farmer đăng/sửa lô, upload ảnh; Carrier CRUD xe nâng cao | Theo phân công Dev A; workspace hiện đọc dữ liệu thật và hỗ trợ test giao dịch |
| Lưu trữ chat dài hạn, push notification, receipt đã đọc | Chưa có; chat lấy 100 tin mới nhất, polling 5 giây |

## Tài khoản kiểm thử

Script `scripts/seed-test-accounts.mjs` tạo idempotent 7 tài khoản qua Supabase Admin API, không gửi email/SMS, không reset mật khẩu account đã tồn tại. Khóa backend nằm trong `.env.admin.local` được Git bỏ qua. Mật khẩu ngẫu nhiên lưu tại `tmp/test-accounts.json` và bản đọc nhanh `tmp/test-accounts.md`, UUID nghiệp vụ lưu `tmp/test-business-ids.json`; không commit hoặc đưa các file này vào frontend. Dev A cần nhận thông tin đăng nhập test riêng từ người giữ file này; không cần secret backend để chạy ứng dụng.

| Email | Role |
| --- | --- |
| buyer1@logstar.test | BUYER |
| buyer2@logstar.test | BUYER |
| farmer1@logstar.test | FARMER |
| farmer2@logstar.test | FARMER |
| carrier1@logstar.test | CARRIER |
| carrier2@logstar.test | CARRIER |
| admin1@logstar.test | ADMIN |

Hai tài khoản mỗi domain phục vụ kiểm tra ownership và truy cập chéo. Seed tạo lô/nhu cầu/phương tiện liên kết có nhãn TEST; các placeholder DEMO cũ chưa có mật khẩu và không được chuyển đổi thành tài khoản đăng nhập.

## Triển khai và kiểm thử

Đã chạy thêm [phép thử E5 local ngày 15/10](benchmarks/e5-varieties-2026-10-15/README.md): 31 tên sản phẩm, 155 query có nhãn và 16 ca không gán đích. Small đạt 145/155, base 147/155 top-1; đây là fixture tổng hợp nhỏ, chưa đại diện dữ liệu người dùng. Không backfill cloud hoặc bật hybrid trong lượt thử này.

Đã áp `202610150002_trading.sql` lên LogStar sau khi người dùng xác nhận ngày 15/10/2026. Năm bảng `trade_connections`, `trade_messages`, `trade_offers`, `trade_agreements`, `trade_reviews` đều bật RLS. RPC kiểm tra quyền và trạng thái trong transaction; thỏa thuận và đánh giá lưu snapshot, không phải thanh toán hoặc booking.

- 95 kiểm tra baseline database, 23 kiểm tra giao dịch bằng PostgreSQL cục bộ.
- 22 nhóm kiểm tra HTTP thực trên Supabase: đăng nhập đủ 7 account, ownership, CRUD nhu cầu/lô, profile, Storage ảnh private, kết nối/chat/thỏa thuận/đánh giá và API quản trị giới hạn. Tài khoản Carrier test bị khóa tạm được khôi phục trong `finally`.
- 58 kiểm tra giao diện/thuật toán và bản build đạt sau khi thêm so từ và vector top 20; hybrid dùng cosine giả lập, không chạy model. Build vẫn có cảnh báo bundle trên 500 kB.
- 9 nhóm kiểm tra PostgreSQL/pgvector local cho migration top 20, cosine, quyền truy cập, model/hash gate, eligibility và trường hợp không có vector. Không phải kết quả đo E5 inference thật.
- Trình duyệt: đã đăng nhập cả 4 role; Buyer gửi tin, tải lại vẫn còn tin và session; Farmer đọc cùng hội thoại và điều kiện đã thống nhất; Carrier chỉ thấy xe của mình; Admin đọc danh sách/phân bố tỉnh từ database. Đã sửa CSS để điện thoại vẫn chọn được hội thoại; chưa kiểm tra trên thiết bị thật.
- Bằng chứng: [RLS trên cloud](assets/supabase-trading-rls.png), [tin nhắn còn sau tải lại](assets/trading-chat-persisted.png).

Chat lấy 100 tin gần nhất, đề nghị lấy 50 bản ghi gần nhất. Lời mời đã từ chối/hủy giữ nguyên lịch sử; hiện chưa có thao tác mở lại cùng cặp Buyer/lô. Danh sách quản trị/giao dịch cần bổ sung phân trang server trước khi vận hành ở quy mô lớn (PostgREST có giới hạn số dòng). Nội dung chat lưu trong database; chưa có giao diện tải lịch sử cũ, push hoặc receipt đã đọc.
