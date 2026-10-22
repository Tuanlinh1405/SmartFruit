# Đưa OnlMallFruit lên Vercel

Đích do người dùng chọn: https://onlmallfruit.vercel.app. Frontend Vite chạy ở đường dẫn gốc; backend tiếp tục dùng project Supabase hiện có. Chạy localhost cũng kết nối cùng database cloud theo .env.local, không có database local tự sinh dữ liệu thông báo.

## Cấu hình website

Repository đã có vercel.json: framework Vite, install bằng npm ci --no-audit --no-fund, build bằng npm run build:vercel, output dist, rewrite SPA về index.html để tải lại các đường dẫn /farmer/dashboard, /farmer/notifications và /policy được. Build Vercel giữ các bước kiểm thử, TypeScript, kiểm tra biến công khai và quét artifact từ main. Dùng Node 24 phù hợp package.json. Không dùng npm run build:pages vì lệnh đó dành cho tiền tố /SmartFruit/ trên GitHub Pages.

Thiết lập biến môi trường frontend trong Vercel, lấy giá trị công khai từ .env.example:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_MATCHING_MODE theo cấu hình đang nghiệm thu, hiện là hybrid
- VITE_MAP_STYLE_URL nếu muốn ghi đè mặc định

Các backend key không cần cho bản build frontend. OPENROUTER_API_KEY và FARMER_CHAT_ALLOWED_ORIGINS thuộc Supabase Edge Function farmer-chat; SUPABASE_SECRET_KEY dùng cho script quản trị trên máy developer, không đưa vào trình duyệt.

## Backend phải sẵn sàng trước khi nghiệm thu

1. Áp đúng supabase/migrations/202610220001_customer_feedback.sql bằng SQL Editor hoặc kết nối database được cấp. Không chạy lại baseline hay reset project.
2. Chạy npm run check:feedback. Bảng notifications, transport_requests và my_review_summary phải sẵn sàng.
3. Chạy npm run seed:notifications -- --apply để thêm 7 thông báo mẫu đã xác thực cho farmer3. Chạy lại giữ nguyên các bản ghi và trạng thái đã đọc.

Các bước này cần thực hiện cả khi chỉ thử website trên localhost. Deploy lên Vercel không tự chạy migration hoặc seed database.

## Đăng ký và trợ lý AI trên domain mới

Trong Supabase Auth URL Configuration, đặt Site URL thành https://onlmallfruit.vercel.app và cho phép redirect https://onlmallfruit.vercel.app/role-home. Giữ các redirect localhost cần thiết cho phát triển, ví dụ http://localhost:5173/role-home và http://127.0.0.1:5173/role-home. Ứng dụng tạo emailRedirectTo dựa trên origin đang truy cập.

Đặt FARMER_CHAT_ALLOWED_ORIGINS trên Edge Function thành danh sách origin thực tế, bao gồm https://onlmallfruit.vercel.app và các localhost đang dùng. Chỉ ghi origin, không thêm /farmer hoặc /role-home. Có thể chuẩn bị file secret được Git bỏ qua bằng:

```powershell
node scripts/prepare-farmer-chat-env.mjs --origin=https://onlmallfruit.vercel.app
```

Lệnh trên chỉ chuẩn bị cấu hình local, không tự cập nhật secret trên Supabase. Nếu Vite đang chạy cổng khác 5173 thì bổ sung đúng origin của cổng đó. Đăng nhập và Data API Supabase không dùng allowlist riêng của farmer-chat; thiếu origin ở đây chỉ ảnh hưởng trợ lý.

Sau deploy kiểm tra: tải lại trực tiếp /farmer/dashboard, đăng nhập farmer3, mở chuông và danh sách thông báo, đánh dấu đã đọc rồi F5, mở liên kết giao dịch/matching, gửi một câu hỏi trợ lý và kiểm tra email đăng ký chuyển về đúng domain.

Tham khảo: [Vite SPA trên Vercel](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas), [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

Chưa publish website, áp migration hoặc cập nhật cấu hình cloud trong lượt chuẩn bị này.
