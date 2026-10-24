import { expect, test } from '@playwright/test';

test('production app opens and refreshes without JavaScript errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Thuận mua. Vừa bán. Vận chuyển tối ưu.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /^Mở khu vực/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Thuận mua. Vừa bán. Vận chuyển tối ưu.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('landing stays readable across desktop and mobile and links to public pages', async ({ page }, testInfo) => {
  await page.goto('/');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Một nền tảng, ba vai trò' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Điều tạo nên sự khác biệt' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    if (width === 1440 || width === 390) {
      await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
    }
  }
  await page.getByRole('link', { name: 'Đăng ký tài khoản ngay', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Chính sách nền tảng' }).click();
  await expect(page).toHaveURL(/\/policy$/);
});
