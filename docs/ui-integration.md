# Tích hợp khung UI Dev A — 15/10/2026

Nguồn: [PR #2 · Feature/UI skeleton](https://github.com/Tuanlinh1405/SmartFruit/pull/2), nhánh `feature/ui-skeleton`, commit `47d988ad7c34c93148f40848da9ca00edd151f03`. Tích hợp trên nhánh `Linh`; PR UI được lấy làm nguồn, chưa merge PR trên GitHub.

## Đã ghép

Lấy tokens, fonts, components UI/shared, responsive AppShell/AuthLayout, UI registry và trang xem UI kit của Dev A. Giữ nghiệp vụ thật và nối vào menu/route mới, thay phần chọn role/skeleton của PR bằng AuthProvider/RoleGuard hiện có.

| Khu vực | Tính năng đã nối vào giao diện |
| --- | --- |
| Auth | Email hoặc SĐT + mật khẩu, session, chặn sai role/tài khoản khóa, đăng xuất thật; không OTP |
| Buyer | Dashboard từ DB, hồ sơ, tạo/sửa/đóng nhu cầu, tìm lô/matching và modal chi tiết |
| Buyer/Farmer | Lời mời, chat, đề nghị/thỏa thuận, xác nhận hoàn tất và đánh giá đã có |
| Admin | Tổng quan, quản lý/lọc người dùng, xem/sửa hồ sơ, khóa quyền dùng app, đóng tin, tổng quan kết nối |
| Farmer/Carrier | Hồ sơ lưu thật; đọc lô, tìm người mua, giao dịch Farmer; đọc phương tiện Carrier |

Form đăng nhập/hồ sơ Buyer/nhu cầu và modal Admin/lô dùng controls chung. Các trang danh sách, chat và workspace giữ state/API hiện có, được nối styles vào tokens chung. URL cũ tiếp tục hoạt động, `/dev/ui` chỉ đăng ký trong dev.

## Ranh giới cần giữ khi Dev A làm tiếp

Cập nhật sau tích hợp: form nhu cầu chỉ có một ô **Tên nông sản**, ví dụ `Sầu riêng Ri6`; bỏ bộ chọn loại/giống, tên nhu cầu và phân loại riêng. Giữ nguyên tên để rerank, nhận loại từ danh mục đang hoạt động để đáp ứng FK bắt buộc hiện có; tên giống mới vẫn lưu cùng tên sản phẩm, không tự đoán variety_id. Nếu tên chưa nhận ra loại, form báo nhập tên đầy đủ, không tự gán loại mặc định. Khi sửa tên sản phẩm, xóa metadata giống/phân loại cũ để không lọc sai; tên không đổi giữ metadata của bản ghi cũ. Chưa thay schema hoặc mở rộng catalog.

- `src/components/ui`, `src/components/shared`, `src/styles/tokens.css`, `src/styles/ui.css`: nền UI chung; `src/styles/features.css` dành cho bố cục nghiệp vụ.
- `src/app/App.tsx`: route và guards thật; `src/layouts/app-shell.tsx` dùng profile/session, không thêm role picker để cấp quyền.
- `src/app/ui-inventory.ts`: menu + trạng thái. Chạy `npm run ui:inventory` bằng Node 24 để cập nhật [UI inventory](ui.md).
- APIs nghiệp vụ, matching core, embedding service, Edge Function và migrations được giữ nguyên so với trước đợt ghép UI này. Không áp migration/cloud hoặc đổi cấu hình Supabase trong đợt này.
- Farmer tạo/sửa lô/upload ảnh, Carrier CRUD xe nâng cao còn theo phân công Dev A. Hiện danh sách tương ứng chỉ đọc.
- Map/khoảng cách, vận chuyển/tracking, giá/thời tiết/thông báo và tích hợp bên ngoài tiếp tục hoãn. Trang ghi rõ giới hạn, không giả thành công.
- Matching mặc định vẫn rule-only. E5 → vector top 20 → rerank đã có mã, còn chờ triển khai theo [ghi chú matching](matching-e5-top20.md).

## Kiểm chứng

- `npm test`: 9 file, **87 test đạt**; gồm matching, Admin, UI/shared, formatters và 11 trường hợp route/role. Route tests mock dữ liệu, không thay kiểm thử RLS.
- `npm run build`: đạt TypeScript + Vite production; còn cảnh báo chunk JS trên 500 kB.
- Trình duyệt dùng bản production preview: đăng nhập Buyer test bằng Supabase thật, xem dashboard/số liệu, danh sách lô, chọn nhu cầu và tìm `ri 6` trả 3 lô Ri6 cùng lý do/điểm giá-lượng.
- Form nhu cầu tải catalog thật và dùng controls chung; chat đọc lại tin nhắn/thỏa thuận đã lưu. Desktop 1265px không tràn ngang.
- Mobile 390×844: drawer, modal chi tiết đọc dữ liệu thật; Escape đóng và trả focus về nút mở; không tràn ngang (scrollWidth = clientWidth = 390).
- Không gửi lời mời/tin nhắn mới, tạo nhu cầu hoặc sửa hồ sơ cloud trong lượt QA này. Chưa chạy lại luồng giao dịch đầy đủ qua UI hoặc kiểm tra bằng mắt mọi role.
- Đối chiếu snapshot trước tích hợp: 50 file backend/matching/API giữ nguyên byte; `git diff --check` đạt.

Ảnh [desktop](assets/ui-integrated-desktop.jpg) và [modal mobile](assets/ui-integrated-mobile.jpg).

Sau khi gộp tên nông sản: **91 test đạt**, build đạt; đã xem form production và kiểm tra nhập `Sầu riêng Ri6` cập nhật preview. Test form xác nhận dữ liệu tên/lượng/giá/ngày được chuyển vào adapter lưu nháp mà không chọn loại/giống. [Ảnh form mới](assets/request-single-product-name.jpg).

Bản sao trước tích hợp giữ trong `tmp/before-dev-a-ui-integration.zip` (bị Git ignore), bảo toàn cả thay đổi chưa commit từ các lượt trước; không chứa file env/credential.
