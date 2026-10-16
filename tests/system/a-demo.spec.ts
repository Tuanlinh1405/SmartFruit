import { expect, test } from '@playwright/test';
import { installMockApi, loginAs, logout } from './support/mock-api';
test.beforeEach(async ({ page }, info) => { await installMockApi(page); await loginAs(page, info.title.toLowerCase().includes('/carrier/') || info.title.startsWith('carrier ') ? 'CARRIER' : 'FARMER'); });
const pages = ['/farmer/dashboard', '/farmer/transport', '/farmer/chat', '/farmer/reviews', '/farmer/prices', '/farmer/weather', '/farmer/map', '/farmer/notifications', '/carrier/dashboard', '/carrier/requests', '/carrier/tracking', '/carrier/reviews'];
for (const width of [1440, 768, 390]) for (const route of pages) test(`A demo responsive ${route} at ${width}`, async ({ page }) => {
  const errors: string[] = []; const remote: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.url().includes('supabase.co')) remote.push(r.url()); });
  await page.setViewportSize({ width, height: 960 }); await page.goto(route); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await expect(page.getByText('Dữ liệu minh họa; thao tác chỉ thay đổi trạng thái local, không tạo giao dịch thật.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); expect(errors).toEqual([]); expect(remote).toEqual([]);
});
test('Farmer transport → Carrier quotation → tracking isolates demo state across accounts', async ({ page }) => {
  await page.goto('/farmer/transport'); await page.getByRole('button', { name: 'Tìm xe minh họa' }).click(); await expect(page.getByRole('alert')).toContainText('Nhập đủ');
  await page.getByLabel(/^Điểm\ nhận/).fill('Vườn test Tiền Giang'); await page.getByLabel(/^Điểm\ giao/).fill('Chợ test TP.HCM'); await page.getByLabel(/^Khối\ lượng\ \(tấn\)/).fill('5'); await page.getByLabel(/^Cước\ đề\ xuất\ \(đ\)/).fill('2500000'); await page.getByLabel(/^Giờ\ nhận\ hàng/).fill('2026-10-20T08:00');
  await page.getByRole('button', { name: 'Tìm xe minh họa' }).click(); await page.getByRole('button', { name: 'Chọn Xe thùng kín 5 tấn' }).click(); await expect(page.getByRole('dialog')).toContainText('Vườn test Tiền Giang'); await page.keyboard.press('Escape');
  await logout(page); await loginAs(page, 'CARRIER'); await page.getByRole('link', { name: 'Yêu cầu vận chuyển', exact: true }).click();
  await page.getByLabel('Tìm tuyến').fill('Vườn test'); await expect(page.getByText('Không có yêu cầu phù hợp', { exact: true })).toBeVisible();
  await page.getByLabel('Tìm tuyến').fill(''); await page.getByRole('button', { name: 'Chi tiết / báo giá' }).first().click(); await page.getByRole('dialog').getByLabel('Chọn xe').selectOption('vehicle-demo-1');
  await page.getByRole('button', { name: 'Nhận chuyến minh họa', exact: true }).click(); await expect(page.getByText(/Đã nhận chuyến · Minh họa/)).toBeVisible();
  await page.getByRole('link', { name: 'Theo dõi chuyến', exact: true }).click(); await page.getByLabel('Chọn yêu cầu theo dõi').selectOption({ index: 1 });
  await expect(page.getByText('Nhận chuyến minh họa · Đã đạt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đặt lại minh họa', exact: true }).click(); await expect(page.getByText('Chưa chọn chuyến', { exact: true })).toBeVisible();
});
test('chat mobile list/conversation/detail, local message, confirm and reset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 960 }); await page.goto('/farmer/chat'); await page.getByRole('button', { name: 'Vựa An Phú', exact: true }).click();
  await page.getByLabel('Tin nhắn minh họa').fill('Trao đổi giờ thu hoạch'); await page.getByRole('button', { name: 'Gửi minh họa', exact: true }).click(); await expect(page.getByRole('region', { name: 'Tin nhắn', exact: true })).toContainText('Trao đổi giờ thu hoạch');
  await page.getByRole('button', { name: 'Thông tin trao đổi', exact: true }).click(); await page.getByRole('button', { name: 'Xác nhận đàm phán minh họa', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận minh họa', exact: true }).click(); await expect(page.getByText('Đã xác nhận minh họa.')).toBeVisible();
  await page.getByRole('button', { name: 'Đặt lại minh họa', exact: true }).click(); await expect(page.getByRole('button', { name: 'Vựa An Phú', exact: true })).toBeVisible();
});
for (const role of ['farmer', 'carrier']) test(`${role} reviews empty, validation and submit`, async ({ page }) => {
  await page.goto(`/${role}/reviews`); await page.getByLabel('Nhóm đánh giá').selectOption('sent'); await expect(page.getByText('Chưa có đánh giá', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gửi đánh giá minh họa', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Chọn từ'); await page.getByLabel('Số sao').selectOption('5'); await page.getByLabel('Nhận xét').fill('Đúng hẹn'); await page.getByRole('button', { name: 'Gửi đánh giá minh họa', exact: true }).click(); await expect(page.getByText('Đúng hẹn', { exact: true })).toBeVisible();
});
test('prices/weather/map fallback and notifications interactions', async ({ page }) => {
  await page.goto('/farmer/prices'); await page.getByLabel('Loại quả tham khảo').selectOption('Thanh long'); await expect(page.getByText('Chưa có giá minh họa')).toBeVisible();
  await page.goto('/farmer/weather'); await page.getByLabel('Tỉnh xem thời tiết').selectOption('Đồng Tháp'); await expect(page.getByText('Chưa có dữ liệu minh họa tại khu vực')).toBeVisible();
  await page.goto('/farmer/map'); await page.getByRole('button', { name: 'Chỉ xem danh sách' }).click(); await expect(page.getByRole('img', { name: 'Sơ đồ khu vực minh họa' })).toHaveCount(0); await page.getByLabel('Khu vực', { exact: true }).selectOption('Đồng Tháp'); await expect(page.getByText('Không có đối tác minh họa phù hợp')).toBeVisible();
  await page.goto('/farmer/notifications'); const open = page.getByRole('button', { name: 'Mở thông báo', exact: true }); await open.click(); await page.keyboard.press('Escape'); await expect(open).toBeFocused(); await expect(page.getByText('Đã xem · Minh họa', { exact: true })).toBeVisible();
});
test('test harness stays out of production', async ({ page }) => {
  await page.goto('/tests/harness/index.html'); await expect(page.getByRole('heading', { name: 'Không tìm thấy trang', exact: true })).toBeVisible();
});
