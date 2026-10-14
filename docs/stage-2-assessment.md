# Đánh giá giai đoạn 2 — Skeleton và UI chung

Ngày: 15/10/2026, Asia/Saigon.

**Kết luận: Pass giai đoạn 2 trên môi trường local đã kiểm tra.** Có nền phong cách và component dùng chung để A/B tự hoàn thiện feature. Dừng trước giai đoạn 3; chưa kiểm chứng việc developer thứ hai tái sử dụng trên máy riêng.

## Phần đã triển khai

- Tokens nền kem/xanh rừng, font self-host Fraunces/Plus Jakarta Sans có tiếng Việt; primary #167843 dùng chữ trắng để đạt contrast >=4.5.
- UI kit controls, Badge/Tabs, Radix Modal/Drawer/ConfirmDialog, Toast; shared PageHeader/Card/FormLayout/FilterBar/DataTable và các trạng thái.
- Một AppShell dùng cấu hình bốn role, sidebar desktop/tablet, mobile drawer, skip link, breadcrumb và exact active menu.
- Inventory đủ 42 UI ID: 35 trang skeleton và 7 modal slots tại trang cha. `/404` và catch-all dùng chung AUTH-04. Modal slots chưa được dựng thành nghiệp vụ.
- Trang đầu chọn khu vực; Auth layout skeleton, 403/404; chưa có authentication/guards thật. Chọn role không cấp quyền dữ liệu.
- `/dev/ui` chỉ development: hai mẫu local danh sách và form-preview, cùng controls/overlays/status gallery.
- Tài liệu UI chung gồm hướng dẫn, inventory sinh từ registry và quyết định thiết kế; chưa yêu cầu screenshot bàn giao theo điều chỉnh của chủ dự án.

## Kết quả kiểm chứng

| Kiểm tra | Kết quả | Bằng chứng / phạm vi |
| --- | --- | --- |
| TypeScript | Pass | `npm run typecheck`, exit 0 |
| Unit/component | Pass | `npm run test:unit`: 21 tests, 5 files; controls, validation, formatter, numeric sort, empty/retry/image fallback, modal/focus/confirm, toast, tabs và inventory/navigation |
| Production build | Pass | Vite build thành công; font woff2 đóng gói local, gồm subset tiếng Việt |
| System regression | Pass | `npm run test:system`: 55 tests passed, 1.7 phút; 49 production + 6 dev UI kit |
| Route/refresh | Pass | Mở và refresh toàn bộ 35 trang; kiểm tra title, breadcrumb/menu active; không pageerror/console.error ở các route skeleton |
| Role shells | Pass | Cả bốn role ở 1440/768/390px; mobile drawer chọn link, focus trap, Esc và trả focus |
| UI kit tương tác | Pass | Filter/empty/status filter/sort; form invalid/valid, preview, chọn file sai định dạng; modal/drawer/confirm/toast, tabs keyboard |
| Production exclusion | Pass | `/dev/ui` trả 404; không có link UI kit; không thấy nội dung sample/UI kit trong output bundle |
| Responsive/visual | Pass | Kiểm tra overflow ở 1440/768/390px và xem bố cục lúc triển khai; text dài xuống dòng, ảnh hỏng có fallback. Không lưu screenshot bàn giao |
| Font/contrast/motion | Pass trong phạm vi kiểm tra | Browser xác nhận font tiếng Việt được tải; contrast primary/chữ trắng >=4.5; reduced-motion tắt transition |
| Không backend trong skeleton | Pass | Tests route và mẫu local không phát sinh request Supabase; component/layout/dev/app không import Supabase |
| Bảo toàn nền Supabase | Pass | Migration và client có SHA-256 trước/sau khớp; không sửa Auth/schema/config Supabase hoặc gọi setup/cloud test |
| Bảo toàn tài liệu gốc | Pass | Cả 5 file Description có hash trước/sau khớp |
| Không CI/lint/secrets mới | Pass trong phạm vi rà soát | Không thêm workflow/config/script lint; rà soát file mới không thấy private key hoặc sb_secret |
| Máy developer thứ hai | Chưa kiểm chứng | Có guide/mẫu ghép trang, chưa có người thứ hai chạy trực tiếp |
| Nghiệp vụ/DB/Auth thật | Chưa kiểm chứng ở giai đoạn này | Chủ đích chưa triển khai; test skeleton không chứng minh CRUD, RLS, matching hoặc giao dịch |

Lần chạy đầu phát hiện selector test khớp sai label bắt buộc, ảnh preview trùng tên file input và vùng loading trùng role status của toast. Đã scope selector đúng control/toast; lượt regression cuối không còn test thất bại. Nhãn menu dài đã được chỉnh để xuống dòng.

## Bằng chứng và hướng dẫn

- [Tài liệu UI chung](ui.md): contract, mẫu ghép trang, responsive, review, inventory owner/F/D/U/route và quyết định thiết kế. Hướng dẫn, inventory và decisions đã được gom vào một tài liệu; báo cáo nghiệm thu này giữ riêng.
- Screenshot từng được dùng để xem bố cục lúc triển khai; sau yêu cầu của chủ dự án, đã bỏ ảnh bàn giao và tắt tự chụp trong suite. Các assertions responsive/tương tác giữ nguyên.

Chạy `npm run dev`, mở `/dev/ui` để dùng gallery. `npm run test:system` dùng cả port 4173 và 5173; để hai port trống. Suite đã tự đóng server sau chạy.

## Hạn chế và mốc dừng

- Kiểm tra Chromium trên Windows; chưa kiểm chứng Firefox/WebKit, screen reader thực hoặc audit WCAG toàn diện.
- Date/file input native theo ngôn ngữ trình duyệt; giá trị ngày đọc/preview được formatter theo Việt Nam.
- Gallery cố tình thử ảnh không tồn tại để xác minh fallback; request ảnh mẫu thất bại là ca minh họa, không phải request backend hoặc lỗi JavaScript. Không xuất hiện trong production.
- Cảnh báo NO_COLOR/FORCE_COLOR là môi trường runner; không phải lỗi ứng dụng.
- Không có CRUD/matching/chat/booking thật; không sửa database, không commit/push/deploy, không chuyển giai đoạn 3.
- Không có lỗi blocker trong phạm vi đã kiểm tra.

Hash bảo toàn: migration `E22D37D5A17130B75138C5A8CFDEE0A01858A9ABD9243A9E9CBEF4E127179FB3`; client Supabase `85CB7983DFC969346AD1126C0D4731AF42DC1DEB5A5A379A66D2A4307C2A6911`. Hash năm tài liệu Description trùng baseline giai đoạn trước.
