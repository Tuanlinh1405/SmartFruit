import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/system',
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'production', testMatch: /(?:start|skeleton)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173' } },
    { name: 'ui-kit-dev', testMatch: /ui-kit\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173' } },
  ],
  webServer: [{
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  }, {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 120_000,
  }],
});
