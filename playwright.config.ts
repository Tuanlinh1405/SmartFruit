import { defineConfig, devices } from '@playwright/test';

// SDK RUN_A_LIVE alone must never point the default mock suite at cloud.
const live = process.env.SMARTFRUIT_LIVE_SYSTEM === '1';
const appEnv = { VITE_SUPABASE_URL: live ? process.env.A_TEST_SUPABASE_URL! : 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: live ? process.env.A_TEST_SUPABASE_KEY! : 'sb_publishable_test_only_browser_fixture' };

export default defineConfig({
  testDir: './tests/system',
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  projects: [
    ...(!live ? [{ name: 'production', testMatch: /(?:start|skeleton|a-demo|a-connected|ui-unification|farmer-assistant|farmer-dashboard|trading|registration|customer-feedback)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' } }] : []),
    ...(live ? [{ name: 'a-live', testMatch: /a-live\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175', trace: 'off' as const, screenshot: 'off' as const, video: 'off' as const } }] : []),
    ...(!live ? [{ name: 'ui-kit-dev', testMatch: /(?:ui-kit|a-harness)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5175' } }] : []),
  ],
  webServer: [{
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    env: appEnv,
    timeout: 120_000,
  }, {
    command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    env: appEnv,
    timeout: 120_000,
  }],
});
