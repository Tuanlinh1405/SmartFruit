# UI chung SmartFruit

## Chuẩn giao diện Buyer dùng chung

Buyer là mẫu thị giác cho toàn web. Buyer, Farmer và Carrier dùng chung `src/layouts/app-shell.tsx`, menu cấu hình tại `src/app/navigation.ts`. Admin giữ bố cục quản trị, dùng cùng font, token và panel; trang đầu, đăng nhập và trạng thái dùng cùng UI kit.

Token nằm tại `src/styles/tokens.css`: nền #F6F7F2, chữ #17352B, primary #147C51, amber #F5AB24, sidebar gradient xanh đậm. Panel radius 17px, nút 11px, control 9px; shadow nhẹ. Typography dùng system sans-serif (ui-sans-serif/system-ui/Segoe UI), cùng stack với Buyer thực tế; không còn serif cho h1/brand và không tải font phụ thuộc mạng.

`src/styles.css` chứa base và cấu trúc component trong CSS layer; `src/styles/unified.css` chứa diện mạo chung, shell, responsive và style cho portal. `src/styles/dashboard.css` chứa pattern dashboard dùng chung. `src/app/b-styles.css` chỉ giữ bố cục feature Buyer/Admin trong scope riêng. Không bọc shell chung bằng scope của feature.

Heading h1 co giãn 1.8–2.55rem; control tối thiểu 44px, focus rõ và hỗ trợ reduced-motion. Nút accent dùng cho CTA nổi bật, primary cho tác vụ chính, secondary cho tác vụ phụ, danger cho hành động xóa. Không ghi màu/font mới trong feature khi có token phù hợp.

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

Shell chung cho Buyer/Farmer/Carrier có sidebar rộng 244px, topbar 70px, account card và đăng xuất. Sidebar cuộn khi menu dài. Ở ≤850px, điều hướng chuyển thành Drawer/Radix có focus trap, Escape và trả focus; menu tự đóng khi chọn trang. Ở ≤630px, dashboard chuyển một cột. Form/preview chuyển một cột ở ≤850px; bảng có card mobile; chat có chuyển vùng trên màn hình nhỏ.

Menu dùng `workspaceNavigation`, tách khỏi inventory trang/modal. Trang con tạo/xem/sửa lô vẫn active mục danh sách lô. Hồ sơ Farmer/Buyer đặt ở account card; hồ sơ Carrier trỏ về vehicles. Route và phân quyền giữ trong router/Auth guards; UI kit không import Supabase.

Registry tại `src/app/ui-inventory.ts` vẫn dùng cho kiểm kê ID/trang; không dùng registry làm menu Buyer vì route thực tế khác một số mục cũ. Các route nghiệp vụ và redirect giữ tương thích. Shell có skip link và breadcrumb; portal dùng style toàn cục để không mất font/token khi render ngoài workspace.

Kiểm tra hồi quy giao diện trong `tests/system/ui-unification.spec.ts`: viewport 320–1440px, hai phía breakpoint, menu mobile, portal và các trang feature. Ảnh dashboard được lưu trong output Playwright ở 1440px/390px.

## Quy tắc mở rộng và review

### Feature A đã nối Auth/scorer B

Các panel hồ sơ/lô/ảnh, Carrier/xe và matching đã được mount bởi `AFeaturePage` dưới guard Farmer/Carrier. User ID lấy từ Auth đã resolve; `/login` là đường đăng nhập chung. Route list/new/detail/edit có callback điều hướng; thiếu hồ sơ có nút hoàn thiện hồ sơ.

`SessionWorkspace` tạo cache mới và remount input/demo theo identity; logout, đổi account hoặc mất phiên không giữ dữ liệu phiên trước. Token refresh cùng user giữ form. `ADemoProvider` không ghi Supabase hoặc đồng bộ dữ liệu nhiều account.

Matching Farmer dùng adapter gọi `rankRequestMatches` rule-only của B. Query key chứa user/lot/rule version. Scoring nhận projection công khai tối thiểu, chỉ lô PUBLISHED và nhu cầu OPEN; không có điểm fixture trong production.

Từ detail/matching sang transport/chat D chỉ truyền snapshot whitelist công khai; không truyền floor/notes. UI D luôn có nhãn. CSS của Buyer/Admin được scope `.b-workspace`, không ghi đè các control/sidebar A.

`npm run test:system` chạy main router với HTTP mock và harness độc lập ở port 4175/5175; không thay thế nghiệm thu database. Harness không có trong production. SDK suite `test:integration` mặc định skip; `test:system:live` yêu cầu tài khoản local, tắt trace/screenshot/video và cleanup đúng tag. Xem README và database-schema.md trước khi bật.

Component/tokens mới cần review chung trước khi nhân rộng. PR UI ghi UI ID và kết quả kiểm tra responsive/typecheck/unit/system/build; không tự tạo ảnh bàn giao. Ghi khác biệt thiết kế trong phần Quyết định thiết kế của tài liệu này. Không thêm lint/CI. Không coi test skeleton là test nghiệp vụ.

## Kiểm thử

`npm run test:unit` kiểm tra controls, sorting, modal/tabs/focus, formatter và registry. `npm run test:system` mở cả production preview 4175 và dev server 5175; để hai port trống. Production không có `/dev/ui`; UI-kit tests dùng dev server. Giai đoạn 2 chưa yêu cầu screenshot; suite không chụp ảnh bàn giao, vẫn kiểm tra responsive. Trình duyệt cần Chromium từ `npx playwright install chromium`.

Chưa có người thứ hai thử trực tiếp: việc tái sử dụng trên máy developer khác phải ghi Chưa kiểm chứng.

## Quyết định thiết kế

- Giữ brand SmartFruit theo repo hiện tại; kế thừa phong cách LogStar UI v1, không đổi schema hoặc project Supabase.
- Primary #167843 thay leaf #1FA85C ở nền button có chữ trắng để đạt contrast >=4.5; leaf vẫn là token màu gốc. Muted #526157 và input border #87968B giúp đọc/phân biệt controls trên nền sáng.
- Font self-host qua Fontsource có tiếng Việt, tránh phụ thuộc Google Fonts runtime. H1 dùng Fraunces; controls/headings nhỏ dùng Plus Jakarta Sans.
- Dashboard/tiện ích D dùng fixtures có nhãn; dữ liệu mẫu không ghi vào bảng F. Các panel F dùng Supabase SDK sau Auth guard.
- Modal là slot tại trang cha; không tạo route riêng. BUI-05 có mục tiêu F vì chi tiết lô là đọc thật; các modal giao dịch là D; OTP đã bỏ.
- Mobile dùng drawer và table cards; tablet dùng sidebar icon. Auth/guards đã tích hợp; role từ profiles, quyền dữ liệu do RLS.
- `/dev/ui` chỉ đăng ký và lazy-load khi import.meta.env.DEV; production truy cập đường dẫn này trả 404. Không public trang developer trong bản build.
- Admin theo inventory đề xuất; chưa tuyên bố giống mockup gốc. Không thêm khóa tài khoản hoặc tài chính thật.
- Date input native có format theo trình duyệt; các giá trị đọc/preview dùng dd/mm/yyyy và timezone Việt Nam.

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
| AUTH-02 | Đăng ký | /auth/register | page | B | D | Đã bỏ; chuyển /login |
| AUTH-03 | OTP minh họa (chưa triển khai) | /auth/register | modal | B | D | Đã bỏ; chuyển /login |
| AUTH-04 | Không có quyền / không tìm thấy | /403 | page | B | U | UI trạng thái |

AUTH-02/03 giữ ID lịch sử nhưng đăng ký/OTP đã bỏ theo quyết định 15/10/2026. AUTH-04 là UI trạng thái. Buyer/Admin giữ route code Linh; registry cũ cần đối chiếu trước khi đánh dấu toàn bộ B hoàn tất.
FUI-13/BUI-13 gộp thông báo/chính sách mức U trong nền này; khi điền feature, phần thông báo fixtures là D, phần văn bản chưa có nghiệp vụ là U.
<!-- UI-INVENTORY:END -->
