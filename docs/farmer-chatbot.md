# Trợ lý nhà vườn — Gemini MVP

## Phạm vi

Thẻ dưới tiêu đề `/farmer/dashboard` mở khung chat tối đa 480px, toàn màn hình ở ≤850px. Chỉ FARMER dùng được. Hỏi đáp về dấu hiệu bệnh, giới hạn dữ liệu phòng ngừa và phân loại tham khảo cho sầu riêng, mít, thanh long.

Mỗi câu hỏi là một request độc lập. Không memory phía model, không gửi transcript, không tool calling, không streaming, không tự retry. Không nhận ảnh, ghi nhật ký, sửa domain data, truy cập thời tiết/giá trực tiếp hoặc tạo chứng nhận xuất khẩu. Không có migration hay dịch vụ vector mới.

Nội dung hiển thị trong React state theo identity của `SessionWorkspace`, ngoài vùng reset của `ADemoProvider`. Đóng/mở và điều hướng SPA giữ các cặp hỏi đáp; refresh/đổi identity xóa chúng. Request cũ được hủy và kết quả muộn bị bỏ qua khi xóa chat hoặc đổi identity. Token refresh cùng user không xóa chat.

## Dữ liệu và giới hạn chất lượng

- Nguồn khách hàng: [Tổng hợp bệnh và phân loại.xlsx](https://drive.google.com/file/d/1AsJqN1X3V-2xqyqWWGCfqyxTuURC47d3), lấy nội dung ngày 17/10/2026. Yêu cầu chức năng nằm trong PDF `[VNYLT 26 - LOGSTAR] (2)` khách hàng cung cấp.
- `supabase/functions/farmer-chat/knowledge.json` có 27 mục, gồm 14 mục bệnh và 13 mục phân loại. Mỗi mục có ID, cây, chủ đề, nội dung, nguồn và phiên bản `2026-10-17-v1`.
- Đây là bản biên tập từ bảng tổng hợp, **chưa xác minh độc lập mọi khẳng định nông học hoặc tài liệu sơ cấp được bảng nhắc tới**. Link nguồn dẫn về workbook đã thực sự đọc, không tạo URL sơ cấp chưa kiểm tra. Dữ liệu runtime được đóng gói phía server, không gửi kèm frontend và không tải lại workbook khi chat.
- Bỏ các khẳng định kênh xuất khẩu/mục đích sử dụng khỏi nội dung phân loại; giữ nhãn tham khảo và yêu cầu xác nhận bên thu mua. Ranh giới chồng/lọt và ưu tiên nhiều tiêu chí chưa được tự lấp.
- Bảng chưa có biện pháp phòng ngừa đầy đủ đã đối soát, PHI theo sản phẩm, nhiệt độ bảo quản hoặc dữ liệu thời tiết/giá trực tiếp. Bot phải nói thiếu dữ liệu; không dùng kiến thức mô hình để điền vào các mục này.
- Trước pilot thực, cần chuyên gia/chủ nội dung đối soát và cập nhật nguồn/phiên bản. JSON/schema hợp lệ không chứng minh câu trả lời đúng về nông học.

## Request và xử lý

Browser gọi `supabase.functions.invoke('farmer-chat', { body, signal })`, dùng JWT tài khoản đăng nhập. Body chỉ có:

```json
{"crop":"DURIAN","topic":"DISEASE","growthStage":"UNKNOWN","question":"Tình huống mẫu: mưa nhiều thì bảng có những dấu hiệu nào cần lưu ý?"}
```

`crop`: DURIAN/JACKFRUIT/DRAGON_FRUIT; `topic`: DISEASE/GRADING; `growthStage`: UNKNOWN/NEW_SHOOTS/FLOWERING/YOUNG_FRUIT/FRUIT_DEVELOPMENT/PRE_HARVEST/POST_HARVEST. Câu hỏi không rỗng, tối đa 1.500 UTF-16 code units (cùng cách đếm `maxLength` của textarea). Các trường thừa như userId/history/model/knowledge bị từ chối.

Function xác thực JWT qua `auth.getUser`, chỉ đọc `profiles.role` của identity đó và yêu cầu FARMER. Không đọc hồ sơ vườn, lô, contact, notes hoặc giá sàn. Chỉ lọc JSON theo cây/chủ đề rồi dựng một `systemInstruction` và **một** user content chứa context, knowledge, question.

Gemini được gọi qua REST `generateContent` với `x-goog-api-key`, JSON schema cho answer/sourceIds/followUpQuestions, output tối đa 1.024 token, thinking MINIMAL, timeout 25 giây. Không tool, history, Files API hay cache hội thoại. Response phải có đúng một candidate kết thúc STOP, text/JSON hợp lệ, nguồn thuộc nhóm đã gửi và tối đa hai câu hỏi làm rõ. Nội dung trống, bị chặn, bị cắt hoặc nguồn lạ trả lỗi; không tự gọi model để sửa kết quả.

Tên/link nguồn lấy từ JSON backend. UI render plain text; HTML do model tạo không thực thi. Schema/source checks không ngăn được mọi phát biểu không có căn cứ, cần kiểm thử chất lượng bằng người đọc.

Response thành công: `{ answer, sources: [{id,title,url?}], followUpQuestions, requestId }`. Lỗi: `{ error: {code,message}, requestId }`, mã HTTP 400/401/403/405/429/502/503/504 phù hợp. API không trả provider body, key hoặc JWT. Log chỉ có requestId/model/durationMs/code, token usage khi nhận được và mã HTTP/mã lỗi máy đọc được của provider khi cần chẩn đoán.

## Cấu hình và triển khai

1. Tạo Gemini API key hợp lệ trong Google AI Studio cho project demo; kiểm tra model/free quota đang có. Không coi khóa API Google khác là khóa Gemini hợp lệ.
2. Copy `supabase/functions/farmer-chat/.env.example` sang file local bị gitignore, ví dụ `tmp/farmer-chat.env`; điền key ở máy mình. Thay `FARMER_CHAT_ALLOWED_ORIGINS` bằng danh sách origin frontend chính xác, cách nhau dấu phẩy. Không dùng `*`. Thiếu origin cấu hình thì endpoint fail closed.
3. Với Supabase CLI đã cài và đã đăng nhập vào đúng project, nạp secrets từ file local rồi deploy function:

```powershell
supabase secrets set --env-file tmp/farmer-chat.env --project-ref yyslykqpamnlqkvutrlm
supabase functions deploy farmer-chat --project-ref yyslykqpamnlqkvutrlm
```

CLI/project access phải do người có quyền cấu hình. Không chạy migration hoặc deploy lại schema. `SUPABASE_URL`/`SUPABASE_ANON_KEY` là biến sẵn có của Edge runtime, không dùng service-role cho truy vấn domain. Giữ JWT verification và kiểm tra JWT/role trong handler; nếu gateway trả 401, kiểm tra cấu hình JWT của project theo tài liệu Supabase trước khi đổi cài đặt xác thực.

Frontend không có key/model riêng trong `.env`. Sau deploy, đăng nhập FARMER và mở “Hỏi trợ lý”. Thẻ chỉ mở UI, không tự gọi Gemini; một lần gửi tương ứng tối đa một lần gọi model. Missing key/invalid key/quota đều hiển thị lỗi thật, không có câu trả lời giả dự phòng.

**Free-tier chỉ phục vụ demo bằng tình huống mẫu/tài liệu được phép dùng.** UI không tự gửi domain data, nhưng không thể bảo đảm người dùng không tự nhập thông tin riêng. Google có thể dùng nội dung unpaid services để cải thiện sản phẩm; không gửi thông tin cá nhân/bí mật kinh doanh. Chưa có bộ đếm/hạn mức riêng từng người: server xác thực role, UI khóa gửi đồng thời và API sử dụng quota của project Gemini. Chưa phù hợp mở endpoint demo cho lượng người dùng không kiểm soát.

## Kiểm thử và đánh giá

- Unit/backend: input/access/origin gates trước inference, payload một lượt, 6 nhóm kiến thức, source checks, timeout/quota/provider failure, response hỏng/truncated, log không chứa nội dung hay secret; UI/session/API error tests.
- `tests/system/farmer-assistant.spec.ts` dùng Supabase HTTP mock và handler thật với Gemini fake ở ranh giới fetch; không gọi Google. Kiểm tra desktop/mobile, focus, plain text, nguồn, không memory, quota, reset và identity.
- `tests/fixtures/farmer-chat-evaluation.json` gồm 30 câu hỏi giả lập cho 3 cây × 2 chủ đề, có rubric để người đọc đánh giá grounding, thiếu dữ kiện, ranh giới phân loại, prompt injection và yêu cầu ngoài phạm vi.
- Smoke thật mặc định **một** request, dừng ở lỗi đầu tiên, không in bí mật/provider message. Dùng biến môi trường server `GEMINI_API_KEY` (script cũng nhận `GOOGLE_API_KEY` có sẵn trên máy), rồi chạy:

```powershell
node scripts/evaluate-farmer-chat.mjs --limit=1
# Chạy toàn bộ chỉ khi đã kiểm tra quota và được phép sử dụng key:
node scripts/evaluate-farmer-chat.mjs --limit=30
```

Script dùng Node 24 `stripTypeScriptTypes` để chạy cùng service với Edge handler, không dùng SDK AI/framework mới. Kết quả với câu hỏi mẫu nằm trong `tmp/farmer-chat-evaluation/results.json` (gitignored); mỗi câu trả lời cần người đọc đánh dấu theo rubric. Smoke trực tiếp không thay thế nghiệm thu function đã deploy/JWT/CORS trên cloud.

## Trạng thái nghiệm thu hiện tại

| Kiểm tra local | Kết quả |
| --- | --- |
| Typecheck và production build | Đạt |
| Unit/component/backend | 241/241 đạt; kiểm tra lại 37 ca service/API sau bổ sung chẩn đoán provider cũng đạt |
| Playwright toàn ứng dụng | 161/161 đạt, bao gồm 9 ca chatbot mới |
| Responsive chatbot | 320/390/768/1440px; đã xem ảnh desktop/mobile |
| Bundle frontend | Không chứa khóa có trong môi trường, nội dung knowledge server hoặc URL gọi Gemini |
| Gemini live | Chưa đạt: khóa có sẵn bị từ chối `API_KEY_INVALID` |
| Chất lượng 30 câu hỏi | Đã chuẩn bị corpus/rubric; chưa có phản hồi thật để nghiệm thu |
| Function cloud/JWT/CORS thật | Chưa deploy/nghiệm thu trong đợt local |

Code chức năng, corpus và hướng dẫn đã có. Lần smoke với khóa Google API sẵn trong môi trường bị Gemini từ chối HTTP 400 / `API_KEY_INVALID`; không nhận được câu trả lời thật, chưa đánh giá chất lượng 30 câu. Không deploy function hoặc cấu hình secret cloud trong đợt triển khai local này. Cần key Gemini hợp lệ và quyền deploy để nghiệm thu cloud.

Tham khảo: [Gemini model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite), [API](https://ai.google.dev/api/generate-content), [Terms](https://ai.google.dev/gemini-api/terms), [Pricing](https://ai.google.dev/gemini-api/docs/pricing).
