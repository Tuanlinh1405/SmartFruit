# Bộ dữ liệu trình diễn cho khách — nhóm tài khoản số 3

Toàn bộ tên, hàng hóa và biển số dưới đây là dữ liệu hư cấu cho phiên trình diễn. Giao diện không thêm tiền tố TEST. Không coi dữ liệu này là giao dịch hoặc lịch xe có thật.

| Tài khoản | Vai trò | Tên hiển thị |
| --- | --- | --- |
| farmer3@logstar.test | Nhà vườn | Nguyễn Hữu Phước — Nhà vườn Phước An, Đồng Nai |
| buyer3@logstar.test | Thu mua | Trần Minh An — Thu mua An Phú, Hồ Chí Minh |
| carrier3@logstar.test | Nhà xe | Lê Quốc Thành — Vận tải Tân Phát, Đồng Nai |

Đã tạo ba tài khoản, xác nhận email và điền dữ liệu trên Supabase ngày 20/10/2026. Mật khẩu và ID đăng nhập lưu riêng ở `tmp/handover-accounts.json`, không commit. Báo cáo: `tmp/handover-data-result.json`. Đã kiểm tra đăng nhập, dữ liệu hiển thị và F5 trên website cho cả ba tài khoản; Farmer có một lượt tải đầu không đạt thời gian chờ, lần kiểm tra riêng tiếp theo qua và không có lỗi JavaScript.

## Dữ liệu đã tạo

| Nông sản | Lô bán / lượng mua | Giá chào | Khoảng giá Buyer | Xe phù hợp |
| --- | --- | --- | --- | --- |
| Sầu riêng Ri6 loại A | 5 tấn | 65.000 đ/kg | 62.000–72.000 đ/kg | Xe lạnh 5 tấn |
| Mít Thái loại A | 8 tấn | 15.000 đ/kg | 14.000–18.000 đ/kg | Xe thùng kín 8 tấn |
| Thanh long ruột đỏ loại A | 3 tấn | 22.000 đ/kg | 20.000–26.000 đ/kg | Xe mui bạt 3,5 tấn |

Lô công bố ở Long Khánh, Đồng Nai. Buyer có ba nhu cầu OPEN, ưu tiên Đồng Nai, lịch mua trùng lịch thu hoạch: Ri6 từ 21/10, mít từ 23/10, thanh long từ 25/10; kết thúc 20/11/2026. Tên loại hàng/giống và lượng mua khớp từng cặp; không sửa trọng số, cosine hoặc thuật toán xếp hạng. Cả ba cặp đạt 100 điểm theo quy tắc giá/lượng. Các vector mới đã được worker E5 lập chỉ mục.

| Cặp hàng | Buyer tìm Farmer | Farmer tìm Buyer |
| --- | --- | --- |
| Sầu riêng Ri6 loại A | Hạng 3 · 94,46 điểm | Hạng 2 · 94,44 điểm |
| Mít Thái loại A | Hạng 1 · 93,79 điểm | Hạng 1 · 93,75 điểm |
| Thanh long ruột đỏ loại A | Hạng 1 · 95,41 điểm | Hạng 1 · 95,05 điểm |

Kết quả trên được đo bằng API thật, tất cả ở chế độ hybrid; thứ hạng có thể đổi khi có thêm dữ liệu. Đã mở màn matching trên website deploy bằng Farmer3 và Buyer3 và xác nhận thấy dữ liệu/đối tác của cặp Ri6. Bằng chứng: `tmp/handover-matching-browser-result.json`; ảnh ở `tmp/handover-screenshots/`. Không trình bày điểm quy tắc 100 như điểm E5 thực tế hoặc cam kết Ri6 luôn đứng đầu.

Nhà xe có ba xe đang hoạt động với vùng phục vụ Đồng Nai–Hồ Chí Minh–Tây Ninh. Kịch bản tuyến tham khảo: Long Khánh → kho Thủ Đức cho Ri6; Long Khánh → điểm tập kết Hồ Chí Minh cho mít; Long Khánh → kho phân phối Thủ Đức cho thanh long.

**Ứng dụng hiện chưa có bảng chuyến xe hoặc booking/matching ba bên.** Không tạo trạng thái xe đang chạy hoặc sửa schema để giả lập tính năng đó. Chỉ Buyer–Farmer được kiểm tra matching trong ứng dụng; Carrier được chuẩn bị đội xe đủ tải và cùng khu vực phục vụ.

## Chuẩn bị và chạy

Xem trước, không ghi cloud:

```powershell
node scripts/seed-handover-data.mjs
```

Nếu cần tạo lại ở môi trường được chỉ định, người quản lý project đặt backend key trong `.env.local` hoặc `.env.admin.local` (đều được Git bỏ qua):

```dotenv
SUPABASE_URL=https://yyslykqpamnlqkvutrlm.supabase.co
SUPABASE_SECRET_KEY=<Supabase backend secret hoặc service-role key>
```

Đây là key quản lý Supabase, không phải OpenRouter hoặc publishable key. Không dán key vào chat hoặc frontend. File `tmp/handover-accounts.json` chứa ba mục `{name,email,password}` đã được người bàn giao chuẩn bị. Sau đó:

```powershell
node scripts/seed-handover-data.mjs --apply --create-accounts --check-matching
```

Nếu ba tài khoản đã tạo và xác nhận email từ Dashboard, chỉ cần:

```powershell
node scripts/seed-handover-data.mjs --apply --check-matching
```

Script chỉ tạo ba tài khoản được chỉ định, không đổi mật khẩu hay vai trò của user hiện có; seed dữ liệu qua phiên người dùng và RLS. ID nằm trong manifest riêng để không tạo lặp. Khi chạy lại, không mở lại lô/nhu cầu đã đóng, không khôi phục xe bị tắt và không xóa dữ liệu đang có. Không tự gửi lời mời hoặc tạo thỏa thuận để khách vẫn thực hiện được quy trình từ đầu.

## Kiểm tra bàn giao

1. Farmer3: tên vườn tự nhiên, ba lô công bố, lịch còn hạn; chọn từng lô để tìm Buyer3.
2. Buyer3: ba nhu cầu đang mở; chọn từng nhu cầu để tìm lô Farmer3. Kiểm tra giá và lượng trước khi gửi lời mời.
3. Carrier3: ba xe đủ tải, vùng phục vụ phù hợp; không trình diễn booking/tracking như chức năng đã tích hợp.
4. Kiểm tra API search thật ở báo cáo: target có xuất hiện, vị trí bao nhiêu và đang ở chế độ hybrid hay degraded. Nếu worker E5 chưa xử lý dữ liệu mới, báo riêng trạng thái đó; không bịa cosine hoặc ép thứ hạng.
