import { expect, test } from '@playwright/test';

test('production app opens and refreshes without JavaScript errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nhà vườn, thu mua và vận tải' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /^Mở khu vực/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nhà vườn, thu mua và vận tải' })).toBeVisible();
  expect(errors).toEqual([]);
});
