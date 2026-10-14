import { expect, test } from '@playwright/test';

test('production app opens and refreshes without JavaScript errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'LogStar' })).toBeVisible();
  await expect(page.getByText('Nền dự án đã sẵn sàng.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'LogStar' })).toBeVisible();
  expect(errors).toEqual([]);
});
