# Biên bản triển khai database LogStar

## Bản sửa xóa lô ngày 18/10/2026

- Migration tăng dần: `supabase/migrations/202610180001_lot_deletion_repair.sql`. Chạy sau migration trading, trong SQL Editor của project hiện tại; không chạy lại `deploy.sql` trên database đang có dữ liệu.
- Migration khôi phục RPC thay ảnh/xóa lô, trigger chặn xóa còn file và thêm `prepare_lot_deletion(uuid)`. Toàn bộ cài đặt nằm trong một transaction, có thể chạy lại và gửi thông báo tải lại schema PostgREST.
- Chuẩn bị xóa khóa lô, kiểm tra chủ sở hữu/role và mọi lịch sử kết nối; chỉ lô không có lịch sử mới được đóng để dọn ảnh. Lô có lịch sử giữ nguyên và báo người dùng đóng lô.
- Áp migration database trước khi phát hành frontend. Frontend mới sẽ chặn trước khi dọn ảnh nếu RPC chưa được cài.
- Xác minh: chạy `supabase/verify-deployment.sql`, ba RPC lifecycle phải khác NULL; sau đó `node scripts/test-live-lot-deletion.mjs`. Script dùng Farmer trong `tmp/test-accounts.json`, chỉ tạo/xóa lô nghiệm thu mới; nếu lỗi giữa chừng, giữ lô test và in ID để điều tra.
- Kiểm tra local: `npm run typecheck`, `npm run test:database`, `npx vitest run src/features/farmer/lots --pool=threads --maxWorkers=2`, `npx playwright test tests/system/a-connected.spec.ts --project=production`.
- Người dùng đã chạy migration trong SQL Editor. Ngày 18/10/2026, nghiệm thu HTTP trên Supabase thật đạt: ba RPC lifecycle đã được expose, chuẩn bị xóa chuyển lô sang CLOSED, chặn xóa khi còn ảnh liên kết hoặc file mồ côi, dọn Storage rồi xóa lô thành công.
- Lô nghiệm thu mới `3c36e17e-7dd1-48df-a93a-ac64b060d804` và hai file test đã được xóa trong luồng nghiệm thu; không thao tác xóa lô có sẵn. Kiểm tra HTTP trước triển khai từng trả `PGRST202`; sau migration lỗi thiếu RPC đã được giải quyết. Kiểm tra chạy đua giữa hai phiên upload/xóa chưa được nghiệm thu trên cloud.

Ngày: 14/10/2026 (Asia/Bangkok).

Cập nhật 15/10/2026: đã áp thêm migration hybrid và `202610150002_trading.sql` trên cùng project. Năm bảng giao dịch đều bật RLS, đã kiểm tra HTTP bằng 7 tài khoản đủ role; xem [biên bản tính năng và kiểm thử hiện hành](implementation-status.md#triển-khai-và-kiểm-thử). Phần bên dưới ghi lại triển khai baseline ngày 14/10.

## Project và phạm vi

- Project: **LogStar**, ref `yyslykqpamnlqkvutrlm`.
- [Supabase Table Editor](https://supabase.com/dashboard/project/yyslykqpamnlqkvutrlm/editor).
- Database: `postgres`, PostgreSQL **17.11**.
- Trước khi chạy: không có bảng ứng dụng trong public/logstar_private, không có type trùng tên, policy Storage, bucket lot-images, trigger Auth tùy chỉnh hoặc account Auth.
- Migration: `supabase/migrations/202610140001_initial_schema.sql` và catalog `supabase/seed.sql`, ghép thành một transaction trong `supabase/deploy.sql`.
- SHA-256 gói deploy đã dùng: `B2F1EE1F535BA440C104061789890CD8282351278D32B4B05599E8FD18D7AEB8`.
- Cách áp dụng: Supabase SQL Editor, thực thi thành công. Editor cũng được yêu cầu bật RLS cho các bảng mới; migration vốn đã bật RLS cho toàn bộ bảng.

## Kết quả xác minh trực tiếp

| Hạng mục | Kết quả |
| --- | --- |
| Bảng ứng dụng | 12 |
| Bảng đã bật RLS | 12/12 |
| Catalog | 3 loại quả, 5 giống; tên tiếng Việt đúng |
| Bucket ảnh | `lot-images`, private |
| Giới hạn ảnh | 5,242,880 bytes; JPEG, PNG, WebP |
| Trigger Auth | `logstar_auth_user_created` tồn tại |
| Grants bảng cho anon/PUBLIC | 0 |
| SECURITY DEFINER thiếu search_path an toàn | 0 |
| Account Auth sau kiểm tra | 0 |
| Lô test còn sót | 0 |
| Data API | public và graphql_public; logstar_private không được expose |

12 bảng: `profiles`, `farmer_profiles`, `buyer_profiles`, `carrier_profiles`, `marketplace_profiles`, `fruit_types`, `fruit_varieties`, `lots`, `lot_private_details`, `buy_requests`, `vehicles`, `lot_images`.

Catalog: sầu riêng (Ri6, Monthong), mít (Mít Thái), thanh long (ruột đỏ, ruột trắng). Đây là danh mục khởi tạo có thể thay đổi bằng migration/seed tiếp theo.

## Kiểm thử

- 90 kiểm tra cục bộ đạt với PostgreSQL/PGlite, bao gồm gói deploy và script xác minh cloud.
- `supabase/tests/cloud-smoke.sql` được chạy trực tiếp trên database Supabase. Kết quả: **PASS: 16 security checks; all temporary fixtures rolled back**.
- Những ca cloud gồm metadata không thể nâng role, giới hạn profile theo chủ sở hữu, Buyer chỉ thấy PUBLISHED, không thấy giá sàn/hồ sơ Farmer riêng, đọc được marketplace identity tối thiểu, chặn sửa role/owner, chặn khối lượng âm, Buyer khác không đọc/sửa nhu cầu, Farmer thấy lô mình và nhu cầu OPEN, kiểm tra thư mục upload và giá sàn.
- Script dùng subtransaction rollback để loại bỏ toàn bộ fixtures và Auth claims; đã truy vấn lại để xác nhận không còn account/lô test.

## Giới hạn xác minh và cách tiếp tục

Chưa tạo account demo có mật khẩu, chưa có React app hoặc `.env` client. Các bài test cloud dùng role PostgreSQL và JWT claims giả lập để kiểm tra database, không phải đăng nhập HTTP thực.

Dev B tiếp tục Auth/session và nhu cầu Buyer; Dev A dùng chung schema cho Farmer/Carrier. Thực hiện login, upload/signed URL qua SDK và test luồng người dùng khi có client. Xem [schema và API contract](database-schema.md) trước khi viết payload để dùng đúng cột, đơn vị và quyền.

Migration được áp qua SQL Editor nên chưa ghi vào migration history của Supabase CLI. Trước khi dùng CLI `db push` ở project này, reconcile initial migration đã áp dụng; không chạy lại gói deploy. Không cần tạo lại các bảng hiện có.

![Database thực tế trên Supabase](assets/supabase-database.jpg)
