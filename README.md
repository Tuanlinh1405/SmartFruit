# SmartFruit

LogStar MVP: React/TypeScript/Vite + Supabase theo TDD. Dev B đã có Auth, Buyer, Admin demo và matching theo quy tắc; pipeline vector/graph có migration, worker, Edge Function và cờ bật riêng.

Cấu hình Supabase cho thành viên trong nhóm (Node.js >=22):

```powershell
npm ci
npm run setup:supabase
npm run check:supabase
npm run typecheck
npm test
npm run dev
```

URL/publishable key thực đã có trong `.env.example`; setup tạo `.env.local` riêng trên từng máy và không ghi đè file có sẵn. Client chung nằm ở `src/lib/supabase.ts`. [Hướng dẫn cho Dev A/B và quyền Dashboard](docs/supabase-team-setup.md).

Mở `http://localhost:5173`. Auth dùng SĐT quốc tế và mật khẩu Supabase Auth của tài khoản thật. Sáu hồ sơ seed không có mật khẩu, nên không thể đăng nhập bằng chúng. Route Buyer: `/buyer`, `/buyer/profile`, `/buyer/requests`, `/buyer/lots`; lời mời/chat/vận chuyển/đánh giá là demo có nhãn. Admin dùng Auth role `ADMIN`, nội dung quản lý là fixture; Farmer/Carrier dùng `/role-home` chờ Dev A gắn giao diện.

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

Không commit mật khẩu, service-role key, database URL hoặc thông tin đăng nhập. Không chạy lại các migration đã áp dụng bằng SQL Editor trên project dùng chung. Kiểm thử HTTP đăng nhập/CRUD/ảnh với tài khoản thật và benchmark chất lượng E5 còn cần thực hiện khi có tài khoản test và host inference.
