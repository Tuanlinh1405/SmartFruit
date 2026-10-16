// Trusted local CLI only. Never imported by frontend or run by test suites.
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

class UserError extends Error {}
function apiError(error, operation) {
  const detail = error?.status ? ` (HTTP ${error.status})` : '';
  return new UserError(`${operation}${detail}. Kiểm tra quyền quản trị/kết nối và chính sách mật khẩu; không gửi key vào chat.`);
}
export async function verifyTarget(admin, userId, email) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) || !email?.includes('@')) throw new UserError('Cần UID và email của đúng tài khoản.');
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw apiError(error, 'Không đọc được tài khoản');
  if (data.user?.id !== userId || data.user.email?.toLowerCase() !== email.trim().toLowerCase()) throw new UserError('UID và email không khớp. Đã dừng, chưa đổi mật khẩu.');
  return data.user;
}
export async function resetTargetPassword(admin, userId, email, password) {
  if (typeof password !== 'string' || password.length < 6) throw new UserError('Dùng mật khẩu mới ít nhất 6 ký tự; project có thể yêu cầu mạnh hơn.');
  await verifyTarget(admin, userId, email);
  const { data, error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw apiError(error, 'Chưa đặt lại được mật khẩu');
  if (data.user?.id !== userId) throw new UserError('Đã gửi yêu cầu nhưng chưa xác nhận kết quả. Kiểm tra tài khoản trước khi thử lại.');
}
export async function listTestAccounts(admin) {
  const users = new Map();
  for (let page = 1; page <= 1000; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw apiError(error, 'Không đọc được danh sách tài khoản; chưa đổi mật khẩu');
    if (!Array.isArray(data?.users)) throw new UserError('Danh sách tài khoản không hợp lệ; chưa đổi mật khẩu.');
    for (const user of data.users) {
      if (/^[^@\s]+@logstar\.test$/i.test(user.email ?? '')) users.set(user.id, user);
    }
    if (data.users.length < 100) return [...users.values()].sort((a, b) => a.email.localeCompare(b.email));
  }
  throw new UserError('Chưa đọc hết danh sách tài khoản; đã dừng trước khi đổi mật khẩu.');
}
async function secret(prompt) {
  if (!process.stdin.isTTY) throw new UserError('Chạy lệnh trực tiếp trong PowerShell/terminal để nhập bí mật; không truyền key/mật khẩu qua command line.');
  process.stdout.write(prompt);
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const input = createInterface({ input: process.stdin, output, terminal: true });
  try { return await input.question(''); }
  finally { input.close(); process.stdout.write('\n'); }
}
async function main(args) {
  if (args.includes('--help')) {
    console.log('npm.cmd run auth:reset-password -- --user-id <UID> --email <email>');
    console.log('npm.cmd run auth:reset-password -- --test-accounts [--apply]');
    console.log('--test-accounts chỉ liệt kê @logstar.test; thêm --apply để nhập mật khẩu chung và đổi.');
    console.log('Key quản trị và mật khẩu được hỏi riêng, không ghi file. Chỉ đổi password của UID/email khớp.');
    return;
  }
  const options = new Map();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (options.has(flag)) throw new UserError('Không lặp lại đối số.');
    if (['--test-accounts', '--apply'].includes(flag)) options.set(flag, true);
    else if (['--user-id', '--email'].includes(flag) && args[i+1] && !args[i+1].startsWith('--')) options.set(flag, args[++i]);
    else throw new UserError('Đối số không hợp lệ. Dùng --help; không truyền key/mật khẩu làm đối số.');
  }
  const userId = options.get('--user-id'); const email = options.get('--email');
  const bulk = options.has('--test-accounts');
  if (bulk ? userId || email : !userId || !email || options.has('--apply')) throw new UserError('Chọn UID/email hoặc --test-accounts [--apply].');
  const project = JSON.parse(await readFile(new URL('../supabase/project.json', import.meta.url), 'utf8'));
  console.log(`Project: ${project.name} (${project.ref}). Account: ${bulk ? '@logstar.test only' : email}.`);
  const adminKey = (await secret('Dán secret/service_role key (ẩn nội dung): ')).trim();
  if (!adminKey || adminKey.startsWith('sb_publishable_')) throw new UserError('Cần key quản trị của project, không phải publishable key.');
  const admin = createClient(project.url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  });
  const targets = bulk ? await listTestAccounts(admin) : [await verifyTarget(admin, userId, email)];
  for (const target of targets) console.log(`${target.email} (${target.id})`);
  if (!targets.length) { console.log('Không có tài khoản @logstar.test. Chưa thay đổi gì.'); return; }
  if (bulk && !options.has('--apply')) { console.log('Chỉ liệt kê; chưa đổi mật khẩu. Thêm --apply để thực hiện.'); return; }
  const password = await secret('Mật khẩu mới cho danh sách trên (ít nhất 6 ký tự, ẩn nội dung): ');
  const confirmation = await secret('Nhập lại mật khẩu mới (ẩn nội dung): ');
  if (password !== confirmation) throw new UserError('Hai lần nhập không giống nhau. Chưa đổi mật khẩu.');
  for (const target of targets) {
    try {
      await resetTargetPassword(admin, target.id, target.email, password);
      console.log(`Đã đặt lại: ${target.email}`);
    } catch (error) {
      console.error(`Dừng tại ${target.email}; các dòng đã báo thành công trước đó đã được đổi. Các tài khoản tiếp theo chưa được xử lý.`);
      throw error;
    }
  }
  console.log('Mở http://127.0.0.1:5173/login và nhập email cùng mật khẩu vừa đặt.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error instanceof UserError ? error.message : 'Không xác nhận được thao tác. Kiểm tra kết nối/quyền quản trị và thử đăng nhập; không gửi key hoặc mật khẩu vào chat.'); process.exitCode = 1; });
}
