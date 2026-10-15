import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

// Load only these two public settings; shell variables take precedence.
// Do not print keys or require a service-role key for this connectivity check.
const names = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
const environment = {};
try {
  const text = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY)\s*=\s*(.*?)\s*$/);
    if (match) environment[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
for (const name of names) if (process.env[name]) environment[name] = process.env[name];

try {
  const url = environment.VITE_SUPABASE_URL?.trim();
  const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error('Thiếu .env.local. Chạy npm run setup:supabase trước.');
  if (!key.startsWith('sb_publishable_')) throw new Error('Cần publishable key của project, không dùng secret/service-role key.');
  const project = JSON.parse(await readFile(new URL('../supabase/project.json', import.meta.url), 'utf8'));
  if (new URL(url).origin !== project.url) throw new Error(`URL chưa trỏ tới project dùng chung ${project.ref}.`);

  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Supabase Auth không chấp nhận kết nối (HTTP ${response.status}). Kiểm tra URL/key.`);
  console.log(`PASS: kết nối project ${project.name} (${project.ref}); Auth nhận publishable key.`);

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  });
  const { error } = await client.from('fruit_types').select('id').limit(1);
  if (error?.code === '42501') {
    console.log('PASS: Data API phản hồi; tài khoản chưa đăng nhập bị chặn đúng quyền database.');
  } else if (error) {
    throw new Error(`Data API trả lỗi ${error.code ?? 'unknown'}: ${error.message}`);
  } else {
    throw new Error('Catalog đang đọc được khi chưa đăng nhập; cần kiểm tra lại grants/RLS theo schema LogStar.');
  }
  console.log('Cấu hình sẵn sàng. Đăng nhập tài khoản Auth đúng role để đọc/ghi dữ liệu ứng dụng.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
