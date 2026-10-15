import { expect, test } from '@playwright/test';

test('production app opens and refreshes without JavaScript errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cùng một phong cách, bốn khu vực' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Mở khu vực/ })).toHaveCount(4);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cùng một phong cách, bốn khu vực' })).toBeVisible();
  expect(errors).toEqual([]);
});
