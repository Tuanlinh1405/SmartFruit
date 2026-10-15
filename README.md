# SmartFruit

SmartFruit MVP: React/Supabase theo TDD; hiện repo có tài liệu, schema và kiểm thử database.

Nhánh Linh đã cung cấp code Auth, Buyer, Admin demo và matching theo quy tắc; pipeline vector/graph có migration, worker, Edge Function và cờ bật riêng. Các module này chưa được nối vào router chung (xem mục tích hợp bên dưới).

Farmer/Carrier đã có các màn minh họa tương tác. Các panel dữ liệu thật (hồ sơ, lô/ảnh, đội xe và matching) cần nối Auth/guards và scorer chung đã có từ B vào production; menu chọn khu vực không cấp quyền dữ liệu.

```powershell
npm run dev
npm run test:unit
npx playwright install chromium
npm run test:system
```

System suite gồm UI production và test harness độc lập có repository giả, không chứng minh persistence/RLS thực. Không có CI/lint. [Contract UI và cách tích hợp phần A](docs/ui.md).

Migration `202610150001_lot_image_lifecycle.sql` mới chỉ được chuẩn bị và kiểm thử local, chưa xác nhận áp cloud. Project đã có schema không chạy lại deploy.sql; cần review/apply migration bổ sung trước test Storage/RPC thực. [Hướng dẫn môi trường SDK test](docs/database-schema.md).

Cấu hình Supabase cho thành viên trong nhóm (Node.js 24 LTS, >=24.11.0 <25):

```powershell
npm ci
npm run setup:supabase
npm run check:supabase
npm run typecheck
npm test
npm run dev
```

URL/publishable key thực đã có trong `.env.example`; setup tạo `.env.local` riêng trên từng máy và không ghi đè file có sẵn. Client chung nằm ở `src/lib/supabase.ts`. [Hướng dẫn cho Dev A/B và quyền Dashboard](docs/supabase-team-setup.md).

Mở `http://localhost:5173` để xem giao diện chung hiện tại. Trong module App riêng của B (chưa mount), Auth dùng SĐT quốc tế và mật khẩu Supabase Auth của tài khoản được cấp sẵn. Theo quyết định ngày 15/10/2026, bỏ OTP và luồng đăng ký demo; không cần dịch vụ SMS. Sáu hồ sơ seed không có mật khẩu, nên không thể đăng nhập bằng chúng. Route Buyer: `/buyer`, `/buyer/profile`, `/buyer/requests`, `/buyer/lots`; lời mời/chat/vận chuyển/đánh giá là demo có nhãn. Admin dùng Auth role `ADMIN`, nội dung quản lý là fixture; Farmer/Carrier dùng `/role-home` chờ Dev A gắn giao diện.

`VITE_MATCHING_MODE=rule-only` là mặc định. Migration [hybrid search](supabase/migrations/202610150001_hybrid_search.sql) đã áp ngày 15/10/2026 trên project LogStar: 6 tài liệu lô, 5 tài liệu nhu cầu và 11 job embedding; vector hiện bằng 0 vì chưa có host/model worker. Worker/model và cách bật chức năng ở [hướng dẫn embedding](services/embedding/README.md). Edge Function và inference service chưa deploy, nên không bật `hybrid` cho người dùng. SQL đã kiểm tra cả Buyer/Farmer, vector cosine, alias graph, RLS trong transaction rollback bằng [smoke test](supabase/tests/hybrid-cloud-smoke.sql).

- [Kế hoạch Developer B](docs/dev-b-plan.md)
- [Kế hoạch code UI, backend và thuật toán](docs/code-implementation-plan.md)
- [Kế hoạch matching vector + graph](docs/vector-graph-matching-plan.md)
- [Database schema, ERD và contract tích hợp](docs/database-schema.md)
- [Biên bản triển khai Supabase](docs/database-deployment.md)
- [Cấu hình ứng dụng và Dashboard cho Dev A/B](docs/supabase-team-setup.md)
- [Dữ liệu demo và kịch bản kiểm thử](docs/demo-data.md)
- [Migration SQL](supabase/migrations/202610140001_initial_schema.sql)
- [Migration matching](supabase/migrations/202610150001_hybrid_search.sql)
- [Gói cài đặt SQL Editor](supabase/deploy.sql)
- [Kiểm tra trước triển khai](supabase/preflight.sql)
- [Xác minh sau triển khai](supabase/verify-deployment.sql)

Đã triển khai ngày 14/10/2026 lên project LogStar `yyslykqpamnlqkvutrlm`: 12 bảng bật RLS, catalog trái cây và bucket ảnh private. Migration matching bổ sung được áp ngày 15/10/2026. Xem biên bản triển khai để biết phạm vi đã xác minh.

Ngày 15/10/2026 đã seed 6 hồ sơ demo không có mật khẩu, 6 lô hàng, 5 nhu cầu thu mua và 3 xe. Bộ kiểm tra hiện có 95 kiểm tra local đạt. Script demo nằm riêng trong `supabase/seeds/demo.sql`, không thuộc gói deploy schema.

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

Trang đầu và các route skeleton chưa có nghiệp vụ; chạy được khi chưa cấu hình Supabase.
Khi dùng client Supabase, chạy `npm run setup:supabase` trước. Cả export
`supabase` và `getSupabaseClient()` dùng chung một instance với cấu hình Auth/RLS.

Playwright tự build và chạy production preview tại http://127.0.0.1:4173,
cùng dev server tại http://127.0.0.1:5173 để kiểm tra UI kit development-only.
Để hai port 4173/5173 trống; lần đầu cài Chromium cần mạng. Nếu PowerShell chặn
`npm.ps1`, dùng `npm.cmd` thay cho `npm`.

`src/app` chứa providers, router và registry skeleton; `src/components` và
`src/layouts` chứa UI kit và shell dùng chung. Developer A phụ trách Farmer/Carrier;
Developer B phụ trách Buyer/Admin/Auth. `src/test` và `tests/system` chứa
kiểm thử ứng dụng; `supabase/tests` chứa kiểm thử database.

Baseline kỹ thuật: [TechnicalDocumentDesign](Description/TechnicalDocumentDesign.md).

## Giai đoạn 2 — UI chung (mốc lịch sử)

- Chạy `npm run dev`, mở `/dev/ui` để xem UI kit và hai mẫu local danh sách/form-preview.
- [Tài liệu UI chung](docs/ui.md): phong cách, component, cách ghép feature, inventory và quyết định thiết kế.
- Cập nhật vùng inventory trong tài liệu UI sau đổi registry: `node scripts/generate-ui-inventory.mjs`.
- Giai đoạn 2 chưa yêu cầu screenshot; system tests vẫn kiểm tra responsive và tương tác UI.
- `/dev/ui` không có trong production; menu role chỉ là skeleton, chưa xác thực/phân quyền.
- Không thêm CI/lint. Dừng sau [đánh giá giai đoạn 2](docs/stage-2-assessment.md), chưa triển khai CRUD/matching/chat/vận chuyển.

Không commit mật khẩu, service-role key, database URL hoặc thông tin đăng nhập. Không chạy lại các migration đã áp dụng bằng SQL Editor trên project dùng chung. Kiểm thử HTTP đăng nhập/CRUD/ảnh với tài khoản thật và benchmark chất lượng E5 còn cần thực hiện khi có tài khoản test và host inference.

## Tích hợp code nhánh Linh

Code Auth/Buyer/Admin và matching của Linh đã được hợp nhất. Entrypoint hiện vẫn là `src/main.tsx` → `AppRouter` của giao diện chung; `src/app/App.tsx` của B chưa được mount. CSS của B được giữ riêng trong `src/app/b-styles.css` để tránh ghi đè UI kit A. Bước tiếp theo là hợp nhất route/guards/providers và style trước khi nghiệm thu luồng dữ liệu thật.

Hai migration có cùng prefix `202610150001` từ hai nhánh: cần đối chiếu migration history cloud trước khi cấp version mới hoặc áp migration còn thiếu. Không chạy migration/deploy.sql tự động.

SQL tests local dùng PGlite + pgvector; chạy `npm ci --ignore-scripts --prefix supabase/tests` sau khi cập nhật nhánh. Các kiểm tra vector dùng vector tổng hợp, không xác minh chất lượng model E5 hoặc dịch vụ Auth/Storage HTTP.
