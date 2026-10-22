import { expect, test } from '@playwright/test';
import { installMockApi, loginAs, useMenu, testIds } from './support/mock-api';
import { profileToForm, parseProfileForm } from '../../src/features/farmer/profile/farmer-profile.model';

for (const role of ['FARMER', 'CARRIER', 'BUYER'] as const) {
  for (const width of [1440, 1024, 851, 850, 768, 631, 630, 390, 320]) {
    test(`${role} shared workspace at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 960 });
      await installMockApi(page); await loginAs(page, role);
      await expect(role === 'FARMER' ? page.getByRole('region',{name:'Thống kê lô hàng',exact:true}) : page.locator('.stat-card').first()).toBeVisible();
      const shell = page.locator('.workspace-shell');
      await expect(shell).toHaveCSS('background-color', 'rgb(244, 246, 245)');
      await expect(page.locator('.workspace-topbar')).toHaveCSS('height', '56px');
      await expect(page.locator('h1')).toHaveCSS('font-family', await shell.evaluate(e => getComputedStyle(e).fontFamily));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width < 768) {
        await expect(page.locator('.workspace-sidebar')).toBeHidden();
        const trigger = page.getByRole('button', { name: 'Mở menu' });
        await trigger.click();
        const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
        await expect(dialog.locator('.workspace-mobile-navigation')).toHaveCSS('background-image', 'none');
        await page.keyboard.press('Tab'); expect(await dialog.evaluate(e => e.contains(document.activeElement))).toBe(true);
        await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
        await useMenu(page, role === 'BUYER' ? 'Yêu cầu thu mua' : role === 'FARMER' ? 'Danh sách lô hàng' : 'Hồ sơ & danh sách xe');
        await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}/${role === 'BUYER' ? 'requests' : role === 'FARMER' ? 'lots' : 'vehicles'}$`));
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.goto(role === 'BUYER' ? '/buyer' : `/${role.toLowerCase()}/dashboard`); await expect(role === 'FARMER' ? page.getByRole('region',{name:'Thống kê lô hàng',exact:true}) : page.locator('.stat-card').first()).toBeVisible();
      } else {
        await expect(page.locator('.workspace-sidebar')).toBeVisible();
        await expect(page.locator('.workspace-sidebar')).toHaveCSS('width', '240px');
      }
      if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`${role.toLowerCase()}-${width}.png`), fullPage: true });
    });
  }
}

const farmerPages = ['profile', 'lots', 'lots/new', 'lots/40000000-0000-4000-8000-000000000001', 'lots/40000000-0000-4000-8000-000000000001/edit', 'matches', 'transport', 'chat', 'reviews', 'prices', 'weather', 'map', 'notifications'];
const carrierPages = ['vehicles', 'requests', 'tracking', 'reviews'];
const buyerPages = ['profile', 'requests', 'requests/new', 'requests/50000000-0000-4000-8000-000000000001/edit', 'lots', 'invitations', 'negotiations', 'transport', 'reviews', 'policy'];
for (const width of [1440, 390, 320]) for (const role of ['FARMER', 'CARRIER', 'BUYER'] as const) {
  test(`${role} all feature pages fit at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 960 });
    const api = await installMockApi(page);
    const form = profileToForm(); form.farm_name = 'Vườn giao diện'; form.province = 'Tiền Giang';
    api.database.farmer_profiles.push({ ...parseProfileForm(form).data, user_id: testIds.FARMER });
    api.database.carrier_profiles.push({ user_id: testIds.CARRIER, company_name: 'Nhà xe giao diện', province: 'Tiền Giang', address: null, service_provinces: [] });
    api.database.vehicles.push({ id: 'vehicle-ui-1', carrier_id: testIds.CARRIER, license_plate: '60C-12345', capacity_kg: 5000, vehicle_type: 'ENCLOSED', provinces: ['Tiền Giang'], active: true });
    api.database.buyer_profiles = [{ user_id: testIds.BUYER, organization_name: 'Thu mua giao diện', province: 'Tiền Giang', address: null }];
    await loginAs(page, role);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    for (const slug of role === 'FARMER' ? farmerPages : role === 'CARRIER' ? carrierPages : buyerPages) {
      await page.goto(`/${role.toLowerCase()}/${slug}`);
      await expect(page.locator('main').getByRole('heading').first()).toBeVisible();
      if (slug === 'lots/new') await expect(page.getByLabel(/^Tên lô hàng/)).toBeVisible();
      if (slug === 'vehicles') await expect(page.getByRole('button', { name: 'Thêm xe', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${role}/${slug}`).toBe(true);
      if ((width === 1440 || width === 390) && (slug === 'lots/new' || slug === 'vehicles')) await page.screenshot({ path: info.outputPath(`${role.toLowerCase()}-form-${width}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test('carrier transport shows real request workspace without fabricated bookings', async ({ page }) => {
  await installMockApi(page); await loginAs(page, 'CARRIER'); await page.goto('/carrier/requests');
  await expect(page.getByRole('heading',{name:'Yêu cầu vận chuyển',exact:true})).toBeVisible();
  await expect(page.getByText('Chưa có yêu cầu vận chuyển.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chi tiết / báo giá' })).toHaveCount(0);
});

for (const width of [1440, 390, 320]) test(`public and admin pages fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 960 }); await installMockApi(page);
  for (const path of ['/', '/login', '/403', '/404']) {
    await page.goto(path); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  await loginAs(page, 'ADMIN');
  for (const slug of ['', '/buyers', '/farmers', '/carriers', '/marketplace', '/connections', '/transport', '/settings']) {
    await page.goto(`/admin${slug}`); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `/admin${slug}`).toBe(true);
  }
});
