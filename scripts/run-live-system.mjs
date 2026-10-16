import { spawn } from 'node:child_process';
const required = ['A_TEST_SUPABASE_URL','A_TEST_SUPABASE_KEY','A_TEST_ACCOUNTS'];
if (required.some(name => !process.env[name])) {
  console.error('Chưa cấu hình môi trường/tài khoản local: A_TEST_SUPABASE_URL, A_TEST_SUPABASE_KEY, A_TEST_ACCOUNTS. Chưa nghiệm thu live.');
  process.exitCode = 1;
} else if (!process.env.A_TEST_SUPABASE_KEY.startsWith('sb_publishable_')) {
  console.error('Live UI chỉ nhận publishable key; không dùng admin/secret key.'); process.exitCode = 1;
} else {
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js','test','--project=a-live'], { stdio: 'inherit', env: { ...process.env, RUN_A_LIVE: '1', SMARTFRUIT_LIVE_SYSTEM: '1' } });
  child.on('error', () => { console.error('Không khởi động được Playwright.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
