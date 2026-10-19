import { expect, test } from '@playwright/test';
import { pageInventory } from '../../src/app/ui-inventory';
import { installMockApi, loginAs, type TestRole } from './support/mock-api';
for (const entry of pageInventory.filter(e => e.role)) test(`${entry.id} requires a resolved session: ${entry.path}`, async ({ page }) => {
  await installMockApi(page); await page.goto(entry.path); await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
});
for (const path of ['/auth/login']) test(`legacy Auth path ${path} redirects to login`, async ({ page }) => {
  await installMockApi(page); await page.goto(path); await expect(page).toHaveURL(/\/login$/);
});
for (const path of ['/auth/register','/register']) test(`registration route ${path} survives refresh`, async ({ page }) => {
  await installMockApi(page); await page.goto(path); await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading',{name:'Đăng ký tài khoản'})).toBeVisible();await page.reload();
  await expect(page.getByRole('button',{name:'Tạo tài khoản'})).toBeVisible();
});
test('unknown routes and dev UI stay unavailable in production', async ({ page }) => {
  await page.goto('/dev/ui'); await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  await page.goto('/unknown'); await page.getByRole('link', { name: 'Quay lại trang đầu' }).click(); await expect(page).toHaveURL(/\/$/);
});
for (const width of [1440,768,390]) for (const role of ['FARMER','CARRIER','BUYER','ADMIN'] as TestRole[]) test(`${role} authenticated shell at ${width}px`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await installMockApi(page); await page.setViewportSize({ width, height: 960 }); await loginAs(page, role);
  await page.evaluate(() => document.fonts.ready);
  if (width === 390 && (role === 'FARMER' || role === 'CARRIER')) {
    const trigger = page.getByRole('button', { name: 'Mở menu' }); await trigger.click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    await page.keyboard.press('Tab'); expect(await dialog.evaluate(e => e.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});
