# SmartFruit

React + TypeScript + Vite + Tailwind, React Router, TanStack Query và Supabase theo [TDD](Description/TechnicalDocumentDesign.md). A phụ trách Farmer/Carrier; B phụ trách Auth/Buyer/Admin và scoring chung.

## Cài đặt và chạy

Node.js >=24.11.0 <25, npm và Chromium cho Playwright:

```powershell
npm ci
npm run setup:supabase
npm run check:supabase
npm run dev
```

Mở http://127.0.0.1:5173. Setup tạo `.env.local` từ cấu hình public của project LogStar, không ghi đè file có sẵn. Không commit mật khẩu, secret/service-role key hoặc tài khoản test. Nếu PowerShell chặn npm.ps1, dùng `npm.cmd`.

## Ứng dụng đã tích hợp

- Một router và AuthProvider dùng chung. `/login` dùng email hoặc SĐT quốc tế/password; `/auth/login`, `/register`, `/auth/register` chuyển về login. Không có OTP/đăng ký demo.
- Farmer: `/farmer/dashboard`, `/farmer/profile`, `/farmer/lots`, `/farmer/lots/new`, `/farmer/lots/:id`, `/farmer/lots/:id/edit`, `/farmer/matches`.
- Carrier: `/carrier/dashboard`, `/carrier/vehicles`; dashboard và các màn transport/chat/reviews/market helpers A là D/U có nhãn.
- Buyer/Admin giữ các route từ Linh dưới guard đúng role; `/buyer/dashboard` và `/admin/dashboard` là alias. Buyer profile ở `/buyer/profile`; requests có create/edit; `/buyer/lots` là tìm lô. Registry cũ chưa phải bằng chứng mọi màn B đã hoàn tất.
- Role lấy từ `profiles` của session, không có role selector cấp quyền. Thiếu role chờ quản trị cấp; lỗi tải profile có retry/logout. Đổi user/logout thay query cache, input và demo state; token refresh cùng user giữ input.
- `AFeaturePage` mount dưới guard Farmer/Carrier; matching dùng `rankRequestMatches` của B, rule-only, chung rule version. Không cần embedding hosting để chạy phần này.
- UI kit/tokens A được giữ; CSS Buyer/Admin nằm trong scope `.b-workspace`.

Các dòng seed không tự tạo mật khẩu. Nếu đã có tài khoản Supabase Auth bằng email/SĐT và mật khẩu, dùng trực tiếp. Để test thủ công A có thể bắt đầu bằng một account FARMER, sau đó CARRIER; sáu account chỉ cần cho bộ test tự động đầy đủ. Chủ project cấp account/role qua quy trình quản trị tin cậy; không tạo user hoặc cấp role từ frontend.

## Kiểm thử độc lập

```powershell
npm ci --ignore-scripts --prefix supabase/tests
npx playwright install chromium
npm run typecheck
npm run test:unit
npm run test:database
npm --prefix supabase/tests test -- --deploy
npm run test:system
npm run build
```

Playwright dùng port riêng **4175/5175** (để trống hai port này). Production-route tests dùng Supabase SDK thật nhưng HTTP mock trong test; harness riêng dùng repository fixture. Các test này không chứng minh persistence/RLS/Storage HTTP thật. Không có mock login/scoring trong production, không có CI/lint.

Harness development: `http://127.0.0.1:5173/tests/harness/index.html?panel=profile` (hoặc lots/new/carrier/matching). Chỉ test local, refresh reset dữ liệu; không có trong router hoặc bundle production. UI kit ở `/dev/ui`, development-only.

## Nghiệm thu Supabase thật

Môi trường đã chọn: LogStar `yyslykqpamnlqkvutrlm`. Kết nối public/anonymous có thể kiểm tra bằng `check:supabase`; không đồng nghĩa đã nghiệm thu login/CRUD/Storage.

1. Xác nhận migration history cloud và migration ảnh A đã áp hay chưa. Hai file đang có cùng prefix `202610150001`; không đổi tên hoặc chạy lại trước khi đối chiếu. `supabase/verify-deployment.sql` là truy vấn read-only, có kiểm tra sự tồn tại hai lifecycle RPC.
2. Chuẩn bị sáu tài khoản test **khác nhau**: farmer1/farmer2/carrier1/carrier2/buyer/admin với role đúng. Dùng tài khoản riêng cho test, không dùng tài khoản người dùng thật.
3. Cấu hình biến môi trường local `A_TEST_SUPABASE_URL`, `A_TEST_SUPABASE_KEY` (publishable) và `A_TEST_ACCOUNTS` (JSON mỗi key chứa email/password hoặc phone/password). Không ghi credentials vào repo hoặc VITE_*.
4. Chạy SDK suite với `RUN_A_LIVE=1`: `npm run test:integration`. Mặc định suite này skip, không tính Pass.
5. Chạy `npm run test:system:live`: runner kiểm tra cấu hình rồi build app trỏ tới project test và chỉ chạy project Playwright a-live. Thiếu cấu hình thì dừng. Live tests tắt trace/screenshot/video, dùng tag/UUID riêng, cleanup và phục hồi domain profile đã sửa.

SQL local dùng PGlite + pgvector; vector tổng hợp không chứng minh chất lượng model E5. HTTP mock không thay thế RLS. Dữ liệu test không reset database chung; cleanup lỗi phải được xử lý theo IDs được báo.

## Database và triển khai

Baseline đã được ghi nhận triển khai ngày 14/10/2026; tài liệu B ghi hybrid migration áp ngày 15/10/2026. Trạng thái migration ảnh và nghiệm thu HTTP ứng dụng cần xác nhận riêng.

Không chạy lại `supabase/deploy.sql` trên project đã cài. File này chỉ dành cho cài mới, sinh bằng `node supabase/scripts/build-deploy.mjs`; việc generate không triển khai lên cloud. Pipeline vector/graph của B là prototype, không tự bật hybrid khi Edge Function/model/worker chưa sẵn sàng.

- [UI chung, contract và inventory](docs/ui.md)
- [Schema, RLS và tài khoản](docs/database-schema.md)
- [Biên bản database](docs/database-deployment.md)
- [Cấu hình nhóm Supabase](docs/supabase-team-setup.md)
- [Kế hoạch Developer B](docs/dev-b-plan.md)
- [Dữ liệu demo](docs/demo-data.md)
- [Embedding prototype](services/embedding/README.md)

A/B chia feature, dùng chung client/router/UI kit; mọi thay đổi schema/RLS cần review chéo. PR ghi hành vi thay đổi và kết quả kiểm thử, phân biệt mock/local/live. Không tự commit/push/deploy từ script kiểm thử.
