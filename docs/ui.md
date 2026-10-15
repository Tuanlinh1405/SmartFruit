# UI chung SmartFruit

Nền UI lấy từ [PR #2 · Feature/UI skeleton](https://github.com/Tuanlinh1405/SmartFruit/pull/2), commit `47d988ad7c34c93148f40848da9ca00edd151f03`. Đã tích hợp với nghiệp vụ Dev B trên nhánh Linh, chưa merge PR trên GitHub. [Biên bản tích hợp](ui-integration.md).

## Thiết kế và cấu trúc

Nền kem, panel trắng, sidebar xanh rừng; brand SmartFruit. Tokens trong `src/styles/tokens.css`: forest #15372A, leaf #1FA85C, cream #F6F5EE; primary #167843 cho nút chữ trắng. Fonts Fraunces Variable và Plus Jakarta Sans Variable tự host qua Fontsource, có tiếng Việt.

`src/styles.css` nhập Tailwind, tokens, UI kit và `features.css` theo thứ tự. `ui.css` giữ styles nền từ PR; `features.css` nối các trang nghiệp vụ hiện có vào cùng tokens. Không cần thay API để đổi layout.

## Tái sử dụng component

Import controls từ `src/components/ui`, Card/PageHeader/FormLayout từ `src/components/shared`. Component chung chỉ nhận dữ liệu/callback; Supabase và validation nghiệp vụ nằm trong feature. `/dev/ui` chỉ dùng khi chạy dev, không có trong production.

- Button mặc định `type="button"`; nút lưu form phải có `type="submit"`. Loading khóa click.
- TextField/Select/TextArea gắn label, hint, error. NumberWithUnit mô tả đơn vị; DateInput dùng native date, phần đọc dùng dd/mm/yyyy.
- Modal/Drawer dùng Radix để giữ focus, hỗ trợ Escape; mở qua trigger trả focus tự động. Modal không có trigger trả về phần tử đang focus lúc mount; unmount khi đóng.
- ConfirmDialog trong UI kit vẫn là ví dụ minh họa, chỉ dùng ở `/dev/ui`. Các thao tác thật gọi API của feature và xử lý loading/error riêng.
- FileUpload chỉ chọn/validate file local, chưa upload. Không dùng như xác nhận ảnh đã lưu.
- DataTable sort local, không mutate rows; mobile chuyển thành cards. Pagination server cần adapter riêng.
- ToastProvider nằm trong AppProviders. React Query provider sẵn sàng cho feature mới; các hooks/API hiện có vẫn giữ nguyên.

## Shell và quyền

AppShell chung cho bốn role, nhận role từ route đã qua AuthProvider/RoleGuard. Không có bộ chọn role giả. Tên tài khoản và đăng xuất dùng Supabase thật; RLS tiếp tục kiểm tra quyền dữ liệu.

Desktop >=1024px sidebar 240px, tablet 768–1023px sidebar icon, mobile <768px dùng drawer đóng khi chuyển trang. Có skip link, breadcrumb và focus rõ. Form hai cột chuyển thành một cột trên mobile. `FormLayout` dùng class `form-layout`, lưới field dùng `form-grid` để tránh xung đột.

Route chính theo PR: `/{role}/dashboard`, Buyer/Farmer `/chat`, Admin `/users`, `/lots`, `/requests`. Các URL cũ `/login`, `/buyer/negotiations`, `/farmer/negotiations`, `/admin/buyers`, `/admin/marketplace` tiếp tục hoạt động. Đăng ký/OTP đã bỏ. Bản đồ/vận chuyển/API bên ngoài hiển thị ghi chú hoãn.

## Kiểm chứng

`npm test` (hoặc `npm run test:unit`) chạy unit/component/route tests; `npm run build` kiểm tra TypeScript và build production. `npm run ui:inventory` sinh bảng dưới đây, cần Node 24 do script nhập TypeScript trực tiếp. Không có script Playwright system trong bản tích hợp này.

Kết quả và ảnh desktop/mobile nằm trong [biên bản tích hợp](ui-integration.md). Chưa kiểm chứng việc setup trên máy developer khác. Admin theo cấu trúc PR và nghiệp vụ đã có, chưa có xác nhận riêng rằng giống từng mockup gốc.

## Inventory màn hình

<!-- UI-INVENTORY:START -->
Sinh từ `src/app/ui-inventory.ts` bằng `node scripts/generate-ui-inventory.mjs` (Node 24). Chỉ vùng giữa hai marker được cập nhật; không sửa tay bảng này. Hướng dẫn và quyết định bên ngoài vùng được giữ nguyên.

45 mục: 39 trang và 6 luồng thuộc trang cha. Một số luồng hiển thị inline thay vì modal riêng. Owner theo phân công; matching thuộc B, CRUD lô/xe nâng cao thuộc A.

F: đã nối nghiệp vụ thật; U: hoãn. Cột trạng thái phân biệt phần chỉ đọc với phần đã có thao tác lưu. Auth/RoleGuard và RLS tiếp tục kiểm tra quyền; menu không cấp quyền.

| UI ID | Màn hình | Route / trang cha | Loại | Owner | Mức mục tiêu | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| FUI-01 | Tổng quan | /farmer/dashboard | page | A | F | Dữ liệu thật |
| FUI-02 | Hồ sơ nhà vườn | /farmer/profile | page | A | F | Dữ liệu thật |
| FUI-03 | Danh sách lô hàng | /farmer/lots | page | A | F | Đọc dữ liệu thật; CRUD nâng cao chờ Dev A |
| FUI-04 | Tạo / sửa lô hàng | /farmer/lots/new | page | A | U | Hoãn / chưa hỗ trợ |
| FUI-05 | Người mua phù hợp | /farmer/matches | page | A | F | Dữ liệu thật |
| FUI-06 | Tìm xe | /farmer/transport | page | A | U | Hoãn / chưa hỗ trợ |
| FUI-14 | Lời mời kết nối | /farmer/invitations | page | A | F | Dữ liệu thật |
| FUI-07 | Đàm phán | /farmer/chat | page | A | F | Dữ liệu thật |
| FUI-09 | Đánh giá & tín nhiệm | /farmer/reviews | page | A | F | Dữ liệu thật |
| FUI-10 | Giá tham khảo | /farmer/prices | page | A | U | Hoãn / chưa hỗ trợ |
| FUI-11 | Thời tiết & khuyến nghị | /farmer/weather | page | A | U | Hoãn / chưa hỗ trợ |
| FUI-12 | Bản đồ thương lái | /farmer/map | page | A | U | Hoãn / chưa hỗ trợ |
| FUI-13 | Thông báo / chính sách | /farmer/notifications | page | A | U | Hoãn / chưa hỗ trợ |
| FUI-08 | Xác nhận đàm phán | /farmer/chat | modal | A | F | Dữ liệu thật |
| BUI-01 | Tổng quan | /buyer/dashboard | page | B | F | Dữ liệu thật |
| BUI-02 | Tạo yêu cầu thu mua | /buyer/requests/new | page | B | F | Dữ liệu thật |
| BUI-03 | Nhu cầu thu mua | /buyer/requests | page | B | F | Dữ liệu thật |
| BUI-04 | Tìm lô hàng | /buyer/lots | page | B | F | Dữ liệu thật |
| BUI-14 | Lời mời kết nối | /buyer/invitations | page | B | F | Dữ liệu thật |
| BUI-15 | Hồ sơ thương lái | /buyer/profile | page | B | F | Dữ liệu thật |
| BUI-07 | Đàm phán | /buyer/chat | page | B | F | Dữ liệu thật |
| BUI-10 | Tìm xe | /buyer/transport | page | B | U | Hoãn / chưa hỗ trợ |
| BUI-11 | Đánh giá & tín nhiệm | /buyer/reviews | page | B | F | Dữ liệu thật |
| BUI-12 | Bản đồ nhà vườn | /buyer/map | page | B | U | Hoãn / chưa hỗ trợ |
| BUI-13 | Thông báo / chính sách | /buyer/notifications | page | B | U | Hoãn / chưa hỗ trợ |
| BUI-05 | Chi tiết lô hàng | /buyer/lots | modal | B | F | Dữ liệu thật |
| BUI-06 | Lời mời từ nhà vườn | /buyer/chat | modal | B | F | Dữ liệu thật |
| BUI-08 | Xác nhận đơn hàng | /buyer/chat | modal | B | F | Dữ liệu thật |
| BUI-09 | Hẹn khảo sát vườn | /buyer/chat | modal | B | U | Hoãn / chưa hỗ trợ |
| CUI-01 | Tổng quan | /carrier/dashboard | page | A | F | Dữ liệu thật |
| CUI-02 | Danh sách xe | /carrier/vehicles | page | A | F | Đọc dữ liệu thật; CRUD nâng cao chờ Dev A |
| CUI-07 | Hồ sơ nhà xe | /carrier/profile | page | A | F | Dữ liệu thật |
| CUI-03 | Yêu cầu vận chuyển | /carrier/requests | page | A | U | Hoãn / chưa hỗ trợ |
| CUI-05 | Theo dõi chuyến | /carrier/tracking | page | A | U | Hoãn / chưa hỗ trợ |
| CUI-06 | Đánh giá tài xế | /carrier/reviews | page | A | U | Hoãn / chưa hỗ trợ |
| CUI-04 | Chi tiết / báo giá nhận chuyến | /carrier/requests | modal | A | U | Hoãn / chưa hỗ trợ |
| AUI-01 | Tổng quan vận hành | /admin/dashboard | page | B | F | Dữ liệu thật |
| AUI-02 | Quản lý người dùng | /admin/users | page | B | F | Dữ liệu thật |
| AUI-03 | Quản lý lô hàng | /admin/lots | page | B | F | Dữ liệu thật |
| AUI-04 | Nhu cầu thu mua | /admin/requests | page | B | F | Dữ liệu thật |
| AUI-07 | Kết nối & thỏa thuận | /admin/connections | page | B | F | Dữ liệu thật |
| AUI-05 | Yêu cầu xe | /admin/transports | page | B | U | Hoãn / chưa hỗ trợ |
| AUI-06 | Giá / chính sách / cấu hình | /admin/settings | page | B | U | Hoãn / chưa hỗ trợ |
| AUTH-01 | Đăng nhập | /auth/login | page | B | F | Dữ liệu thật |
| AUTH-04 | Không có quyền / không tìm thấy | /403 | page | B | U | UI trạng thái 403/404 |

Đăng ký/OTP đã bỏ theo quyết định dự án. Đăng nhập email hoặc SĐT + mật khẩu Supabase Auth.
Thông báo, bản đồ, vận chuyển và API bên ngoài chưa triển khai; không hiển thị giao dịch giả thành công.
<!-- UI-INVENTORY:END -->
