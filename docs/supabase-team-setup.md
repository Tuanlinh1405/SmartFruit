# Cấu hình Supabase cho Dev A và Dev B

Cập nhật: 15/10/2026. Cấu hình, đăng nhập các role và nghiệp vụ đã được kiểm tra HTTPS thực tế với project LogStar. [Trạng thái và tài khoản test](implementation-status.md).

## 1. Project dùng chung

- Project: **LogStar** (`yyslykqpamnlqkvutrlm`).
- [Dashboard project](https://supabase.com/dashboard/project/yyslykqpamnlqkvutrlm).
- [Các bảng dữ liệu](https://supabase.com/dashboard/project/yyslykqpamnlqkvutrlm/editor).
- [Thành viên tổ chức](https://supabase.com/dashboard/org/dikzdynyngflojwrondn/team).
- Supabase URL: `https://yyslykqpamnlqkvutrlm.supabase.co`.
- Database schema: `public`. Bucket ảnh private: `lot-images`.
- Thông tin project không có secrets nằm trong `supabase/project.json`.

Đã kiểm tra Team trong Dashboard: tổ chức có hai thành viên, một Owner và một Administrator. Thành viên còn lại ngoài tài khoản hiện tại đã có quyền Owner. Có thể dùng tài khoản đó mở project, xem/sửa dữ liệu và quản lý cấu hình; không cần mời lại hoặc tăng quyền.

## 2. Khởi tạo máy của mỗi developer

Cần Node.js >=22 theo yêu cầu phiên bản Supabase SDK đã khóa trong package-lock.json. Môi trường đã kiểm thử là Node 24.16.0.

Sau khi nhận code repo này, chạy tại thư mục gốc:

```powershell
npm ci
npm run setup:supabase
npm run check:supabase
npm run typecheck
```

- `npm ci` cài đúng phiên bản đã khóa, gồm Supabase JS SDK và TypeScript.
- `setup:supabase` tạo `.env.local` từ `.env.example`. Nếu đã có `.env.local`, giữ nguyên file để tránh ghi đè cấu hình cá nhân.
- `.env.example` đã có URL và **publishable key thực của project**, nên không cần tìm hoặc dán key thủ công.
- `.env.local` được Git ignore. Không gửi `.env.local` qua Git; các thành viên tự tạo từ cùng `.env.example`.
- Nếu Vite đang chạy khi đổi biến môi trường, khởi động lại Vite.

Repo đã có React/Vite, Auth và workspace cho các role. Sau khi setup chạy `npm run dev`. Dev A phát triển tiếp Farmer/Carrier trên scaffold hiện tại, dùng client và Auth chung.

## 3. Dùng Supabase client trong Farmer/Carrier

Client dùng chung tại `src/lib/supabase.ts`. Trong mã TypeScript của ứng dụng, import bằng đường dẫn tương đối phù hợp, ví dụ từ `src/features/profiles/farmer.api.ts`:

```typescript
import { supabase } from '../../lib/supabase';

export async function getFruitTypes() {
  const { data, error } = await supabase
    .from('fruit_types')
    .select('id, code, name')
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data;
}
```

Chỉ dùng một client chung; không khởi tạo client riêng cho từng page. Client đã bật lưu session, tự refresh token, xử lý session callback URL và schema public. Dùng trong ứng dụng Vite; import.meta.env không được Node thông thường nạp như Vite. Lệnh check riêng dùng SDK ở môi trường Node.

Các biến cấu hình:

```dotenv
VITE_SUPABASE_URL=https://yyslykqpamnlqkvutrlm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<giá trị thực đã có trong .env.example>
```

Publishable key được thiết kế để dùng ở browser, với Auth/RLS kiểm soát dữ liệu. Client chỉ nhận key dạng `sb_publishable_`; không dùng secret/service-role key hoặc mật khẩu DB trong Vite. [Tài liệu API keys của Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

## 4. Dashboard và tài khoản ứng dụng

Quyền Owner/Administrator trên Dashboard là quyền của thành viên đội phát triển. Các role FARMER/BUYER/CARRIER/ADMIN trong bảng profiles là quyền của người dùng ứng dụng. Đăng nhập Dashboard không tạo session Supabase Auth trong React app.

Ngày 15/10/2026 đã tạo thêm 7 tài khoản email/mật khẩu đầy đủ role. Dùng `farmer1@logstar.test`, `farmer2@logstar.test`, `carrier1@logstar.test`, `carrier2@logstar.test` để test Dev A. Nhận mật khẩu qua kênh riêng từ người giữ `tmp/test-accounts.md`; pull Git không có mật khẩu hoặc backend key. Các placeholder DEMO cũ vẫn không đăng nhập được. Khi cần tạo tài khoản khác:

1. Tạo account demo riêng trong Supabase Auth theo phương án đăng nhập team đang dùng; mật khẩu trao riêng, không đưa vào repo.
2. Quản trị viên cấp `profiles.role` đúng FARMER hoặc CARRIER theo [quy trình schema](database-schema.md#6-auth-provisioning-và-api-contract-cho-dev-ab). Trigger chỉ tự nhận role đáng tin từ app_metadata lúc tạo Auth user; user_metadata không cấp quyền.
3. Đăng nhập account đó qua `supabase.auth.signInWithPassword(...)` trong client, sau đó tạo hồ sơ Farmer/Carrier.
4. Dùng `auth.getUser()` lấy user ID, tạo/cập nhật dữ liệu của chính account. RLS kiểm tra quyền ở database.

Theo quyết định người dùng ngày 15/10/2026, dùng email/password cho test; app vẫn hỗ trợ phone/password, bỏ OTP. Không cần SMS.

Khi chưa đăng nhập, query bảng bị lỗi quyền `42501` là hành vi mong đợi của schema hiện tại. Không mở grants cho anon hoặc tắt RLS để làm query chạy được.

## 5. Lệnh kiểm tra kết nối xác nhận điều gì?

`npm run check:supabase` không thay đổi database. Lệnh kiểm tra:

- URL đúng project dùng chung và key đúng dạng publishable.
- Auth service chấp nhận URL/key qua HTTPS.
- SDK gọi được Data API; tài khoản chưa đăng nhập bị database chặn đúng quyền.

Kết quả đã quan sát: cả hai kiểm tra mạng đạt. `npm run typecheck` cũng đạt. Lệnh này không tự đăng nhập, tạo user hoặc xác nhận CRUD của một role cụ thể.

Nếu FAIL kết nối, kiểm tra mạng/DNS/proxy trước; nếu lỗi HTTP 401, kiểm tra publishable key còn hiệu lực; nếu đổi .env.example, cập nhật .env.local hiện có thủ công vì setup không ghi đè.

## 6. Database và phối hợp A/B

Baseline 12 bảng, bucket, migration hybrid và 5 bảng giao dịch đã tạo trên project này. Mỗi người không chạy lại `supabase/deploy.sql` hoặc các migration đã áp.

- Schema/đơn vị/quyền: [database-schema.md](database-schema.md).
- Kết quả triển khai: [database-deployment.md](database-deployment.md).
- Dev A: Farmer, lots, ảnh, Carrier/vehicles.
- Dev B: Auth chung, Buyer, matching, giao dịch và Admin dùng database thật.
- Thay đổi schema tiếp theo viết migration mới và cùng review; không dùng reset database trên project dùng chung.

Supabase CLI dùng đăng nhập riêng của developer nếu sau này cần schema tools. Cấu hình SDK này không chứa PAT hay mật khẩu DB. Initial migration được áp qua SQL Editor nên phải reconcile migration history trước khi dùng CLI db push; chưa thực hiện db push trong bước cấu hình client này.

Tài liệu chính thức: [React client setup](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs), [createClient](https://supabase.com/docs/reference/javascript/initializing), [Dashboard access control](https://supabase.com/docs/guides/platform/access-control).
