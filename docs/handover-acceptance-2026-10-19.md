# Nghiệm thu trước bàn giao — 19/10/2026

Phạm vi: ứng dụng local dùng Supabase LogStar thật, bốn tài khoản test riêng Farmer/Buyer/Carrier/Admin; kiểm thử tự động với API mock và PostgreSQL local được ghi tách biệt. Không nghiệm thu thanh toán, đặt xe thật, GPS/IoT hoặc SMS OTP vì các phần này ngoài phạm vi đã triển khai.

## Kết luận

Đạt phạm vi chức năng đã triển khai trên frontend local + Supabase cloud. Toàn bộ 165 Playwright và 349 unit test đã qua sau sửa. Hai chiều giao dịch và bốn vai trò đã được kiểm tra thật. Không phát hiện lỗi chặn bàn giao trong các luồng đã kiểm; kết luận này không bao gồm các tích hợp đang hoãn hoặc URL production chưa triển khai.

Người dùng đã xác nhận thủ công: nhận email xác nhận, xác nhận email và vào đúng vai trò trên cloud. Đây là bằng chứng do người dùng cung cấp, không ghi thành ca tự động hoặc khẳng định đã nghiệm thu gửi mail riêng cho cả ba vai trò.

## Kiểm tra tự động

| Bộ kiểm tra | Kết quả |
| --- | --- |
| Vitest toàn bộ frontend | 349/349 qua |
| PostgreSQL baseline/deploy | 96 qua |
| PostgreSQL toàn bộ migration | 99 qua; có phần trùng baseline, không cộng thành ca độc lập |
| Giao dịch và xóa lô PostgreSQL | 27 qua |
| Đăng ký và quyền cấp role PostgreSQL | 11 qua |
| pgvector top 20/RLS | 9 nhóm qua |
| Embedding maintenance / hosted worker | 3 / 8 qua |
| Python HTTP/embedding contract | 13 qua; dùng encoder giả cho service test, không tải model |
| Script khôi phục mật khẩu | 7 qua |
| Playwright toàn bộ | 165/165 qua, một worker, 5,2 phút |
| TypeScript / production build | Qua; chạy lại sau Playwright với cấu hình .env.local thật, không để bản dist dùng API mock |

Lượt Playwright đầu: 163 qua, 2 lỗi. Một lỗi CSS thật: selector legacy ghi đè shared control ở modal báo giá Carrier; đã loại `.control` khỏi selector legacy. Một timeout lúc tải dev harness Carrier; kiểm tra lại với một worker đã qua. Toàn bộ 46 ca thuộc hai file bị ảnh hưởng đã qua sau sửa; lượt toàn bộ cuối ghi ở bảng trên.

Một unit test phát hiện AUTH-03 tham chiếu đường dẫn đăng ký cũ không còn là page chính. Đã chuyển tham chiếu inventory sang `/register`; giữ alias `/auth/register` và không bổ sung SMS OTP.

## Nghiệm thu Supabase thật

| Luồng | Bằng chứng |
| --- | --- |
| Đăng nhập bốn vai trò | Bốn browser context độc lập, xác nhận role từ database |
| Giao dịch hai chiều | Farmer và Buyer lần lượt khởi tạo: đồng ý → chat hai chiều → rút/từ chối/chấp nhận đề nghị → hai bên hoàn tất → hai đánh giá; F5 giữ đúng connectionId, server chặn tự chấp nhận/đánh giá sớm/trùng |
| Hồ sơ Farmer/Buyer/Carrier | Đọc, lưu lại giá trị hiện tại, đọc lại từ server |
| Lô và nhu cầu | Tạo dữ liệu TEST riêng, sửa và đọc lại; giá sàn và ghi chú riêng bị ẩn với Buyer |
| Storage ảnh private | Upload ảnh, tạo signed URL từ Buyer khi lô công bố, tải về so sánh nguyên byte |
| Hủy/từ chối lời mời | Server chặn chat sau CANCELLED/DECLINED |
| Xóa lô | RPC đã cài; ảnh liên kết/ảnh mồ côi chặn xóa; dọn Storage rồi xóa lô tự tạo thành công |
| Admin khóa tài khoản | Chặn ghi nghiệp vụ và tự mở khóa; khôi phục Carrier trong finally |
| Buyer E5 matching | Edge Function trả `hybrid`, `multilingual-e5-base-v1`, `vector_top20`, 3 kết quả; Carrier không được dùng nguồn Buyer |
| Farmer matching | Scorer hiện dùng rule-only; không diễn giải kiểm tra E5 Buyer thành bằng chứng E5 trên màn hình Farmer |
| Trợ lý Farmer | Backend thật trả lời kèm 4 nguồn; Buyer bị từ chối |
| Đăng ký | Tự động: email provider/signup bật, xác nhận email bắt buộc, RPC đã cài, role cũ không bị đổi. Thủ công: người dùng xác nhận đã xác nhận email và vào đúng vai trò |

Lượt cloud UI cuối: 17 nhóm qua, không có uncaught page error, logout chặn truy cập lại; API bổ sung: 10 nhóm qua. Hai thỏa thuận cuối đều hoàn tất và có hai đánh giá. Các kết quả này không cộng với số Playwright mock thành một bộ cloud duy nhất.

Các tin tạo cho giao dịch được đóng sau test, giữ lịch sử thỏa thuận/đánh giá. Lô dùng riêng cho ca xóa đã được xóa. Không xóa dữ liệu có sẵn hoặc lịch sử demo cũ.

Chỉ có bốn tài khoản cloud được cung cấp. Truy cập chéo giữa hai tài khoản cùng vai trò được kiểm bằng PostgreSQL local; không ghi nhận là đã chạy trên cloud trong lượt này. Script live cũ yêu cầu bảy tài khoản và ID có sẵn nên không dùng kết quả lỗi fixture đó làm lỗi sản phẩm.

## Tái hiện và bằng chứng local

```powershell
npm run test:unit -- --pool=threads --maxWorkers=2
npm run test:database
npm --prefix supabase/tests run test:vector
npm --prefix supabase/tests run test:embedding
npm run test:system -- --workers=1
node --test scripts/reset-auth-password.test.mjs
npm run build
```

Log local: `tmp/handover-unit.log`, `tmp/handover-database.log`, `tmp/handover-vector.log`, `tmp/handover-embedding.log`, `tmp/handover-python.log`, `tmp/handover-system-final.log`, `tmp/handover-deletion.log`, `tmp/handover-registration-cloud.log`. Cloud: `tmp/handover-cloud/results.json`, `tmp/handover-extra-results.json`, `tmp/handover-search-result.json`. Không đưa tài khoản, mật khẩu, token, signed URL hoặc file môi trường vào bàn giao công khai.

Cloud harness tạm: `tmp/handover-cloud.cjs` (UI bốn vai trò), `tmp/handover-extra.cjs` (API bổ sung), `tmp/handover-lot-deletion.mjs` (xóa lô). Các script chỉ dùng tài khoản test, cần server cloud-configured tại `http://127.0.0.1:4181`, không chạy song song với thao tác thủ công trên chính các tài khoản đó.

## Theo dõi khi triển khai

1. Luồng nhận/xác nhận email và vào đúng vai trò đã được người dùng xác nhận ngày 19/10. Không tắt xác nhận email để thay cho kiểm thử. Kiểm tra tự động bao phủ ba vai trò, F5 và phiên đăng nhập; không suy diễn rằng gửi mail cho ba hộp thư mới đã được tự động kiểm chứng.
2. Khi có URL deploy, kiểm tra lại redirect email, refresh route và đăng nhập trên URL đó. Lượt hiện tại nghiệm thu frontend local + backend cloud, chưa phải URL production đã triển khai.

Các trang vận chuyển/tracking, giá/thời tiết/bản đồ minh họa vẫn giữ đúng phạm vi demo; Carrier quản lý hồ sơ/xe là dữ liệu thật. Matching chưa cam kết xử lý vector tức thời cho tin vừa tạo; worker xử lý hàng đợi theo cơ chế hiện có. Phân trang server cho dữ liệu lớn và lịch sử chat trên 100 tin vẫn là giới hạn đã biết.
