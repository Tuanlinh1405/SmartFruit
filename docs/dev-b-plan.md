# Kế hoạch triển khai Developer B - LogStar MVP

Ngày lập: 14/10/2026. Đây là kế hoạch thực hiện, chưa phải mã ứng dụng hoặc xác nhận phê duyệt Scope.

Trạng thái hiện hành 15/10/2026: đã triển khai Auth/Buyer/Admin và luồng giao dịch bằng dữ liệu thật, seed đủ role test. Xem [kết quả thực hiện và phần hoãn](implementation-status.md); các mục demo/chưa code trong kế hoạch này là lịch sử tại thời điểm lập.

Cập nhật 15/10/2026: [kế hoạch code UI, backend và thuật toán](code-implementation-plan.md) là backlog triển khai hiện tại, có công thức matching đề xuất, tiêu chí nghiệm thu và ước lượng mới. Tài liệu này giữ inventory màn hình và phân chia Scope làm căn cứ.

Cập nhật hướng matching theo yêu cầu người dùng: [vector + graph + điều kiện giao dịch](vector-graph-matching-plan.md) thay cách triển khai B-06 chỉ tính điểm phía client. B-06 và lịch bảy ngày bên dưới là baseline/lịch sử; dùng backlog M0–M6 và ước lượng mới trong plan vector/graph khi triển khai. Phạm vi UI Buyer/Admin giữ nguyên.

Cập nhật database 14/10/2026: đã hoàn thiện [schema/ERD](database-schema.md), tạo 12 bảng cùng RLS và bucket ảnh trên Supabase LogStar. [Biên bản triển khai](database-deployment.md) ghi kết quả 90 kiểm tra local và 16 kiểm tra cloud. Phần schema của ngày 1 đã có; Auth UI, account demo và ứng dụng vẫn cần triển khai.

## 1. Căn cứ và hiện trạng

- TDD: nội dung phiên bản 0.4, cập nhật 13/10/2026; tên trang vẫn ghi v0.1. Kiến trúc React + TypeScript + Vite + Tailwind + React Router + Supabase.
- Scope: nội dung phiên bản 0.2. Đối chiếu BR-01..11, FR-04, AR-01..05, FLOW-01..04 và AC-01..10.
- Trang Team Confirm hiện vẫn chờ xác nhận; các checkbox quyết định chưa được tick. Các mặc định dưới đây phục vụ lập kế hoạch, không coi là quyết định khách hàng đã duyệt.
- Repo đã có package.json, cấu hình/client Supabase, schema/migration và dữ liệu demo; chưa có scaffold React/Vite, router hoặc màn hình ứng dụng. Sáu hồ sơ seed chưa có mật khẩu đăng nhập.
- Buyer.pdf có 10 trang: mô tả nghiệp vụ ở trang 1-2, thiết kế màn hình ở trang 3-9; trang 10 không có thiết kế bổ sung. Admin.pdf có 3 trang, chủ yếu là ảnh thiết kế.

Nguồn Notion:

- [Technical Design Document](https://app.notion.com/p/Technical-Design-Document-TDD-v0-1-3f867e17474081a38a52c6c2d9ef6f07)
- [Scope & Requirements](https://app.notion.com/p/Scope-Requirements-Document-v0-1-3f867e17474081089e38fd5599f09f87)
- [Chốt Tech & Phạm vi MVP - Team Confirm](https://app.notion.com/p/Ch-t-Tech-Ph-m-vi-MVP-Team-Confirm-3f967e17474081c68523e739ad5de347)

## 2. Trách nhiệm Dev B và cách phối hợp

| Hạng mục | Dev B thực hiện | Điểm phối hợp với Dev A |
| --- | --- | --- |
| Auth dùng chung | Supabase client, session provider, đăng nhập/đăng xuất, tải role, route guard và tài khoản kiểm thử | A tích hợp vào Farmer/Carrier; thống nhất một hệ thống đăng nhập |
| Database nền | Điều phối schema, migration, quy ước dữ liệu, bảo vệ role và ownership | A phụ trách migration/policy domain Farmer, lots, ảnh và Carrier; cả hai review thay đổi |
| Buyer | Hồ sơ Buyer tối thiểu, yêu cầu thu mua, tìm/lọc/xem lô và các màn demo Buyer | A cung cấp lots PUBLISHED, ảnh và thông tin nhà vườn được phép hiển thị |
| Matching | Hàm tính điểm chung, test, data access và UI kết quả phía Buyer | A dùng cùng hàm/contract để tích hợp kết quả phía Farmer |
| Chat/kết nối | Component và kịch bản demo dùng lại cho Buyer/Farmer | A gắn layout/route Farmer, tránh làm hai hệ chat riêng |
| Admin | Toàn bộ màn Admin demo và placeholder theo Scope/PDF | Chỉ dùng fixtures; không yêu cầu mở quyền Admin toàn database |
| Chất lượng | Test Buyer/Matching/Admin, Auth chung, responsive và tài liệu bàn giao phần B | Cùng chạy kiểm thử chéo role, review RLS và demo xuyên vai trò |

Dev A điều phối scaffold, theme, component nền và route tổng theo TDD. Vì repo chưa có ứng dụng, mốc đầu tiên là thống nhất scaffold dùng chung; nếu Dev A chưa bàn giao, Dev B có thể chuẩn bị scaffold tối thiểu sau khi thống nhất ownership. Chỉ duy trì một package.json, một Supabase client và một router gốc.

## 3. Inventory màn hình và mức thực hiện

F = lưu/đọc dữ liệu thật qua Supabase và kiểm tra quyền. D = thao tác mô phỏng bằng fixtures/state, có nhãn. U = giao diện/placeholder. O = ngoài MVP.

Các route là đề xuất để tích hợp; tên cuối cùng thống nhất với Dev A.

### 3.1 Auth và Buyer

| Màn/route đề xuất | Tham chiếu thiết kế | Mức | Đầu ra |
| --- | --- | --- | --- |
| `/login` | Buyer trang 3 | F cho login bằng tài khoản cấp sẵn | Form, validation, duy trì phiên, logout, chuyển đúng role; bỏ OTP và đăng ký demo theo quyết định 15/10/2026 |
| `/buyer/dashboard` | Buyer trang 4 | D, BR-06/07/09 | KPI, timeline, biểu đồ chỉ tiêu/thực tế, bản đồ/pin mẫu; tracking/IoT chỉ minh họa |
| `/buyer/profile` hoặc mục hồ sơ trong tài khoản | Yêu cầu `buyer_profiles` của TDD; chưa có mockup riêng | F tối thiểu | Tên tổ chức, tỉnh và thông tin cá nhân được phép sửa; dùng form chung, không thêm workflow xác minh |
| `/buyer/requests` | Bổ sung để quản lý bản ghi BR-02 | F | Danh sách nhu cầu của mình, tạo/sửa/xem, trạng thái và đường dẫn đến matching |
| `/buyer/requests/new`, `/buyer/requests/:id/edit` | Buyer trang 5 | F, BR-02 | Form nhiều nhóm + preview; lưu nháp/đăng nhu cầu theo enum thống nhất |
| `/buyer/lots?requestId=...` | Buyer trang 6 | F, BR-03 | Chọn nhu cầu đang dùng, bộ lọc, danh sách lô PUBLISHED, score/lý do, phân trang |
| Modal chi tiết lô | Buyer trang 6 | F ở dữ liệu lô | Chi tiết/ảnh được phép đọc; nút kết nối chuyển sang phần D |
| Tab lời mời từ nhà vườn, gửi đề nghị/đồng ý | Buyer trang 7 | D, BR-04 | Danh sách mẫu và thay đổi state minh họa |
| `/buyer/negotiations` | Buyer trang 7 | D, BR-05 | Hội thoại ba cột trên desktop, chọn hội thoại, tin nhắn và đề nghị giá mẫu |
| Modal xác nhận đơn, hẹn khảo sát, trả giá | Buyer trang 8 | D, BR-05 | Validate form, phản hồi thao tác mô phỏng; không tạo đơn/hợp đồng thật |
| `/buyer/transport` | Buyer trang 9 | D, BR-08 | Form yêu cầu xe, empty state, báo giá mẫu, chọn xe và timeline mẫu |
| `/buyer/reviews` | Buyer trang 9 | D, BR-10 | Chấm sao, nhận xét, tab nhận/đã gửi, phản hồi demo |
| `/buyer/policy`, menu thông báo | Sidebar Buyer/Scope | U/D, BR-11 | Placeholder chính sách và thông báo mẫu |

Quy tắc áp dụng thiết kế:

- Giữ bố cục sidebar xanh đậm, nền kem, card sáng, nút xanh/vàng và phân cấp chữ của PDF; dùng token/component chung với A.
- PDF trang 7/9 tái sử dụng một số nhãn Farmer như “Hồ sơ nhà vườn”, “Đăng tải lô hàng”. Sửa navigation theo vai trò Buyer, giữ cấu trúc giao diện.
- PDF có chữ SmartFruit; kế hoạch tạm dùng tên LogStar theo Scope và đặt brand ở cấu hình chung để đổi đồng bộ.
- Các nội dung “AI”, “cập nhật trực tiếp”, khoảng cách km, GPS, nhiệt độ và tỷ lệ match trong ảnh không tự trở thành dịch vụ thực. Score trên màn F phải tính từ dữ liệu thật được phép đọc; KPI/map/tracking mẫu phải có nhãn riêng.
- Login không tự thêm Google/Zalo hoặc khôi phục mật khẩu thực chỉ vì mockup có nút. Các nút ngoài phạm vi phải được ẩn hoặc giải thích rõ khi hiển thị.

### 3.2 Admin

| Màn/route đề xuất | Nguồn | Mức | Đầu ra |
| --- | --- | --- | --- |
| `/admin/dashboard` | AR-01; chưa có mockup riêng | D | KPI và đường dẫn đến các nhóm quản trị |
| `/admin/buyers` | Admin trang 1 | D, AR-02 | Danh sách thương lái, tìm kiếm, chi tiết, chỉnh sửa/xóa mô phỏng |
| `/admin/buyers/map` | Admin trang 1 | D | Bản đồ/pin mẫu, tìm theo dữ liệu mẫu |
| `/admin/farmers` | Admin trang 2 | D, AR-02 | Danh sách nhà vườn, tìm kiếm, chi tiết và thao tác demo |
| `/admin/farmers/map` | Admin trang 2 | D | Bản đồ/pin mẫu |
| `/admin/carriers` | Admin trang 3 | D, AR-02 | Danh sách đơn vị vận tải, lọc tuyến, modal và reset fixture |
| `/admin/marketplace` | AR-03; chưa có mockup riêng | D | Tab lô hàng/nhu cầu, lọc và xem chi tiết mẫu |
| `/admin/connections`, `/admin/transport` | AR-04; chưa có mockup riêng | D | Danh sách kết nối/yêu cầu xe và trạng thái mẫu |
| `/admin/settings`, `/admin/policy` | AR-05 | U | Bố cục cấu hình, chính sách và dữ liệu giá placeholder |
| Tab quản lý thanh toán trong PDF | Admin trang 3 | U ở giao diện, O ở nghiệp vụ | Placeholder “Chưa triển khai trong MVP”; không xử lý tiền, gia hạn hay đối soát |

Admin đăng nhập thật bằng Auth chung và tài khoản được cấp role ADMIN; các dữ liệu/quyền quản trị nội dung bên trong vẫn D/U. Dùng header/tab ngang như PDF, bổ sung các mục Scope chưa có hình theo cùng hệ thống giao diện.

Thiết kế Admin hiện hiển thị mật khẩu dạng rõ. Khi triển khai thay khối này bằng trạng thái tài khoản hoặc mã tài khoản; không lưu, truy vấn hoặc hiển thị mật khẩu của người dùng. Các thông tin gia hạn trong mẫu cũng chỉ là fixture, không tạo hệ subscription.

## 4. Công việc nền phải xong sớm

### B-01. Chốt contract để hai người làm độc lập

- Thống nhất route, role enum, trạng thái `lots`/`buy_requests`, tên bảng/cột, UUID, UTC, khối lượng kg và tiền nguyên VND/kg.
- UI có thể nhập/hiển thị tấn; đổi rõ `1 tấn = 1000 kg` tại ranh giới form/API. Ngày thu mua/thu hoạch là ngày lịch; thống nhất kiểu `date` để tránh lệch ngày khi chuyển múi giờ.
- Thống nhất LotSummary, BuyRequestInput, MatchResult và dữ liệu công khai tối thiểu của đối tác. Giữ số điện thoại/địa chỉ riêng ngoài contract matching.
- Dùng chung component Button, Input, Select, Modal, Tabs, Badge, Table/Card, Loading, EmptyState, ErrorState và DemoBadge; A điều phối component nền, B đóng góp phần mình cần.
- Thống nhất thứ tự migration và người sửa file tích hợp chung; mỗi feature tạo migration mới, tránh hai người sửa cùng migration đã áp dụng.

### B-02. Auth và nền Supabase

- Một client trong `src/lib/supabase.ts`; cấu hình public URL/key qua `.env.local` và `.env.example`.
- Session provider chờ trạng thái Auth/profile trước khi redirect; cập nhật UI qua `onAuthStateChange`, xử lý mất phiên hoặc thiếu profile bằng thông báo rõ.
- Login SĐT/password với tài khoản tạo sẵn theo TDD; chuẩn hóa số điện thoại theo định dạng Auth đã cấu hình. Email/password chỉ chuyển sang khi team chọn phương án đó.
- Tạo tài khoản demo bằng quy trình quản trị tin cậy; chuẩn bị ít nhất hai Buyer, hai Farmer và tài khoản Carrier/Admin để test ownership lẫn role. Không commit mật khẩu/khóa quản trị vào seed SQL hoặc frontend.
- Role không lấy từ lựa chọn role trên màn login hoặc localStorage. Cấp role từ quy trình tin cậy; user không tự sửa `profiles.role` hoặc khóa sở hữu.
- RLS là nơi kiểm soát quyền thật; route guard chỉ điều hướng UX. Không thêm quyền Admin toàn bảng để phục vụ màn fixture.
- Quyết định 15/10/2026: dùng tài khoản cấp sẵn, bỏ OTP và luồng đăng ký demo do chưa có tài nguyên SMS; đăng ký thật chưa nằm trong bản triển khai này.

### B-03. Schema Buyer và các trường UI còn thiếu

TDD liệt kê bảng tối thiểu, chưa đủ mọi trường form trong PDF. Trước khi nối form với DB, lập mapping và migration rõ ràng:

| Nhóm | Dữ liệu cần lưu thật | Điểm cần thống nhất |
| --- | --- | --- |
| Hồ sơ | `profiles`, `buyer_profiles`: user ID, tên cá nhân/tổ chức, tỉnh | B bảo trì phần Buyer; chỉ sửa các cột cá nhân được cho phép |
| Nhu cầu cốt lõi | Buyer ID, fruit type, khối lượng min/max hoặc mục tiêu, giá min/max, ngày bắt đầu/kết thúc, tỉnh, trạng thái | Form PDF có một tổng khối lượng; phải định nghĩa mapping sang schema, không ngầm hiểu mỗi lô phải đạt đủ tổng nhu cầu |
| Chi tiết thu mua | Giống/phân loại, yêu cầu chất lượng, đóng gói, hình thức thu mua, phương án vận chuyển, ghi chú | Đề xuất bổ sung cột/array tối thiểu cho trường form đã giữ; phân loại cái nào là thông tin, cái nào tham gia matching |
| Khu vực | Một hoặc nhiều tỉnh, tùy lựa chọn UI | TDD minh họa một `province`, PDF có nhiều tỉnh; thống nhất scalar/array trước khi code |
| Danh mục | Fruit types và giá trị lựa chọn dùng chung | Không để Farmer và Buyer dùng tên loại quả hoặc mã tỉnh khác nhau |

Không hiển thị thông báo lưu thành công cho những trường bị bỏ khỏi payload. Trường giữ ở form F phải được lưu/đọc lại; trường chưa hỗ trợ phải ghi rõ hoặc bỏ theo quyết định scope.

RLS và constraints cần có:

- Buyer CRUD nhu cầu của mình; không thay `buyer_id`, không sửa nhu cầu của Buyer khác. `USING` và `WITH CHECK` đầy đủ cho các thao tác cho phép.
- Buyer chỉ đọc lots PUBLISHED và ảnh được policy cho phép; không lộ DRAFT bằng truy cập thẳng ID.
- Farmer chỉ đọc nhu cầu OPEN và dữ liệu đối tác tối thiểu cần cho FR-04 theo policy/contract thống nhất với A; không mở toàn bộ profiles cho mọi user.
- RLS không che riêng từng cột. Nếu record chứa dữ liệu riêng tư, dùng projection an toàn qua view/RPC với quyền được kiểm tra hoặc tách dữ liệu; frontend `select` ít cột không tự tạo ra bảo mật cột.
- Nếu ảnh private cần ký URL, Storage policy phải cho phép Buyer đọc đúng ảnh của lô PUBLISHED; A sở hữu phần triển khai, B kiểm thử đường đọc.
- Constraints cho khối lượng/giá dương, min <= max, start <= end; index theo owner và các trường lọc phù hợp. Khi cho phép nhu cầu không có giá trần, dùng giá trị nullable có ý nghĩa rõ, không dùng số 0 để lách validate.
- Tránh policy role đọc profiles gây đệ quy; hàm hỗ trợ nếu cần phải được giới hạn quyền và kiểm thử.

## 5. Thực hiện Buyer và Matching

### B-04. Yêu cầu thu mua end-to-end

1. Dựng layout Buyer theo PDF và form trang 5 với state/preview.
2. Viết query trong `features/buy-requests/*.api.ts`; component không tự rải lệnh Supabase.
3. Nối tạo, danh sách, xem, sửa và chuyển trạng thái theo contract đã chốt. Với nút “Lưu nháp”, thống nhất DRAFT -> OPEN; cancel/close theo enum đã thống nhất, không tự gắn nghiệp vụ giao dịch.
4. Validate cả UI và DB, khóa double submit, phản hồi lỗi tiếng Việt, giữ input khi lỗi.
5. Kiểm tra refresh/đăng nhập lại, danh sách rỗng, lỗi mạng và Buyer B không sửa được bản ghi Buyer A.

### B-05. Tìm/lọc/xem lô

- Lấy lots PUBLISHED do A tạo; đọc loại quả, khối lượng, giá, ngày, tỉnh và ảnh hợp lệ.
- Có nhu cầu đang chọn rõ ràng trước khi tính match; khi chưa có nhu cầu hướng dẫn tạo/chọn nhu cầu.
- Filter/sort/pagination bằng Supabase khi phù hợp; không tính matching trên một trang dữ liệu rồi gọi là top toàn bộ ứng viên.
- Với demo ít dữ liệu, lấy đủ tập ứng viên đã lọc loại quả/ngày và được RLS cho phép, sau đó tính điểm và phân trang kết quả. Đặt giới hạn rõ; nếu vượt giới hạn thì thu hẹp điều kiện hoặc chuyển RPC, không âm thầm bỏ phần còn lại.
- Modal chi tiết lấy dữ liệu thật; các chi tiết chưa có trong schema không dùng fixture giả làm dữ liệu của lô thật.
- Không ghi khoảng cách km khi chỉ có tỉnh. Bộ lọc địa lý MVP dùng tỉnh/khu vực; nếu có khoảng cách mẫu ở màn D phải ghi nhãn.

### B-06. Matching dùng chung hai phía

- Hàm thuần TypeScript `scoreMatch(lot, request, config)` và hàm xếp hạng chung; không cần dựng API Express.
- Contract kết quả dự kiến: lot ID, request ID, tổng điểm 0-100, điểm từng tiêu chí, lý do, thông tin không đủ và phiên bản rule.
- Mặc định đề xuất từ Team Confirm: lọc cứng cùng loại quả và khoảng ngày giao nhau; giá 40%, lượng 35%, khu vực 25%. Để trọng số/các ngưỡng trong cấu hình dễ thay đổi.
- Chốt bảng test input -> output trước khi viết scoring: giá ngoài range bị loại hay trừ điểm; lượng thiếu có được gợi ý; lượng lớn hơn nhu cầu; khác khu vực; dữ liệu thiếu. Không coi công thức điểm chi tiết là đã có trong TDD.
- Điểm vướng quan trọng: mockup Buyer nhu cầu 50 tấn vẫn gợi ý lô 12/15/28 tấn. Đề xuất cho phép lô đóng góp một phần và thể hiện số lượng còn thiếu, chỉ gợi ý từng cặp; không tự xây bài toán gom nhiều lô/giữ hàng. Nếu team yêu cầu mỗi lô đủ lượng tối thiểu thì cần đổi rule và dữ liệu demo tương ứng.
- Tie score dùng tiêu chí phụ cố định như ID; cùng input/config cho cùng điểm và thứ tự. Không dùng random hoặc thời điểm hiện tại trong scoring.
- Score là mức phù hợp theo luật, không phải xác suất giao dịch thành công hoặc điểm ML.
- B bàn giao hàm/contract và test data cho A; A tích hợp route Farmer. Việc đọc ứng viên phía Farmer phải kiểm tra RLS như phía Buyer.

### B-07. Các màn demo Buyer và component chung

- Dùng fixtures có liên kết ID nhất quán: Buyer có nhu cầu, Farmer có lô tương ứng, hội thoại về đúng lô, form vận chuyển có cùng ngữ cảnh.
- Kết nối từ lô thật có thể mở hội thoại mô phỏng với ngữ cảnh lô đó; gắn nhãn tại bước chuyển F -> D, không sinh tin nhắn thật cho đối tác.
- Chat có chọn hội thoại, gửi tin vào state demo, đề nghị giá, modal xác nhận/hẹn khảo sát; không thêm bảng messages/orders/bookings.
- Transport và reviews phía Buyer tái sử dụng component do domain owner xây khi phù hợp; B chịu trách nhiệm route, ngữ cảnh và acceptance phía Buyer.
- Dashboard, map, biểu đồ và tracking dùng mẫu có nhãn. Cơ chế reset demo trả fixtures về ban đầu; không hứa hẹn đồng bộ nhiều tài khoản hoặc lưu lâu dài.

## 6. Kế hoạch bảy ngày và checkpoint

Ngày là ngày làm việc tương đối, chưa gắn lịch bắt đầu. Ước tính này giả định A và B làm song song, Supabase/project access sẵn từ ngày 1, scope vẫn theo proposal, một vòng review tập trung và không có nghiệp vụ mới.

| Ngày | Việc chính của Dev B | Đầu ra kiểm tra được | Phụ thuộc/phối hợp |
| --- | --- | --- | --- |
| 1 | Chốt inventory/contract; nối scaffold chung; client Supabase; Auth/session/role; migration nền; route skeleton Buyer/Admin | Tài khoản theo role đăng nhập, refresh không mất phiên; Buyer/Admin có layout và navigation cơ bản; A dùng được contract Auth | A bàn giao scaffold/theme, hai người review schema/RLS; cần quyền quản lý Supabase |
| 2 | Buyer profile tối thiểu; migration bổ sung trường form; danh sách/tạo/sửa/nháp/đăng nhu cầu; validation và RLS Buyer | Một Buyer lưu và đọc lại đầy đủ form; Buyer khác không sửa được; preview đúng đơn vị | A tiếp tục Farmer/lots; thống nhất enums, fruit types, tỉnh |
| 3 | Tìm/lọc lô PUBLISHED; ảnh; chi tiết lô; chọn nhu cầu; trạng thái loading/empty/error; phân trang | Farmer A đăng lô thật -> Buyer xem được; draft vẫn bị chặn; nhu cầu đã lưu dùng được để tìm | Checkpoint bắt buộc với lots/Storage của A |
| 4 | Rule matching + tests; kết quả/lý do; bàn giao hàm chung cho A; lắp nhãn chuyển F -> D | Chạy được BR-02 -> BR-03; cả hai phía dùng cùng rule; có ca không match và không lộ dữ liệu | Review rule lượng thiếu/giá; A tích hợp Farmer |
| 5 | Hoàn thiện chat/modal, dashboard/map, transport/reviews Buyer và toàn bộ Admin D/U | Đi trọn FLOW-02, phần Buyer của FLOW-03 và FLOW-04; mọi màn đã có skeleton từ ngày 1-3 | Tái dùng component demo với A; review sớm Admin vào cuối ngày 3 để tránh dồn việc |
| 6 | Responsive, test cross-role/RLS/Auth/Storage, chạy FLOW-01..04; sửa lỗi tích hợp | Checklist có kết quả thực tế, không còn lỗi ownership/role; luồng mobile dùng được | Hai người test chéo, chụp ảnh so thiết kế |
| 7 | Fix blocker còn lại; seed/demo reset; README, ma trận F/D/U/O và release build; tích hợp staging khi có hạ tầng | Build thành công, demo có thể lặp lại, tài liệu bàn giao rõ phần thật/demo và lỗi nhỏ còn lại | A chốt Farmer/Carrier; cùng chạy nghiệm thu cuối |

Để ngày 5 khả thi, dựng route/component/skeleton Admin sớm trong ngày 1-3, dùng một component danh sách quản trị cho ba nhóm user và một component map mẫu cho hai màn bản đồ. Ngày 5 tập trung nội dung/thao tác demo và liên kết luồng.

Nếu tới cuối ngày 1 chưa có Supabase, vẫn làm UI, fixtures và contract; chưa tính Auth/CRUD/RLS F là hoàn thành. Nếu cuối ngày 3 chưa có lots thật, dùng fixture để tiếp tục phát triển giao diện và ghi rõ checkpoint tích hợp đang thiếu. Bảy ngày cần ước tính lại khi phụ thuộc này trễ hoặc phát sinh chức năng thật; không cắt ngầm kiểm thử quyền để giữ hạn.

## 7. Thứ tự tích hợp và tổ chức mã dự kiến

Các đường dẫn dưới đây là đầu ra dự kiến, hiện chưa tồn tại.

```text
src/
  app/                    # session/role guards và đăng ký route; phối hợp A
  pages/auth/             # login bằng tài khoản cấp sẵn
  pages/buyer/            # layout, dashboard, profile, requests, lots, demo pages
  pages/admin/            # layout, danh sách, maps, giám sát, placeholders
  features/buy-requests/  # types, API, hooks, form, preview
  features/matching/     # types, config, score, ranking, tests, result components
  features/connections/  # chat và modal demo dùng lại với A
  lib/supabase.ts
  lib/auth.ts
  mocks/                  # buyer/admin/chat fixtures + reset
  types/database.ts       # sinh lại sau migration, không sửa tay lệch schema
supabase/
  migrations/             # schema/constraints/RLS có thứ tự và owner rõ
  seed.sql                # dữ liệu ứng dụng, không có secrets
docs/
  dev-b-plan.md
  data-contract.md         # trường, đơn vị, quyền hiển thị, status và rule
  acceptance-checklist.md
  demo-script.md
```

Chia thay đổi để A review lần lượt: (1) Auth + schema/contract nền; (2) Buyer profile/requests + RLS; (3) tìm lô; (4) matching dùng chung; (5) Buyer demo; (6) Admin demo; (7) nghiệm thu/tài liệu. Không đợi hoàn thành toàn bộ B mới tích hợp. Thay đổi Auth/role/RLS phải có kết quả thử bằng nhiều tài khoản trước khi merge.

## 8. Kiểm thử và tiêu chí hoàn thành Dev B

| Nhóm | Kiểm tra bắt buộc | Liên hệ AC |
| --- | --- | --- |
| UI inventory | Các route và modal ở mục 3 mở được; đúng role/navigation; không có nút chết không giải thích | AC-01/10 |
| Persistence | Buyer tạo/sửa nhu cầu và profile, refresh/đăng nhập lại vẫn đúng dữ liệu; mọi trường F đã giữ đều tồn tại | AC-02 |
| Role/owner | Anon bị chặn; Buyer B không đọc nhu cầu riêng/sửa record Buyer A; không đổi role/owner; Carrier không ghi bảng Buyer; không chỉ test qua nút UI | AC-03 |
| Đọc chéo hợp lệ | Buyer thấy PUBLISHED, không thấy DRAFT; Farmer chỉ thấy projection nhu cầu OPEN đã thống nhất; ảnh đúng policy | AC-03/05 |
| Matching | Cùng input/config cho cùng kết quả; khác quả; ngày không giao; thiếu lượng; giá ngoài range; khác tỉnh; tie; thiếu dữ liệu; không có ứng viên trái quyền | AC-04 |
| Form | Required, min/max, số âm/0, ngày ngược, chuyển tấn/kg, lỗi API, double submit | AC-06 |
| Demo | Kết nối -> chat -> xác nhận/hẹn khảo sát -> transport rõ bước demo; Admin fixture không sửa DB thật; reset chạy lại được | AC-05/08 |
| Responsive | Đề xuất kiểm tra 1440px, 768px và 390px; form/preview xếp dọc, sidebar thành drawer, modal vừa màn, chat chia view; bảng cho cuộn trong khối | AC-07 |
| Release | Typecheck/build theo scripts dự án; không secret ở client; reload deep link; Auth redirect đúng môi trường; ghi lỗi còn lại và ma trận tính năng | AC-09/10 |

Viết unit test cho scoring và chuẩn hóa dữ liệu có ảnh hưởng kết quả; có bài kiểm tra tích hợp/quy trình test RLS để chứng minh cả trường hợp cho phép lẫn từ chối. Kiểm tra giao diện/demo bằng kịch bản thực tế và ảnh so PDF, tránh test chỉ lặp lại chi tiết JSX.

Điều kiện hoàn thành phần B: BR-01..03 thực sự chạy qua Supabase, matching dùng được ở cả hai domain theo quyền cho phép, các màn BR-04..11/AR-01..05 đạt đúng D/U/O đã nêu, toàn bộ checkpoint liên quan có kết quả và phần chưa làm được ghi rõ. FLOW-01/03 còn cần phần A tích hợp; B không tự đánh dấu toàn dự án hoàn thành khi chỉ phía Buyer/Admin chạy.

## 9. Các quyết định cần đưa vào buổi thống nhất đầu tiên

| Quyết định | Đề xuất để lập kế hoạch | Thời điểm ảnh hưởng |
| --- | --- | --- |
| Scaffold và component chung ai bàn giao? | A điều phối, B đóng góp Auth/Buyer/Admin; một repo/app/client | Trước khi tạo nền ứng dụng |
| Supabase project và tài khoản demo | Dùng chung project dev, có quyền tạo tài khoản và migration; password cấp qua kênh riêng | Để kiểm chứng F từ ngày 1 |
| Đăng ký và OTP | Quyết định 15/10/2026: bỏ OTP/đăng ký demo; login thật bằng tài khoản cấp sẵn | Đã chốt với người dùng |
| Trường form Buyer | Chốt mapping với schema, thêm các trường thông tin cần giữ bằng SQL migration | Trước khi nối form DB ngày 2 |
| Lô nhỏ hơn tổng nhu cầu | Gợi ý đóng góp một phần, không tự gom/giữ nhiều lô; confirm rule chính thức | Trước scoring ngày 4 |
| Giá ngoài range và dữ liệu thiếu | Chốt loại/trừ điểm và test case; trọng số 40/35/25 vẫn là đề xuất | Trước scoring ngày 4 |
| Quyền hiển thị dữ liệu đối tác | Chỉ trường matching tối thiểu; không mặc định công khai SĐT/chứng nhận riêng | Trước policy đọc chéo ngày 3 |
| Admin/payment/brand | Admin D/U, payment O, tên LogStar cấu hình được, giữ visual PDF | Trước review inventory/UI |
| Hosting, thời gian bắt đầu và mức responsive | Local nếu thiếu hosting; staging khi có; viewport phía trên là đề xuất | Trước chốt lịch/AC-07 và ngày 7 |

Các mục còn mở không cản việc lập kế hoạch hoặc dựng UI theo giả định đã ghi; khi quyết định thay đổi phạm vi thì cập nhật kế hoạch, contract và test trước phần triển khai bị ảnh hưởng.
