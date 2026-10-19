# Đăng ký email/mật khẩu

Bổ sung ngày 19/10/2026 theo yêu cầu đăng ký đơn giản. Đây là thay đổi so với phạm vi tài khoản cấp sẵn trước đây; SMS OTP không thuộc luồng này.

## Luồng người dùng

- Trang đầu và trang đăng nhập có liên kết **Đăng ký**. `/register` là URL chính, `/auth/register` chuyển về cùng trang.
- Nhập họ tên, email, vai trò Nhà vườn/Thu mua/Vận tải, mật khẩu 8–128 ký tự và xác nhận mật khẩu.
- Form gọi Supabase Auth `signUp`; không lưu mật khẩu trong metadata hoặc database ứng dụng.
- Nếu Auth yêu cầu xác nhận email, hiển thị hướng dẫn kiểm tra email, không cấp phiên/role ở browser. Thông báo trung lập cũng phù hợp với phản hồi che giấu email đã tồn tại của Supabase.
- Sau xác nhận email rồi đăng nhập (hoặc khi project cho phép xác nhận tự động), AuthProvider hoàn tất role qua RPC và đọc lại `profiles` từ server. Người dùng vào workspace đúng vai trò và hoàn thiện hồ sơ nghiệp vụ bằng các trang hiện có.
- Không có lựa chọn Admin. Các tài khoản đã có role hoặc đang bị khóa không được đổi quyền qua đăng ký.

## Cài đặt trên Supabase hiện tại

1. Chạy **chỉ** migration tăng dần `supabase/migrations/202610190001_email_registration.sql` trong SQL Editor sau migration trading. Không chạy lại baseline/reset database. Có thể chạy lại migration này an toàn.
2. Trong Auth, bật Email provider và cho phép đăng ký mới nếu muốn mở public. Giữ cơ chế Confirm email theo cấu hình mong muốn; frontend hỗ trợ cả hai phản hồi có và không có session, không tự tắt xác nhận email.
3. Cấu hình Site URL/Redirect URLs để cho phép `<origin-frontend>/role-home`; ví dụ local `http://localhost:5173/role-home`. Link xác nhận phải quay về origin đã được cho phép.
4. Nếu bật xác nhận email, cần cấu hình gửi mail phù hợp. SMTP mặc định có giới hạn người nhận/tốc độ; lỗi gửi mail/quota được hiển thị trên form. Không coi test mock là bằng chứng email đã gửi được ngoài cloud.
5. Chạy `supabase/verify-deployment.sql`; `registration_rpc` phải khác NULL. Nghiệm thu bằng email test có hộp thư truy cập được: tạo tài khoản → nhận/xác nhận link → đăng nhập → đúng role → lưu hồ sơ → F5 → đăng xuất/đăng nhập lại.

## Quyền truy cập

Trigger tạo `profiles` hiện có vẫn bỏ qua role trong user metadata. Form chỉ gửi ý định `registration_role`.

RPC `complete_registration()` có search_path rỗng, chỉ authenticated gọi được, kiểm tra email đã xác nhận trong `auth.users`, khóa profile của chính `auth.uid()` và chỉ cấp FARMER/BUYER/CARRIER khi role còn NULL. Role đã cấp không đổi dù người dùng sửa metadata rồi gọi lại. Không mở quyền UPDATE role trực tiếp trên `profiles` và không sửa tài khoản cũ.

Nếu frontend chạy trước migration, tài khoản mới có thể được Auth tạo nhưng UI sẽ báo chưa cập nhật chức năng cấp vai trò. Sau khi cài migration, dùng nút thử lại/đăng nhập lại; không đăng ký thêm tài khoản trùng để xử lý lỗi.

## Kiểm thử

- `npm run build`
- `npx vitest run src/features/auth src/app/App.test.tsx --pool=threads --maxWorkers=2`
- `npm run test:database` (bao gồm kiểm tra đăng ký, role một lần, email chưa xác nhận, ADMIN giả mạo, khóa tài khoản và RLS hồ sơ nghiệp vụ).
- `npx playwright test tests/system/registration.spec.ts tests/system/skeleton.spec.ts tests/system/start.spec.ts --project=production`

Nguồn hành vi Auth: [Supabase signUp](https://supabase.com/docs/reference/javascript/auth-signup), [Password Auth](https://supabase.com/docs/guides/auth/passwords), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
