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

Route chính theo PR: `/{role}/dashboard`, Buyer/Farmer `/chat`, Admin `/users`, `/lots`, `/requests`. Các URL cũ `/login`, `/buyer/negotiations`, `/farmer/negotiations`, `/admin/buyers`, `/admin/marketplace` tiếp tục hoạt động. Đăng ký email/mật khẩu mở tại `/register`; SMS OTP chưa triển khai. Bản đồ/vận chuyển/API bên ngoài hiển thị ghi chú hoãn.

## Kiểm chứng

`npm test` (hoặc `npm run test:unit`) chạy unit/component/route tests; `npm run build` kiểm tra TypeScript và build production. `npm run ui:inventory` sinh bảng dưới đây, cần Node 24 do script nhập TypeScript trực tiếp. Không có script Playwright system trong bản tích hợp này.

Kết quả và ảnh desktop/mobile nằm trong [biên bản tích hợp](ui-integration.md). Chưa kiểm chứng việc setup trên máy developer khác. Admin theo cấu trúc PR và nghiệp vụ đã có, chưa có xác nhận riêng rằng giống từng mockup gốc.

## Inventory màn hình

<!-- UI-INVENTORY:START -->
Sinh từ `src/app/ui-inventory.ts` bằng `node scripts/generate-ui-inventory.mjs` (Node 24). Chỉ vùng giữa hai marker được cập nhật; không sửa tay bảng này. Hướng dẫn và quyết định bên ngoài vùng được giữ nguyên.

42 mục: 35 trang và 7 modal slots. Modal A đã có nội dung demo và thuộc trang cha; danh sách này giữ UI ID từ baseline. `/404` và catch-all dùng cùng thông báo AUTH-04. Owner là người hoàn thiện feature; matching algorithm thuộc B, UI Farmer thuộc A.

F/D/U là phạm vi tính năng; trạng thái đã nối code không có nghĩa đã nghiệm thu cloud. Router dùng Auth/guards thật, không có menu role cấp quyền.

| UI ID | Màn hình | Route / trang cha | Loại | Owner | Mức mục tiêu | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| FUI-01 | Tổng quan | /farmer/dashboard | page | A | D | Demo tương tác |
| FUI-02 | Hồ sơ nhà vườn | /farmer/profile | page | A | F | Đã nối Auth/SDK; chờ nghiệm thu cloud |
| FUI-03 | Danh sách lô hàng | /farmer/lots | page | A | F | Đã nối Auth/SDK; chờ nghiệm thu cloud |
| FUI-04 | Tạo / sửa lô hàng | /farmer/lots/new | page | A | F | Đã nối Auth/SDK; chờ nghiệm thu cloud |
| FUI-05 | Người mua phù hợp | /farmer/matches | page | A | F | Đã nối Auth/SDK; chờ nghiệm thu cloud |
| FUI-06 | Tìm xe | /farmer/transport | page | A | D | Demo tương tác |
| FUI-07 | Đàm phán | /farmer/chat | page | A | D | Demo tương tác |
| FUI-09 | Đánh giá & tín nhiệm | /farmer/reviews | page | A | D | Demo tương tác |
| FUI-10 | Giá tham khảo | /farmer/prices | page | A | D | Demo tương tác |
| FUI-11 | Thời tiết & khuyến nghị | /farmer/weather | page | A | D | Demo tương tác |
| FUI-12 | Bản đồ thương lái | /farmer/map | page | A | D | Demo tương tác |
| FUI-13 | Thông báo / chính sách | /farmer/notifications | page | A | U | Thông báo demo / policy placeholder |
| FUI-08 | Xác nhận đàm phán | /farmer/chat | modal | A | D | Demo tương tác |
| BUI-01 | Tổng quan | /buyer/dashboard | page | B | D | Code B đã mount; đối chiếu route B/README |
| BUI-02 | Tạo yêu cầu thu mua | /buyer/requests/new | page | B | F | Code B đã mount; đối chiếu route B/README |
| BUI-03 | Nhu cầu thu mua | /buyer/requests | page | B | F | Code B đã mount; đối chiếu route B/README |
| BUI-04 | Tìm lô hàng | /buyer/lots | page | B | F | Code B đã mount; đối chiếu route B/README |
| BUI-07 | Đàm phán | /buyer/chat | page | B | D | Code B đã mount; đối chiếu route B/README |
| BUI-10 | Tìm xe | /buyer/transport | page | B | D | Code B đã mount; đối chiếu route B/README |
| BUI-11 | Đánh giá & tín nhiệm | /buyer/reviews | page | B | D | Code B đã mount; đối chiếu route B/README |
| BUI-12 | Bản đồ nhà vườn | /buyer/map | page | B | D | Chưa có route tương ứng từ B |
| BUI-13 | Thông báo / chính sách | /buyer/notifications | page | B | U | Chưa có route tương ứng từ B |
| BUI-05 | Chi tiết lô hàng | /buyer/lots | modal | B | F | Code B đã mount; đối chiếu route B/README |
| BUI-06 | Lời mời từ nhà vườn | /buyer/chat | modal | B | D | Code B đã mount; đối chiếu route B/README |
| BUI-08 | Xác nhận đơn hàng | /buyer/chat | modal | B | D | Code B đã mount; đối chiếu route B/README |
| BUI-09 | Hẹn khảo sát vườn | /buyer/chat | modal | B | D | Code B đã mount; đối chiếu route B/README |
| CUI-01 | Tổng quan | /carrier/dashboard | page | A | D | Demo tương tác |
| CUI-02 | Hồ sơ & danh sách xe | /carrier/vehicles | page | A | F | Đã nối Auth/SDK; chờ nghiệm thu cloud |
| CUI-03 | Yêu cầu vận chuyển | /carrier/requests | page | A | D | Demo tương tác |
| CUI-05 | Theo dõi chuyến | /carrier/tracking | page | A | D | Demo tương tác |
| CUI-06 | Đánh giá tài xế | /carrier/reviews | page | A | D | Demo tương tác |
| CUI-04 | Chi tiết / báo giá nhận chuyến | /carrier/requests | modal | A | D | Demo tương tác |
| AUI-01 | Tổng quan vận hành | /admin/dashboard | page | B | D | Code B đã mount; đối chiếu route B/README |
| AUI-02 | Quản lý người dùng | /admin/users | page | B | D | Code B đã mount; đối chiếu route B/README |
| AUI-03 | Quản lý lô hàng | /admin/lots | page | B | D | Code B đã mount; đối chiếu route B/README |
| AUI-04 | Nhu cầu thu mua | /admin/requests | page | B | D | Code B đã mount; đối chiếu route B/README |
| AUI-05 | Yêu cầu xe | /admin/transports | page | B | D | Code B đã mount; đối chiếu route B/README |
| AUI-06 | Giá / chính sách / cấu hình | /admin/settings | page | B | U | Code B đã mount; đối chiếu route B/README |
| AUTH-01 | Đăng nhập | /auth/login | page | B | F | Login chung; /auth/login là alias |
| AUTH-02 | Đăng ký | /register | page | B | F | Email/mật khẩu, 3 vai trò thường; cần migration cấp role |
| AUTH-03 | OTP minh họa (chưa triển khai) | /auth/register | modal | B | D | Không có SMS OTP; URL cũ mở đăng ký email |
| AUTH-04 | Không có quyền / không tìm thấy | /403 | page | B | U | UI trạng thái |

AUTH-02 được bổ sung lại ngày 19/10/2026 theo yêu cầu đăng ký thật; `/auth/register` là alias. AUTH-03 vẫn chưa triển khai SMS OTP. AUTH-04 là UI trạng thái. Buyer/Admin giữ route code Linh; registry cũ cần đối chiếu trước khi đánh dấu toàn bộ B hoàn tất.
FUI-13/BUI-13 gộp thông báo/chính sách mức U trong nền này; khi điền feature, phần thông báo fixtures là D, phần văn bản chưa có nghiệp vụ là U.
<!-- UI-INVENTORY:END -->
