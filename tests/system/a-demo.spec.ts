import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './support/mock-api';
test.beforeEach(async ({ page }, info) => { await installMockApi(page); await loginAs(page, info.title.toLowerCase().includes('/carrier/') || info.title.startsWith('carrier ') ? 'CARRIER' : 'FARMER'); });
const pages = ['/farmer/transport', '/farmer/prices', '/farmer/weather', '/farmer/map', '/farmer/notifications', '/carrier/dashboard', '/carrier/requests', '/carrier/tracking', '/carrier/reviews'];
for (const width of [1440, 768, 390]) for (const route of pages) test(`A workspace responsive ${route} at ${width}`, async ({ page }) => {
  const errors: string[] = []; const remote: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.url().includes('supabase.co')) remote.push(r.url()); });
  await page.setViewportSize({ width, height: 960 }); await page.goto(route); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if (route.endsWith('/dashboard')) await expect(page.getByRole('region', { name: 'Thống kê tài khoản' })).toBeVisible();
  else await expect(page.getByText('Chưa hỗ trợ', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); expect(errors).toEqual([]); expect(remote).toEqual([]);
});
test('deferred Farmer integrations do not offer simulated submissions', async ({ page }) => {
  for (const route of ['/farmer/transport','/farmer/prices','/farmer/weather','/farmer/map','/farmer/notifications']) {
    await page.goto(route); await expect(page.getByText('Chưa hỗ trợ', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /minh họa/ })).toHaveCount(0);
  }
});
test('carrier deferred transport and reviews cannot create fake bookings', async ({ page }) => {
  for (const route of ['/carrier/requests','/carrier/tracking','/carrier/reviews']) {
    await page.goto(route); await expect(page.getByText('Chưa hỗ trợ', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nhận chuyến|báo giá|minh họa/ })).toHaveCount(0);
  }
});

test('test harness stays out of production', async ({ page }) => {
  await page.goto('/tests/harness/index.html'); await expect(page.getByRole('heading', { name: 'Không tìm thấy trang', exact: true })).toBeVisible();
});
