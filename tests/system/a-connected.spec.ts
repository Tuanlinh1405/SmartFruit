import { expect, test } from '@playwright/test';
import { installMockApi, loginAs, logout, useMenu } from './support/mock-api';

test('unused lot is deleted after preparation and stays gone after reload', async ({ page }) => {
  const api = await installMockApi(page); await loginAs(page, 'FARMER');
  api.database.farmer_profiles.push({ user_id: api.database.lots[0].farmer_id, farm_name: 'Delete test farm', province: 'Đồng Nai' });
  const lotId = String(api.database.lots[0].id);
  await page.goto(`/farmer/lots/${lotId}`);
  await page.getByRole('button', { name: 'Xóa lô', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page).toHaveURL(/\/farmer\/lots$/);
  expect(api.database.lots.some(row => row.id === lotId)).toBe(false);
  expect(api.calls.filter(call => ['prepare_lot_deletion', 'delete_empty_lot'].includes(call.table)).map(call => call.table))
    .toEqual(['prepare_lot_deletion', 'delete_empty_lot']);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Danh sách lô hàng' })).toBeVisible();
});

test('missing deletion RPC keeps the dialog and lot, and explains the server problem', async ({ page }) => {
  const api = await installMockApi(page); await loginAs(page, 'FARMER');
  await page.route('**/rest/v1/rpc/prepare_lot_deletion', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Function missing' }) }));
  await page.goto(`/farmer/lots/${api.database.lots[0].id}`);
  await page.getByRole('button', { name: 'Xóa lô', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Máy chủ chưa cập nhật');
  expect(api.database.lots).toHaveLength(1); expect(api.database.lots[0].status).toBe('PUBLISHED');
  expect(api.calls.some(call => call.table === 'delete_empty_lot')).toBe(false);
});
for (const width of [1440,768,390]) test(`Farmer production routes with mocked HTTP: profile → publish retry → private → matching at ${width}`, async ({ page }) => {
  const api = await installMockApi(page); await page.setViewportSize({ width, height: 960 }); await loginAs(page, 'FARMER');
  await page.goto('/farmer/lots'); await page.getByRole('button', { name: 'Hoàn thiện hồ sơ nhà vườn' }).click(); await expect(page).toHaveURL(/\/farmer\/profile$/);
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click(); expect(api.calls.filter(c => c.method === 'POST')).toHaveLength(0);
  await page.getByLabel(/^Tên vườn/).fill('Vườn UI chính'); await page.getByLabel(/^Tỉnh \/ thành phố/).fill('Tiền Giang'); await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await expect(page.getByText('Đã lưu hồ sơ nhà vườn.')).toBeVisible(); await useMenu(page, 'Danh sách lô hàng'); await page.getByRole('button', { name: 'Tạo lô hàng', exact: true }).click();
  await page.getByLabel(/^Tên lô hàng/).fill('Lô UI chính'); await page.getByLabel(/^Loại quả/).selectOption('fruit-1'); await page.getByLabel(/^Khối lượng/).fill('1');
  await page.getByLabel(/^Giá chào/).fill('65000'); await page.getByLabel(/^Bắt đầu thu hoạch/).fill('2026-10-15'); await page.getByLabel(/^Kết thúc thu hoạch/).fill('2026-10-20'); await page.getByLabel(/^Tỉnh \/ thành phố/).fill('Tiền Giang');
  api.failNextPublish(); await page.getByRole('button', { name: 'Đăng lô hàng', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Đã lưu nháp nhưng chưa đăng');
  await page.getByRole('button', { name: 'Đăng lô hàng', exact: true }).click(); await expect(page).toHaveURL(/\/farmer\/lots\/[^/]+\/edit$/);
  expect(api.calls.filter(c => c.method === 'POST' && c.table === 'lots')).toHaveLength(1);
  await page.getByLabel('Giá sàn riêng (đ/kg)').fill('60000'); await page.getByLabel('Ghi chú nội bộ').fill('PRIVATE UI TEST'); await page.getByRole('button', { name: 'Lưu thông tin riêng', exact: true }).click();
  await expect(page.getByText('Đã lưu thông tin riêng.')).toBeVisible(); await expect(page.getByRole('complementary', { name: 'Xem trước' })).not.toContainText('PRIVATE UI TEST');
  await page.reload(); await expect(page.getByLabel('Giá sàn riêng (đ/kg)')).toHaveValue('60000');
  await page.getByRole('button', { name: 'Xem chi tiết lô' }).click(); const detailUrl = page.url();
  await page.getByRole('button', { name: 'Tìm xe minh họa' }).click(); await expect(page.getByText(/Ngữ cảnh công khai: Lô UI chính/)).toBeVisible(); await expect(page.getByLabel(/^Khối lượng/)).toHaveValue('1'); await expect(page.locator('main')).not.toContainText('PRIVATE UI TEST');
  await page.goto(detailUrl); await page.getByRole('button', { name: 'Tìm người mua phù hợp' }).click(); await expect(page.getByText('Buyer công khai test')).toBeVisible(); await expect(page.getByText(/Phù hợp 58%/)).toBeVisible();
  await page.getByRole('button', { name: 'Gửi lời mời kết nối' }).click(); await expect(page).toHaveURL(/\/farmer\/invitations/); await expect(page.locator('main')).not.toContainText('PRIVATE UI TEST');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(detailUrl); await page.getByRole('button', { name: 'Đóng lô', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click(); await expect(page.getByRole('button', { name: 'Tìm người mua phù hợp' })).toBeDisabled();
  await page.getByRole('button', { name: 'Xóa lô', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Lô đã có lịch sử kết nối'); await expect(page).toHaveURL(detailUrl);
});
for (const width of [1440,768,390]) test(`Carrier production routes with mocked HTTP: profile and vehicle CRUD at ${width}`, async ({ page }) => {
  await installMockApi(page); await page.setViewportSize({ width, height: 960 }); await loginAs(page, 'CARRIER'); await page.goto('/carrier/vehicles');
  await page.getByLabel(/^Tên đơn vị vận tải/).fill('Nhà xe UI chính'); await page.getByLabel(/^Tỉnh \/ thành phố/).fill('Tiền Giang'); await page.getByRole('button', { name: 'Lưu hồ sơ nhà xe', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm xe', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel(/^Biển số/).fill('60C-77777'); await dialog.getByLabel(/^Tải trọng/).fill('5'); await dialog.getByRole('button', { name: 'Lưu xe', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.reload(); await page.getByRole('button', { name: 'Ngừng 60C-77777', exact: true }).click(); await expect(page.getByRole('button', { name: 'Kích hoạt 60C-77777', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sửa 60C-77777', exact: true }).click(); await page.getByRole('dialog').getByLabel(/^Tải trọng/).fill('6'); await page.getByRole('dialog').getByRole('button', { name: 'Lưu xe', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa 60C-77777', exact: true }).click(); await page.getByRole('button', { name: 'Xác nhận xóa xe', exact: true }).click(); await expect(page.getByText('Không tìm thấy kết quả')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('direct wrong-role access is blocked and logout removes access', async ({ page }) => {
  await installMockApi(page); await loginAs(page, 'CARRIER'); await page.goto('/farmer/lots/new'); await expect(page).toHaveURL(/\/403$/); await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible();
  await page.goto('/carrier/dashboard'); await logout(page); await page.goto('/carrier/vehicles'); await expect(page).toHaveURL(/\/login$/);
});

for (const role of ['FARMER', 'BUYER'] as const) test(`email login uses the existing ${role} account and role routing`, async ({ page }) => {
  await installMockApi(page); await page.goto('/login');
  await page.getByLabel(/^Email hoặc số điện thoại/).fill(`${role.toLowerCase()}@example.test`); await page.getByLabel(/^Mật khẩu/).fill('test-only-password');
  const request = page.waitForRequest(r => r.url().includes('/auth/v1/token') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const body = (await request).postDataJSON(); expect(body.email).toBe(`${role.toLowerCase()}@example.test`); expect(body.phone).toBeUndefined();
  await expect(page).toHaveURL(role === 'FARMER' ? /\/farmer\/dashboard$/ : /\/buyer\/dashboard$/); await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
