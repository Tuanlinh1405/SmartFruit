# Forest Logistics trên onlmallfruit

Áp dụng cho khung dùng chung của FARMER, BUYER, CARRIER và ADMIN. App giữ Vite/React Router; quy tắc hiển thị được thích ứng từ bộ design system local.

- `src/styles/tokens.css`: palette forest, màu ngữ nghĩa, font Geist Sans/Mono, radius 8/6px và alias cho CSS cũ/Tailwind v4. Màu chữ phụ được tăng tương phản để dễ đọc trên nền sáng.
- `src/styles/forest.css`: sidebar phẳng 240px, topbar 56px, nội dung 16/24px, nav mobile 64px dưới 768px, safe-area và khoảng trống cuối trang. Bốn shortcut theo role và mục Thêm mở toàn bộ menu.
- `MetricCard`: metric từ dữ liệu thật, định dạng vi-VN và tabular-nums; dùng chung cho bốn role.
- `LoadingSteps`: trạng thái do caller cung cấp, không tự tiến bước theo timer hoặc dựng phần trăm giả. Dùng cho matching/trợ lý; tải dữ liệu thường dùng skeleton.
- Toast qua Sonner; nút đóng có nhãn và nội dung được thông báo cho screen reader. Component form, status badge, bảng, dialog dùng cùng palette/radius/focus ring.
- Backend, RLS và công thức matching giữ nguyên. Thời tiết/bản đồ gọi provider thật; giá thị trường và vận tải vẫn ghi rõ chưa tích hợp.

Sau khi gộp phản hồi khách hàng ngày 22/10, chuông đã có mã kết nối backend và tìm xe/báo giá đã có luồng tối thiểu; cả hai vẫn cần migration mới trước khi dùng trên cloud. Dashboard Farmer chỉ còn Tổng quan, giữ MetricCard và palette chung của Forest Logistics. Chi tiết tại customer-feedback-acceptance-2026-10-22.md. Việc đổi nhà cung cấp trợ lý trong nhánh Dev A cần deployment Supabase function riêng, không được thực hiện tự động bởi Vercel. Lần kiểm tra trước có timeout trợ lý thật; không coi unit test pass là xác nhận provider luôn khả dụng.
