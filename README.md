# SmartFruit

LogStar MVP: React/TypeScript/Vite + Supabase. Dev B đã triển khai Auth, Buyer, kết nối Buyer/Farmer, chat, thương lượng/thỏa thuận, đánh giá và Admin bằng dữ liệu thật. Matching mặc định theo quy tắc; vector/graph có schema và mã, còn chờ host inference/worker. [Trạng thái tính năng và các phần hoãn](docs/implementation-status.md).

Cập nhật 22/10/2026: đã có mã dashboard gọn, chính sách, thông báo và tìm xe/báo giá tối thiểu; cần áp migration mới trước khi đưa các luồng mới lên cloud. Đánh giá mẫu cho farmer3/buyer3 đã được tạo trên cloud và kiểm tra không trùng. Xem [kết quả triển khai và bước cloud còn lại](docs/customer-feedback-acceptance-2026-10-22.md).

Khởi tạo máy developer với Node.js >=22:

```powershell
npm ci
npm run setup:supabase
npm run check:supabase
npm run build
npm test
npm run dev
```

Mở `http://localhost:5173`. URL/publishable key có sẵn trong `.env.example`; setup tạo `.env.local` riêng và giữ file có sẵn. Client chung: `src/lib/supabase.ts`. [Hướng dẫn Dev A/B và quyền Dashboard](docs/supabase-team-setup.md).

Đăng nhập email hoặc SĐT quốc tế + mật khẩu Supabase Auth; không cần OTP/SMS. Đã tạo 7 tài khoản test cho BUYER/FARMER/CARRIER/ADMIN. Email và cách lấy mật khẩu nằm trong [ghi chú kiểm thử](docs/implementation-status.md#tài-khoản-kiểm-thử). Mật khẩu được trao riêng, không có trong Git. Các hồ sơ `[DEMO]` cũ chỉ là dữ liệu mẫu, không có mật khẩu.

Route chính: `/buyer`, `/farmer`, `/carrier`, `/admin`; quyền dựa trên Auth và database. Farmer/Carrier có workspace đọc dữ liệu thật, hồ sơ và luồng giao dịch phục vụ test; đăng/sửa lô, upload ảnh và CRUD xe nâng cao theo phân công Dev A. Vận chuyển, tracking, thanh toán và chính sách chưa sẵn sàng được ghi rõ trên giao diện.

Supabase LogStar `yyslykqpamnlqkvutrlm` đã có initial schema, catalog, bucket ảnh private; migration hybrid và migration giao dịch đã áp ngày 15/10/2026. Năm bảng giao dịch có RLS, các RPC kiểm tra participant/role/trạng thái; Admin dùng API giới hạn, không đọc chat riêng hoặc giá sàn. Không chạy lại migration đã áp lên project dùng chung. Gói `supabase/deploy.sql` chỉ dành cho baseline ban đầu; chưa gồm migration hybrid/giao dịch.

Kiểm thử database bằng PostgreSQL cục bộ:

```powershell
cd supabase/tests
npm ci --ignore-scripts
npm test
npm run test:vector
```

`npm test` chạy 95 kiểm tra baseline và 23 kiểm tra giao dịch. `npm run test:vector` kiểm tra truy hồi cosine top 20/RLS bằng PostgreSQL + pgvector cục bộ, dùng vector giả lập nhỏ và không chạy model. Smoke test hybrid ban đầu trên cloud nằm ở [smoke test rollback](supabase/tests/hybrid-cloud-smoke.sql).

Seed tài khoản và kiểm thử HTTP cloud là thao tác ghi dữ liệu test trên LogStar. Seed cần backend key; kiểm thử HTTP chỉ dùng publishable key và thông tin các tài khoản test:

```powershell
# .env.admin.local: SUPABASE_URL và SUPABASE_SECRET_KEY, không dùng VITE_ cho secret
npm run seed:test
npm run test:live
```

Seed không reset mật khẩu account có sẵn. Script HTTP dùng JWT của từng role để kiểm tra ownership, chat/thỏa thuận/đánh giá, ảnh private và Admin; để lại dữ liệu `[TEST HTTP]`, chỉ đóng lô của lượt test và khôi phục trạng thái khóa sau test. Giữ `tmp/test-accounts.json` và `.md` riêng; không gửi backend key cho frontend.

- [Kế hoạch Developer B](docs/dev-b-plan.md)
- [Tích hợp khung UI Dev A (PR #2) với tính năng thật](docs/ui-integration.md)
- [UI kit, quy ước và inventory màn hình](docs/ui.md)
- [Kế hoạch UI, backend và thuật toán](docs/code-implementation-plan.md)
- [Kế hoạch matching vector + graph](docs/vector-graph-matching-plan.md)
- [Matching hiện hành: E5 → vector top 20 → so từ rerank](docs/matching-e5-top20.md)
- [Database schema, ERD và contract](docs/database-schema.md)
- [Biên bản triển khai Supabase](docs/database-deployment.md)
- [Migration giao dịch](supabase/migrations/202610150002_trading.sql)
- [Worker embedding và cách bật hybrid](services/embedding/README.md)

`VITE_MATCHING_MODE=rule-only` là mặc định; đã có so từ chính xác/gần đúng. Đã code E5-base → cosine top 20 → rerank, nhưng migration mới `202610150003_vector_top20.sql` chưa áp cloud; inference/worker và Edge Function chưa deploy. Đã có [phép thử E5 local với tên giống](docs/benchmarks/e5-varieties-2026-10-15/README.md), chưa phải benchmark đại diện để bật hybrid cho người dùng. Không commit mật khẩu, secret/service-role key hoặc database URL có thông tin đăng nhập.
