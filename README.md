# SmartFruit

SmartFruit MVP: React/Supabase theo TDD; hiện repo có tài liệu, schema và kiểm thử database.

Cấu hình Supabase cho thành viên trong nhóm (Node.js 24 LTS, >=24.11.0 <25):

```powershell
npm ci
npm run setup:supabase
npm run check:supabase
npm run typecheck
```

URL/publishable key thực đã có trong `.env.example`; setup tạo `.env.local` riêng trên từng máy và không ghi đè file có sẵn. Client chung nằm ở `src/lib/supabase.ts`. [Hướng dẫn cho Dev A/B và quyền Dashboard](docs/supabase-team-setup.md).

- [Kế hoạch Developer B](docs/dev-b-plan.md)
- [Database schema, ERD và contract tích hợp](docs/database-schema.md)
- [Biên bản triển khai Supabase](docs/database-deployment.md)
- [Cấu hình ứng dụng và Dashboard cho Dev A/B](docs/supabase-team-setup.md)
- [Migration SQL](supabase/migrations/202610140001_initial_schema.sql)
- [Gói cài đặt SQL Editor](supabase/deploy.sql)
- [Kiểm tra trước triển khai](supabase/preflight.sql)
- [Xác minh sau triển khai](supabase/verify-deployment.sql)

Đã triển khai ngày 14/10/2026 lên project LogStar `yyslykqpamnlqkvutrlm`: 12 bảng bật RLS, catalog trái cây và bucket ảnh private. Kiểm thử: 90 kiểm tra local và 16 kiểm tra cloud đạt; không có tài khoản test lưu lại. Xem biên bản triển khai để biết phạm vi đã xác minh.

Kiểm thử database cục bộ:

```powershell
cd supabase/tests
npm ci --ignore-scripts
npm test
npm test -- --deploy
```

Tạo lại gói deploy sau khi sửa migration/seed:

```powershell
node supabase/scripts/build-deploy.mjs
```

Không commit mật khẩu, service-role key hoặc thông tin đăng nhập. Không chạy initial migration lần thứ hai trên project đã cài đặt.

## Ứng dụng React và kiểm thử

```powershell
npm run dev
npm run typecheck
npm run test:unit
npm run build
npx playwright install chromium
npm run test:system
```

Trang khởi động chưa có nghiệp vụ và chạy được khi chưa cấu hình Supabase.
Khi dùng client Supabase, chạy `npm run setup:supabase` trước. Cả export
`supabase` và `getSupabaseClient()` dùng chung một instance với cấu hình Auth/RLS.

Playwright tự build và chạy production preview tại http://127.0.0.1:4173.
Để port 4173 trống; lần đầu cài Chromium cần mạng. Nếu PowerShell chặn
`npm.ps1`, dùng `npm.cmd` thay cho `npm`.

`src/app` chứa providers, router và trang khởi động; `src/components` và
`src/layouts` giữ chỗ cho UI. Developer A phụ trách Farmer/Carrier;
Developer B phụ trách Buyer/Admin/Auth. `src/test` và `tests/system` chứa
kiểm thử ứng dụng; `supabase/tests` chứa kiểm thử database.

Baseline kỹ thuật: [TechnicalDocumentDesign](Description/TechnicalDocumentDesign.md).
