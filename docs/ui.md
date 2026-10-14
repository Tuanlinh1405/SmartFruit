# UI chung SmartFruit

## Nền thiết kế

Màu và cấu trúc theo LogStar_UI_Implementation_Plan_v1.md do chủ dự án cung cấp; tên hiển thị giữ SmartFruit theo repo hiện tại. Nền kem, panel trắng, sidebar xanh rừng; ưu tiên nội dung rõ, không glow/gradient hoặc dashboard AI.

Nguồn tokens: `src/styles/tokens.css`. Màu forest #15372A, leaf #1FA85C, cream #F6F5EE, amber #F3A712, coral #E3632F. Primary #167843 dùng cho chữ trắng; leaf giữ vai trò màu nhận diện. Không tạo mã màu/font/radius mới trong feature khi token hiện có đáp ứng.

Font self-host qua Fontsource: Fraunces Variable cho brand/h1, Plus Jakarta Sans Variable cho body; có subsets tiếng Việt và fallback Georgia/Arial/system-ui. Body 16px, label 14px, heading 28px (mobile 24px). Controls tối thiểu 44px; card radius 10px, border nhẹ; focus luôn rõ. Motion 150ms và tắt khi reduced-motion.

## Ghép trang

Import UI từ `src/components/ui`, layout/content từ `src/components/shared`. Truyền dữ liệu và callback; component chung không import Supabase. Query/service thuộc feature. Tham khảo `/dev/ui` khi chạy `npm run dev`: hai mẫu local form/preview và filter/table, cùng trạng thái/overlays.

```tsx
import { PageHeader, Card, FormLayout, DemoNotice } from '../../components/shared';
import { Button, TextField } from '../../components/ui';

// Ví dụ composition; onChange/onSubmit và validation thuộc feature.
<div className="stack">
  <PageHeader title="Tên trang" description="Mô tả ngắn" />
  <DemoNotice />
  <FormLayout preview={<Card title="Xem trước">Nội dung preview</Card>}>
    <Card title="Thông tin">
      <form className="stack-sm" onSubmit={handleSubmit}>
        <TextField label="Tên" required value={name} error={error}
          onChange={event => setName(event.target.value)} />
        <Button type="submit" loading={saving}>Lưu</Button>
      </form>
    </Card>
  </FormLayout>
</div>
```

`Button` mặc định type=button; nút submit phải truyền type=submit. Loading khóa click. Input gắn label, hint và error bằng ID tự sinh; NumberWithUnit gắn đơn vị vào accessible description. DateInput dùng native date: trình duyệt quyết định cách hiển thị trong input; phần đọc/preview dùng formatter dd/mm/yyyy.

## Interfaces và trạng thái

- `Role`, `UiEntry`, `FeatureLevel`, `DisplayStatus`: `src/types/ui.ts`; chưa tạo DTO nghiệp vụ hoặc thay database types.
- `Column<T>`: id, label, render(row), sortValue(row) tùy chọn. DataTable nhận rows, columns, rowKey và caption; sort local không mutate rows. FilterBar controlled; feature lọc hoặc gọi service. Khi dataset lớn, thay adapter query trước khi dùng như pagination thật.
- `Modal`/`Drawer`: title, description, trigger, children và open/onOpenChange nếu controlled. Dùng trigger để Radix trả focus; nếu mở programmatically không có trigger, feature phải quản lý điểm trả focus phù hợp.
- `ConfirmDialog`: callback onConfirm, chỉ bản minh họa trong giai đoạn 2. Không dùng bản này cho xác nhận hành động nguy hiểm thật khi chưa đặc tả lại nội dung/variant.
- `ToastProvider` đã nằm trong AppProviders; `useToast()` nhận message, có live announcement, đóng thủ công hoặc sau 6 giây.
- `FileUpload` chỉ chọn/validate local file; defaults JPEG/PNG/WebP, 5MB. Không upload, không đổi database. `validateFile` dùng được riêng trong feature.
- Badge trạng thái D luôn có chữ Minh họa; không gửi trạng thái DEMO vào bảng F. Loading/empty/error là component riêng; không thay API lỗi bằng mock.

## Shell, route và responsive

`AppShell` dùng cấu hình role từ registry, không nhân bản bốn sidebar. Desktop >=1024px sidebar 240px, tablet 768–1023px sidebar icon có title, mobile <768px drawer. Menu active dùng exact route. Có skip link và breadcrumb.

Registry tại `src/app/ui-inventory.ts`; inventory tài liệu sinh bằng `node scripts/generate-ui-inventory.mjs`. Khi hoàn thiện feature, thay SkeletonPage bằng page feature ở router và giữ contract shared. Modal thuộc trang cha, không tạo route riêng. Menu chọn role chưa xác thực/phân quyền; guards/Auth/RLS được tích hợp sau.

Form hai cột desktop → một cột mobile. DataTable chuyển thành card trên mobile và có nút sort. Dùng class stack/stack-sm/row; tránh width cứng làm overflow. PhotoPlaceholder giữ tỉ lệ 4:3 khi ảnh thiếu/hỏng.

## Quy tắc mở rộng và review

Component/tokens mới cần review chung trước khi nhân rộng. PR UI ghi UI ID, ảnh 1440/390px và kết quả typecheck/unit/system/build. Ghi khác biệt thiết kế trong phần Quyết định thiết kế của tài liệu này. Không thêm lint/CI. Không coi test skeleton là test nghiệp vụ.

## Kiểm thử

`npm run test:unit` kiểm tra controls, sorting, modal/tabs/focus, formatter và registry. `npm run test:system` mở cả production preview 4173 và dev server 5173; để hai port trống. Production không có `/dev/ui`; UI-kit tests dùng dev server. Giai đoạn 2 chưa yêu cầu screenshot; suite không chụp ảnh bàn giao, vẫn kiểm tra responsive. Trình duyệt cần Chromium từ `npx playwright install chromium`.

Chưa có người thứ hai thử trực tiếp: việc tái sử dụng trên máy developer khác phải ghi Chưa kiểm chứng.

## Quyết định thiết kế

- Giữ brand SmartFruit theo repo hiện tại; kế thừa phong cách LogStar UI v1, không đổi schema hoặc project Supabase.
- Primary #167843 thay leaf #1FA85C ở nền button có chữ trắng để đạt contrast >=4.5; leaf vẫn là token màu gốc. Muted #526157 và input border #87968B giúp đọc/phân biệt controls trên nền sáng.
- Font self-host qua Fontsource có tiếng Việt, tránh phụ thuộc Google Fonts runtime. H1 dùng Fraunces; controls/headings nhỏ dùng Plus Jakarta Sans.
- Skeleton chưa là dashboard nghiệp vụ: không KPI giả, không nút giao dịch, không gọi backend. Mẫu dữ liệu chỉ ở `/dev/ui` và có nhãn minh họa.
- Modal là slot tại trang cha; không tạo route riêng. BUI-05 có mục tiêu F vì chi tiết lô là đọc thật; các modal giao dịch/OTP là D.
- Mobile dùng drawer và table cards; tablet dùng sidebar icon. Auth/guards thật chưa tích hợp, lựa chọn role không cấp quyền.
- `/dev/ui` chỉ đăng ký và lazy-load khi import.meta.env.DEV; production truy cập đường dẫn này trả 404. Không public trang developer trong bản build.
- Admin theo inventory đề xuất; chưa tuyên bố giống mockup gốc. Không thêm khóa tài khoản hoặc tài chính thật.
- Date input native có format theo trình duyệt; các giá trị đọc/preview dùng dd/mm/yyyy và timezone Việt Nam.

## Inventory màn hình

<!-- UI-INVENTORY:START -->
Sinh từ `src/app/ui-inventory.ts` bằng `node scripts/generate-ui-inventory.mjs` (Node 24). Chỉ vùng giữa hai marker được cập nhật; không sửa tay bảng này. Hướng dẫn và quyết định bên ngoài vùng được giữ nguyên.

42 mục: 35 trang và 7 modal slots. Modal chưa có nội dung nghiệp vụ; chỉ được ghi nhận tại trang cha. `/404` và catch-all dùng cùng thông báo AUTH-04. Owner là người hoàn thiện feature; matching algorithm thuộc B, UI Farmer thuộc A.

F/D/U là mức mục tiêu khi triển khai nghiệp vụ, không có nghĩa skeleton đã lưu dữ liệu hoặc kiểm tra quyền. Menu role chỉ phục vụ trình bày.

| UI ID | Màn hình | Route / trang cha | Loại | Owner | Mức mục tiêu | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| FUI-01 | Tổng quan | /farmer/dashboard | page | A | D | Skeleton |
| FUI-02 | Hồ sơ nhà vườn | /farmer/profile | page | A | F | Skeleton |
| FUI-03 | Danh sách lô hàng | /farmer/lots | page | A | F | Skeleton |
| FUI-04 | Tạo / sửa lô hàng | /farmer/lots/new | page | A | F | Skeleton |
| FUI-05 | Người mua phù hợp | /farmer/matches | page | A | F | Skeleton |
| FUI-06 | Tìm xe | /farmer/transport | page | A | D | Skeleton |
| FUI-07 | Đàm phán | /farmer/chat | page | A | D | Skeleton |
| FUI-09 | Đánh giá & tín nhiệm | /farmer/reviews | page | A | D | Skeleton |
| FUI-10 | Giá tham khảo | /farmer/prices | page | A | D | Skeleton |
| FUI-11 | Thời tiết & khuyến nghị | /farmer/weather | page | A | D | Skeleton |
| FUI-12 | Bản đồ thương lái | /farmer/map | page | A | D | Skeleton |
| FUI-13 | Thông báo / chính sách | /farmer/notifications | page | A | U | Skeleton |
| FUI-08 | Xác nhận đàm phán | /farmer/chat | modal | A | D | Skeleton (slot) |
| BUI-01 | Tổng quan | /buyer/dashboard | page | B | D | Skeleton |
| BUI-02 | Tạo yêu cầu thu mua | /buyer/requests/new | page | B | F | Skeleton |
| BUI-03 | Nhu cầu thu mua | /buyer/requests | page | B | F | Skeleton |
| BUI-04 | Tìm lô hàng | /buyer/lots | page | B | F | Skeleton |
| BUI-07 | Đàm phán | /buyer/chat | page | B | D | Skeleton |
| BUI-10 | Tìm xe | /buyer/transport | page | B | D | Skeleton |
| BUI-11 | Đánh giá & tín nhiệm | /buyer/reviews | page | B | D | Skeleton |
| BUI-12 | Bản đồ nhà vườn | /buyer/map | page | B | D | Skeleton |
| BUI-13 | Thông báo / chính sách | /buyer/notifications | page | B | U | Skeleton |
| BUI-05 | Chi tiết lô hàng | /buyer/lots | modal | B | F | Skeleton (slot) |
| BUI-06 | Lời mời từ nhà vườn | /buyer/chat | modal | B | D | Skeleton (slot) |
| BUI-08 | Xác nhận đơn hàng | /buyer/chat | modal | B | D | Skeleton (slot) |
| BUI-09 | Hẹn khảo sát vườn | /buyer/chat | modal | B | D | Skeleton (slot) |
| CUI-01 | Tổng quan | /carrier/dashboard | page | A | D | Skeleton |
| CUI-02 | Hồ sơ & danh sách xe | /carrier/vehicles | page | A | F | Skeleton |
| CUI-03 | Yêu cầu vận chuyển | /carrier/requests | page | A | D | Skeleton |
| CUI-05 | Theo dõi chuyến | /carrier/tracking | page | A | D | Skeleton |
| CUI-06 | Đánh giá tài xế | /carrier/reviews | page | A | D | Skeleton |
| CUI-04 | Chi tiết / báo giá nhận chuyến | /carrier/requests | modal | A | D | Skeleton (slot) |
| AUI-01 | Tổng quan vận hành | /admin/dashboard | page | B | D | Skeleton |
| AUI-02 | Quản lý người dùng | /admin/users | page | B | D | Skeleton |
| AUI-03 | Quản lý lô hàng | /admin/lots | page | B | D | Skeleton |
| AUI-04 | Nhu cầu thu mua | /admin/requests | page | B | D | Skeleton |
| AUI-05 | Yêu cầu xe | /admin/transports | page | B | D | Skeleton |
| AUI-06 | Giá / chính sách / cấu hình | /admin/settings | page | B | U | Skeleton |
| AUTH-01 | Đăng nhập | /auth/login | page | B | F | Skeleton |
| AUTH-02 | Đăng ký | /auth/register | page | B | D | Skeleton |
| AUTH-03 | OTP minh họa (chưa triển khai) | /auth/register | modal | B | D | Skeleton (slot) |
| AUTH-04 | Không có quyền / không tìm thấy | /403 | page | B | U | Skeleton |

AUTH-02/03 giữ đăng ký/OTP demo theo TDD v0.4. AUTH-04 là UI trạng thái. Admin là thiết kế đề xuất, chưa có mockup chi tiết được duyệt.
FUI-13/BUI-13 gộp thông báo/chính sách mức U trong nền này; khi điền feature, phần thông báo fixtures là D, phần văn bản chưa có nghiệp vụ là U.
<!-- UI-INVENTORY:END -->
