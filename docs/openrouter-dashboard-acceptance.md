# Biên bản tích hợp OpenRouter và Tổng quan Farmer — 19/10/2026

## Kết quả và phạm vi

Đã triển khai mã chuyển trợ lý sang OpenRouter Free, thời tiết Open-Meteo và bản đồ Leaflet/OpenStreetMap trong Tổng quan Farmer. Không migration hoặc sửa RLS; không đổi matching, booking, GPS, Carrier. Giữ dữ liệu/vận chuyển demo ngoài luồng mới với nhãn riêng. Không commit/push hoặc deploy thay người dùng trong đợt này khi chưa có quyền/URL quản lý.

## Kiểm tra local/mock

| Kiểm tra | Kết quả |
| --- | --- |
| Unit toàn dự án | 364/364 qua |
| E2E toàn dự án | 166/166 qua, 1 worker |
| Kiểm tra lại feature sau chỉnh chẩn đoán/cache | 58/58 unit, 13/13 E2E qua |
| Kiểm tra route/lazy-load cuối | 75/75 unit và 13/13 E2E qua |
| TypeScript/frontend build | Qua sau các test với cấu hình thật; main bundle 357 kB, bản đồ lazy-load riêng |
| Gói Supabase Dashboard | `tmp/farmer-chat-deploy/index.ts` đã build, gộp source/knowledge; key đọc từ Deno.env |
| Ranh giới secret | Đã quét build frontend và bundle function, không có giá trị OPENROUTER_API_KEY |
| Desktop/mobile | E2E Tổng quan ở 1440/390/320; kiểm tra shell chung và chatbot 320–1440 |

E2E dùng API thời tiết/geocoding và tiles mock; không quét máy chủ tiles thật. Đã sửa lỗi vòng đời Leaflet khi lọc/đổi danh sách (giữ instance map, tách layer và dừng animation khi cleanup). Test trợ lý không còn đòi nút reset demo trên Tổng quan đã tách riêng.

## Bằng chứng nhà cung cấp thật

- OpenRouter trực tiếp: 6/6 câu mẫu ba cây × hai chủ đề trả JSON hợp lệ, nguồn thuộc tài liệu gửi, khoảng 3–15 giây, không có reasoning tokens. Model thực tế do Free Router chọn gồm Nemotron, Xing4 và Dots miễn phí. Lượt thử đầu trước khi tắt reasoning đã timeout ở 25 giây; không tự retry. Tổng đợt kiểm tra có bảy lượt inference, không chạy toàn bộ corpus 30 câu.
- Kiểm tra schema/source không chứng minh tính đúng đắn chuyên môn. Một số mẫu có lỗi diễn đạt; đây là trợ lý demo tham khảo, không chẩn đoán/đề xuất thuốc hoặc chứng nhận xuất khẩu. `humanReview` của corpus vẫn pending.
- Open-Meteo: gặp 503 “service is overloaded” ở lượt đầu. Lượt kiểm tra riêng tiếp theo bằng mã ứng dụng xác định đúng ADM1 Đồng Nai và nhận đủ dự báo ba ngày, timezone Việt Nam. Không coi Free API có SLA.
- Supabase thật: đăng nhập Farmer test và đọc được 11 nhu cầu OPEN còn hạn qua RLS. Không ghi/sửa dữ liệu cloud.
- Không thực hiện test headless tải tiles OSM thật; nền bản đồ được đối chiếu bằng cấu hình/attribution và kiểm tra render với tiles mock.

Các bằng chứng này là provider/API smoke từ máy local, **chưa phải nghiệm thu frontend đã deploy gọi Supabase function mới với JWT/CORS thật**.

## Triển khai còn lại

### Chẩn đoán website ngày 20/10/2026

- Website vẫn trả HTTP 200. Đăng nhập Farmer test thành công.
- Gửi OPTIONS và POST với origin `https://tuanlinh1405.github.io`: function trả HTTP 403, POST có mã `FORBIDDEN_ORIGIN`, không có `Access-Control-Allow-Origin`. Origin localhost cũng bị từ chối.
- Cùng tài khoản và câu hỏi, gọi từ server không gửi Origin: HTTP 200 sau khoảng 7,9 giây, có câu trả lời và năm nguồn. Điều này xác nhận backend đang trả lời được; không xác nhận provider/model nào đang chạy vì hợp đồng phản hồi không công khai thông tin này.
- Cần sửa Supabase secret `FARMER_CHAT_ALLOWED_ORIGINS` thành `https://tuanlinh1405.github.io,http://localhost:5173,http://127.0.0.1:5173` (giá trị trên Dashboard không thêm dấu nháy, không có `/SmartFruit/`, không có dấu `/` cuối origin). Sau khi cập nhật, kiểm tra lại OPTIONS từ domain deploy rồi gửi một câu hỏi trong trình duyệt. Không cần đổi key chỉ để khắc phục lỗi CORS đã xác định.
- Bằng chứng: `tmp/deployed-assistant-diagnosis.json`, `tmp/deployed-assistant-provider-diagnosis.json`. Chưa thay secrets hoặc deploy trong lần chẩn đoán này.

Key đã có trong `.env.local`; file này không tự lên Supabase. Website được cung cấp: https://tuanlinh1405.github.io/SmartFruit/. Đã kiểm tra HTTP 200 ở trang gốc và `/SmartFruit/login`, script asset dùng tiền tố `/SmartFruit/`; kiểm tra này chưa xác nhận chức năng ứng dụng. Phiên hiện tại chưa có Supabase CLI/management token.

Đã tạo `tmp/farmer-chat-openrouter.env` (Git bỏ qua) từ key local, chứa model miễn phí và origin `https://tuanlinh1405.github.io` cùng localhost. Origin CORS không bao gồm đường dẫn `/SmartFruit/`. Không in giá trị key.

Người có quyền quản lý project cần:

1. Đăng nhập Supabase CLI bằng tài khoản có quyền project, rồi áp secrets đã chuẩn bị và deploy function:

   ```powershell
   npx supabase login
   node scripts/prepare-farmer-chat-env.mjs --origin=https://tuanlinh1405.github.io
   npx supabase secrets set --env-file tmp/farmer-chat-openrouter.env --project-ref yyslykqpamnlqkvutrlm
   npx supabase functions deploy farmer-chat --project-ref yyslykqpamnlqkvutrlm
   ```

2. Hoặc dùng Dashboard: cấu hình `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=openrouter/free`, `FARMER_CHAT_ALLOWED_ORIGINS=https://tuanlinh1405.github.io,http://localhost:5173,http://127.0.0.1:5173`; thay `index.ts` của function `farmer-chat` bằng gói đã build rồi Deploy updates.
3. Deploy frontend từ source mới, xác minh refresh route, role guards, weather, vùng thu mua và một câu hỏi trợ lý. Không chỉ thay secret của function Gemini cũ rồi coi là đã chuyển provider.

Rollback function bằng source commit trước và secrets Gemini trước đây; không mở paid fallback. Quy trình không chạy SQL hoặc reset database. Hướng dẫn: [trợ lý](farmer-chatbot.md), [Tổng quan và checklist](farmer-dashboard-live.md).

## Log và artifact local

- `tmp/openrouter-unit-final.log`, `tmp/openrouter-system-final.log`.
- `tmp/openrouter-feature-final.log`, `tmp/openrouter-system-final-focused.log`.
- `tmp/openrouter-route-unit.log`, `tmp/openrouter-route-system.log`.
- `tmp/openrouter-build-final.log`, `tmp/openrouter-function-build.log`, `tmp/openrouter-secret-boundaries.log`.
- `tmp/farmer-chat-evaluation/results.json`, `tmp/openrouter-live-evaluation.log`, `tmp/openrouter-first-timeout.json`.
- `tmp/dashboard-cloud-check/results.json`, `tmp/dashboard-cloud-check.log`.

Không đưa key, `.env.local`, file secrets tạo ra hoặc transcript người dùng vào Git. Các file `docs/tong-hop-cong-nghe-thuat-toan.md` và thư mục `output/` đã có trước lượt này và được giữ nguyên.
