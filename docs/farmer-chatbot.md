# Trợ lý nhà vườn — OpenRouter Free

Cập nhật 19/10/2026. Giữ giao diện và hợp đồng `farmer-chat`, thay Gemini bằng OpenRouter. Không migration, không tự chuyển sang dịch vụ tính phí.

## Luồng và nguồn dữ liệu

Nút Trợ lý trên Tổng quan Farmer mở khung chat 520px, toàn màn hình khi rộng không quá 850px. Phần chọn cây/chủ đề nằm phía trên, giai đoạn cây mở thêm khi cần; lịch sử cuộn riêng và ô nhập giữ ở đáy. Enter gửi câu hỏi, Shift + Enter xuống dòng. Giao diện chỉ hiển thị câu trả lời và câu hỏi bổ sung, không hiển thị danh sách nguồn hay đoạn mô tả cảnh báo. Chỉ Farmer hoạt động được dùng; backend xác thực JWT bằng `auth.getUser`, đọc role và trạng thái khóa của chính tài khoản. CORS chỉ cho phép origin cấu hình chính xác.

Nguồn khách hàng: [Tổng hợp bệnh và phân loại.xlsx](https://drive.google.com/file/d/1AsJqN1X3V-2xqyqWWGCfqyxTuURC47d3). `knowledge.json` chứa 27 mục về sầu riêng/mít/thanh long, hai chủ đề bệnh/phân loại, phiên bản `2026-10-17-v1`. Nội dung là bảng tổng hợp tham khảo, chưa xác minh độc lập toàn bộ tài liệu nông học gốc.

Mỗi câu hỏi độc lập, không gửi transcript, hồ sơ vườn, lô, thời tiết hoặc ghi chú riêng sang provider. Chỉ gửi tài liệu đúng cây/chủ đề và câu hỏi. Không nhận ảnh, không gọi công cụ, không tự lưu nghiệp vụ, không đưa thuốc/liều lượng hay chứng nhận xuất khẩu.

## Hợp đồng và bảo vệ chi phí

Đầu vào giữ `crop`, `topic`, `growthStage`, `question` (tối đa 1.500 ký tự); từ chối trường thừa. Đầu ra giữ `answer`, `sources`, `followUpQuestions`, `requestId`.

Function gọi `https://openrouter.ai/api/v1/chat/completions`, default `openrouter/free`, JSON schema strict, 1.024 token, timeout 25 giây, không streaming/retry. Gửi `reasoning.effort=none` để tránh model dùng hết ngân sách cho suy luận. Không tăng timeout hoặc token để che lỗi.

Model cấu hình riêng phải có hậu tố `:free`, có trong catalog và giá bằng 0; cache kiểm tra 15 phút. Request còn đặt `provider.max_price` đầu vào/đầu ra bằng 0 và `require_parameters=true`. Không tự chọn paid model hoặc fallback Gemini. Nếu không có endpoint miễn phí phù hợp, trả lỗi thật.

Backend chỉ chấp nhận một completion kết thúc `stop`, JSON đủ trường, nguồn thuộc tài liệu đã gửi và tối đa hai câu hỏi bổ sung. Tên/link nguồn được ánh xạ từ dữ liệu backend; không tin URL do model tạo. UI render plain text. Kiểm tra schema/nguồn không bảo đảm mọi câu trả lời đều chính xác chuyên môn; chất lượng tiếng Việt thay đổi theo model Free Router chọn.

Lỗi quota, thiếu cấu hình, model không free, key/account provider, timeout, JSON hỏng có mã riêng. Key OpenRouter bị từ chối không bị hiểu là user hết phiên. UI giữ câu hỏi để người dùng thử lại, không tạo câu trả lời mẫu. Log chỉ có provider/model thực tế, requestId, thời gian, usage và mã lỗi; không log JWT/key/prompt/answer.

## Cấu hình và deploy

Key ở `.env.local` không tự chuyển lên Supabase. Không đặt tên key bằng tiền tố `VITE_`.

Secrets server:

```dotenv
OPENROUTER_API_KEY=<nhập riêng trên máy hoặc Supabase Secrets>
OPENROUTER_MODEL=openrouter/free
FARMER_CHAT_ALLOWED_ORIGINS=https://website-da-deploy.example,http://localhost:5173,http://127.0.0.1:5173
```

Dùng origin thật, không thêm đường dẫn hoặc `*`. Với key đã ở `.env.local`, chuẩn bị file chỉ chứa ba secrets cần thiết:

```powershell
node scripts/prepare-farmer-chat-env.mjs --origin=https://website-da-deploy.example
npx supabase secrets set --env-file tmp/farmer-chat-openrouter.env --project-ref yyslykqpamnlqkvutrlm
npx supabase functions deploy farmer-chat --project-ref yyslykqpamnlqkvutrlm
```

Hai lệnh Supabase cần CLI đã đăng nhập tài khoản có quyền project. Không upload toàn bộ `.env.local`, không chạy migration/reset database. Sau đó deploy frontend bằng quy trình hiện có. Nếu gateway báo 401, phân biệt JWT gateway với JSON lỗi từ handler; không bỏ kiểm tra `auth.getUser`/role để làm cho request qua.

Nếu dùng Supabase Dashboard thay CLI: chạy `node scripts/build-farmer-chat.mjs`, mở function `farmer-chat`, thay nội dung `index.ts` bằng `tmp/farmer-chat-deploy/index.ts` rồi Deploy updates. Artifact đã gộp contract/service/knowledge, không cần copy các import ra ngoài thư mục function. Vẫn phải cấu hình ba secrets nêu trên; file bundle không chứa giá trị key. Không tạo một function tên khác vì frontend đang gọi `farmer-chat`.

Rollback: deploy lại mã `farmer-chat` ở commit trước khi chuyển provider và dùng lại secrets Gemini trước đó; không bật paid fallback để xử lý sự cố.

## Kiểm thử

```powershell
npx vitest run src/features/farmer/assistant --pool=threads --maxWorkers=2
npx playwright test tests/system/farmer-assistant.spec.ts --project=production --workers=1
node --env-file=.env.local scripts/evaluate-farmer-chat.mjs --limit=6 --representative
```

Script live mặc định một câu, dừng lỗi đầu tiên. `--representative --limit=6` chọn ba cây × hai chủ đề; không mặc định chạy toàn bộ 30 câu làm cạn quota. Kết quả ở `tmp/farmer-chat-evaluation/results.json` (Git bỏ qua); không commit key hoặc lịch sử người dùng. Smoke provider trực tiếp chưa thay thế nghiệm thu function đã deploy với JWT/CORS thật.

Ngày 19/10: lượt đầu timeout 25 giây; sau bổ sung tắt reasoning, sáu mẫu đều trả JSON/nguồn hợp lệ trong khoảng 3–15 giây. Có lỗi diễn đạt ở một số câu; chưa phải nghiệm thu chuyên môn nông học. Chi tiết kết quả mock/cloud và tình trạng deploy tại [biên bản tích hợp](openrouter-dashboard-acceptance.md).

Nguồn: [Free Models Router](https://openrouter.ai/docs/cookbook/get-started/free-models-router-playground), [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [Reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [Supabase Secrets](https://supabase.com/docs/guides/functions/secrets).
