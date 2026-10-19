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

## Tài khoản test A và migration sau merge Linh

Môi trường chọn: LogStar `yyslykqpamnlqkvutrlm`. Sáu hồ sơ seed chưa có mật khẩu. Cần sáu user test khác nhau: farmer1/farmer2 (FARMER), carrier1/carrier2 (CARRIER), buyer (BUYER), admin (ADMIN).

### Kiểm tra migration trong SQL Editor (chỉ đọc)

Chọn đúng project LogStar và chạy:

```sql
select to_regclass('supabase_migrations.schema_migrations') as history_table;
select to_regprocedure('public.replace_lot_image(uuid,text)') as replace_image_rpc,
       to_regprocedure('public.delete_empty_lot(uuid)') as delete_empty_lot_rpc;
```

Nếu history_table khác NULL, chạy thêm:

```sql
select m.version, to_jsonb(m)->>'name' as name
from supabase_migrations.schema_migrations m
order by m.version;
```

Gửi lại version/name và hai cột RPC; không gửi secrets. History trống không chứng minh schema chưa áp nếu đã dùng SQL Editor thủ công. RPC tồn tại vẫn cần đối chiếu policies/definition. Hai file A/B trùng prefix `202610150001`; chưa chạy db push, repair hoặc deploy.sql trước khi đối chiếu. [Supabase migration history](https://supabase.com/docs/guides/deployment/database-migrations).

### Cấp account phone/password bằng Admin API local

Chỉ chủ project/người có quyền quản trị thực hiện. Lấy service-role/secret key từ API Keys của project; không đưa vào VITE_*, frontend hoặc chat. Admin API hỗ trợ phone_confirm để cấp account test không cần SMS: [Supabase createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

Trong PowerShell ở repo, nhập key và sáu phone/password riêng. Dùng số test dạng +84..., không dùng số của người dùng thật hoặc sáu số seed:

```powershell
$env:A_TEST_SUPABASE_URL = 'https://yyslykqpamnlqkvutrlm.supabase.co'
$adminInput = Read-Host 'Admin key (khong dan vao chat)' -AsSecureString
$env:A_ADMIN_KEY = [System.Net.NetworkCredential]::new('', $adminInput).Password
$testAccountMap = [ordered]@{}
foreach ($alias in @('farmer1','farmer2','carrier1','carrier2','buyer','admin')) {
  $phoneInput = Read-Host "Phone rieng cho $alias (+84...)"
  $passwordInput = Read-Host "Password cho $alias" -AsSecureString
  $testAccountMap[$alias] = @{
    phone = $phoneInput.Trim()
    password = [System.Net.NetworkCredential]::new('', $passwordInput).Password
  }
}
$env:A_TEST_ACCOUNTS = $testAccountMap | ConvertTo-Json -Depth 3 -Compress
```

Lưu đoạn sau thành `tmp/provision-test-users.mjs` (tmp đã được gitignore). Không đặt key/password vào file. Script chỉ tạo user mới, không đổi account có sẵn; chỉ in alias/UUID:

```js
import { createClient } from '@supabase/supabase-js';
const accounts = JSON.parse(process.env.A_TEST_ACCOUNTS);
const admin = createClient(process.env.A_TEST_SUPABASE_URL, process.env.A_ADMIN_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const roleMap = { farmer1:'FARMER', farmer2:'FARMER', carrier1:'CARRIER', carrier2:'CARRIER', buyer:'BUYER', admin:'ADMIN' };
const phones = Object.values(accounts).map(a => a.phone);
if (new Set(phones).size !== 6 || phones.some(p => !/^\+[1-9]\d{7,14}$/.test(p))) throw new Error('Can sau phone rieng, dung dinh dang quoc te');
for (const [alias, role] of Object.entries(roleMap)) {
  const a = accounts[alias];
  const { data, error } = await admin.auth.admin.createUser({
    phone: a.phone, password: a.password, phone_confirm: true,
    app_metadata: { app_role: role }, user_metadata: { full_name: `A TEST ${alias}` }
  });
  if (error) throw new Error(`Tao ${alias} that bai (${error.status ?? 'unknown'}); kiem tra Dashboard, khong chay lai nguyen batch`);
  console.log(`CREATED ${alias}: ${data.user.id}`);
  const check = await admin.from('profiles').select('role').eq('id', data.user.id).single();
  if (check.error || check.data?.role !== role) throw new Error(`Can kiem tra profiles.role cua ${alias}`);
}
```

Chạy một lần trong cùng terminal:

```powershell
node tmp/provision-test-users.mjs
Remove-Item Env:A_ADMIN_KEY -ErrorAction SilentlyContinue
Remove-Variable adminInput -ErrorAction SilentlyContinue
```

Nếu tạo thành công một phần, kiểm tra các UUID đã in và Dashboard trước khi tiếp tục; không chạy lại nguyên batch hoặc tự xóa account cũ. app_role trong app_metadata được trigger dùng khi tạo user; user_metadata không cấp quyền. Chưa có domain profile là bình thường, form A/Buyer sẽ tạo theo role.

### Chạy nghiệm thu thật

Chỉ chạy sau khi chốt migration. Giữ A_TEST_ACCOUNTS trong cùng terminal, nhập publishable key (không phải admin key):

```powershell
$publishableInput = Read-Host 'Publishable key cua LogStar'
$env:A_TEST_SUPABASE_KEY = $publishableInput.Trim()
$env:RUN_A_LIVE = '1'
npm.cmd run test:integration
npm.cmd run test:system:live
```

SDK suite dùng RUN_A_LIVE; system runner bật SMARTFRUIT_LIVE_SYSTEM riêng. test:system mặc định luôn dùng HTTP mock local, kể cả RUN_A_LIVE còn trong terminal. Live suite tắt trace/screenshot/video, cleanup dữ liệu có tag và phục hồi profile cũ; không tự xóa các tài khoản test.

Kết thúc phiên:

```powershell
Remove-Item Env:A_ADMIN_KEY, Env:A_TEST_ACCOUNTS, Env:A_TEST_SUPABASE_KEY, Env:A_TEST_SUPABASE_URL, Env:RUN_A_LIVE -ErrorAction SilentlyContinue
Remove-Variable testAccountMap, passwordInput, phoneInput, publishableInput, adminInput -ErrorAction SilentlyContinue
```

### Đăng nhập bằng tài khoản email có sẵn

Để test thủ công trước, chỉ cần một tài khoản có role FARMER; CARRIER dùng khi test xe. Bộ test tự động đầy đủ mới cần sáu tài khoản. Form `/login` nhận email hoặc SĐT quốc tế và mật khẩu. Tài khoản email đã tạo trong Supabase Auth có thể dùng trực tiếp; app vẫn đọc profiles.role và giữ guard/RLS như trước. Không đổi account Buyer thành Farmer để test; dùng account Farmer/Carrier tương ứng. Nếu không biết mật khẩu, hỏi người tạo hoặc dùng quy trình quản trị đặt lại; không thể đọc mật khẩu hiện tại từ Dashboard.

A_TEST_ACCOUNTS hỗ trợ mỗi mục `{ "email": "account@example.com", "password": "..." }` hoặc `{ "phone": "+84...", "password": "..." }`; chỉ lưu trong env local, không commit.

### Đặt lại mật khẩu tài khoản Auth đã có

Chủ project có thể chạy local, không gửi email khôi phục tới địa chỉ mẫu .test:

```powershell
npm.cmd run auth:reset-password -- --user-id <UID-trong-Authentication-Users> --email <email-cua-account>
```

Công cụ lấy URL từ supabase/project.json, hỏi secret/service_role key (API Keys của project), mật khẩu mới ít nhất 6 ký tự (chính sách project có thể yêu cầu mạnh hơn) và nhập lại; mọi ô bí mật đều ẩn, không ghi key/password vào file hoặc đối số. UID/email phải khớp; chỉ gửi trường password, không đổi role/metadata. Chưa chạy live thay người dùng. Sau thông báo thành công, mở /login và nhập email/mật khẩu mới. Không dùng key publishable; không nhập secrets vào chat hoặc frontend.

Dựa trên [Supabase Admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid). Test local của CLI: `node --test scripts/reset-auth-password.test.mjs`; không gọi cloud.

Đổi chung mật khẩu cho tài khoản test có email `@logstar.test`:

```powershell
npm.cmd run auth:reset-password -- --test-accounts
npm.cmd run auth:reset-password -- --test-accounts --apply
```

Lệnh đầu chỉ liệt kê. Lệnh thứ hai liệt kê lại rồi hỏi mật khẩu chung và xác nhận; có thể nhập `abc123` cho đợt test tạm nếu policy Supabase cho phép. Không sửa policy project, không tạo tài khoản hoặc đổi role, không tác động email ngoài domain này. Nếu batch lỗi, các dòng đã báo thành công đã đổi; công cụ dừng và ghi rõ tài khoản đang xử lý, không giả lập rollback. Password/key không được lưu.
