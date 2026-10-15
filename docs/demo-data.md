# Dữ liệu demo LogStar

Đã seed ngày 15/10/2026 vào project `yyslykqpamnlqkvutrlm`. Tất cả tên, địa chỉ và biển xe đều là dữ liệu giả; nhãn `[DEMO]` giúp phân biệt với dữ liệu người dùng.

| Dữ liệu | Số bản ghi |
| --- | ---: |
| Hồ sơ chung / marketplace | 6 / 6 |
| Nhà vườn / Buyer / Carrier | 3 / 2 / 1 |
| Lô hàng | 6: 4 PUBLISHED, 1 DRAFT, 1 CLOSED |
| Giá sàn và ghi chú riêng | 6 |
| Nhu cầu thu mua | 5: 4 OPEN, 1 DRAFT |
| Xe | 3: 2 xe lạnh, 1 xe mui bạt |

Catalog giữ nguyên 3 loại trái cây và 5 giống. Chưa seed ảnh vì chưa có file ảnh mẫu trong Storage.

## Kịch bản cho Dev A/B

- Buyer Vạn Đạt: Ri6 50 tấn khớp lô Ri6 15 tấn; mít Thái 12 tấn khớp lô mít 8 tấn.
- Buyer An Bình: thanh long ruột đỏ 20 tấn khớp lô 10 tấn; nhu cầu Ri6 giữa tháng 11 không có lô phù hợp.
- Có lô và nhu cầu nháp để kiểm tra quyền sở hữu, cùng lô đã đóng để kiểm tra bộ lọc trạng thái.
- Mốc thu hoạch và thu mua cố định trong tháng 10–11/2026. Nếu UI lọc theo ngày hiện tại, cần chọn khoảng ngày này.
- Đây là đầu vào để phát triển matching; chức năng chấm điểm matching trong TypeScript chưa được tạo bởi seed.

## Hồ sơ demo không có thông tin đăng nhập

6 dòng `auth.users` chỉ là placeholder để bảo đảm khóa ngoại và trigger tạo profile, không có mật khẩu hoặc Auth identity. Email dùng miền `.invalid`, không gửi thư hay lời mời. Không dùng các dòng này để thử đăng nhập; tạo tài khoản ứng dụng riêng theo [hướng dẫn setup](supabase-team-setup.md#4-dashboard-và-tài-khoản-ứng-dụng).

| UUID cuối (tiền tố `71000000-0000-4000-8000-`) | Vai trò / chủ thể |
| --- | --- |
| `000000000001` | FARMER — Nhà vườn Minh Út |
| `000000000002` | FARMER — Hợp tác xã An Phú |
| `000000000003` | FARMER — Vườn Thanh Long Bình An |
| `000000000004` | BUYER — Nông sản Vạn Đạt |
| `000000000005` | BUYER — Thu mua An Bình |
| `000000000006` | CARRIER — Vận tải Minh Phát |

Dashboard xem được dữ liệu với quyền team hiện có. Ứng dụng vẫn phải đăng nhập và tuân thủ RLS: Buyer đọc lô PUBLISHED, chỉ đọc nhu cầu của mình; Farmer chỉ quản lý lô của mình; Carrier chỉ đọc xe của mình. Giá sàn không công khai cho Buyer.

## Chạy lại và xác minh

Seed riêng: [`supabase/seeds/demo.sql`](../supabase/seeds/demo.sql). Chạy toàn bộ file trong SQL Editor sau khi schema và catalog đã có. Script dùng transaction và ID cố định, chỉ chèn bản ghi thiếu, không ghi đè dữ liệu đã chỉnh sửa. Không chạy lại initial migration hoặc reset project dùng chung. Script không tự khôi phục dữ liệu con nếu chủ động xóa hồ sơ hệ thống.

Xác minh bằng [`supabase/seeds/verify-demo.sql`](../supabase/seeds/verify-demo.sql): bảng đếm theo ID demo và 4 nhu cầu OPEN có số lô phù hợp lần lượt `1, 1, 1, 0`. Truy vấn này kiểm tra giống, ngày, giá, lượng tối thiểu; chưa phải thuật toán matching đầy đủ.

Đã qua 95 kiểm tra PostgreSQL local, gồm chạy seed lại sau khi chỉnh giá và kiểm tra RLS bằng role Farmer/Buyer/Carrier. Auth/Storage HTTP không được giả lập bởi bộ kiểm tra này.

Đã xác minh trực tiếp trong SQL Editor trên cloud: đủ 9 nhóm dữ liệu theo bảng đếm, và 4 nhu cầu OPEN trả số ứng viên `1, 1, 1, 0`. [Ảnh kết quả cloud](assets/supabase-demo-data.jpg).

Supabase có hướng dẫn [placeholder Auth users cho seed](https://supabase.com/docs/guides/local-development/cli-workflows).
