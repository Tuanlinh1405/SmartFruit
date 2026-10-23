import { expect, test } from '@playwright/test';
for (const width of [1440, 768, 390]) {
  test(`Farmer independent profile, lot, photo and matching UI at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 }); const requests: string[] = []; page.on('request', r => { if (r.url().includes('supabase.co')) requests.push(r.url()); });
    await page.goto('/tests/harness/index.html?panel=profile');
    await expect(page.getByLabel(/^Tên\ vườn/)).toBeVisible();
    const png = Buffer.from(await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#167843'; ctx.fillRect(0, 0, 2, 2); return canvas.toDataURL('image/png').split(',')[1]; }), 'base64');
    await page.getByLabel(/^Tên\ vườn/).fill('Vườn test'); await page.getByLabel(/^Tỉnh\ \/\ thành\ phố/).fill('Tiền Giang');
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click(); await expect(page.getByText('Đã lưu hồ sơ nhà vườn.')).toBeVisible();
    await page.getByRole('button', { name: 'Harness new', exact: true }).click();
    await page.getByLabel(/^Tên\ lô\ hàng/).fill('Lô ảnh test'); await page.getByRole('combobox',{name:/Loại quả/}).fill('sau rieng');await page.getByRole('option',{name:'Sầu riêng',exact:true}).click();
    await page.getByLabel(/^Khối\ lượng/).fill('1.250125'); await page.getByLabel(/^Giá\ chào\ \(đ\/kg\)/).fill('65000');
    await page.getByLabel(/^Bắt\ đầu\ thu\ hoạch/).fill('2026-10-15'); await page.getByLabel(/^Kết\ thúc\ thu\ hoạch/).fill('2026-10-20'); await page.getByLabel(/^Tỉnh\ \/\ thành\ phố/).fill('Tiền Giang');
    await page.getByLabel('Chọn ảnh lô hàng').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('img', { name: 'sample.png', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Đăng lô hàng', exact: true }).click(); await expect(page.getByText('Đã lưu lô đã đăng.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Ảnh lô 1', exact: true })).toBeVisible();
    await page.getByLabel('Thay ảnh 1').setInputFiles({ name: 'replace.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('button', { name: 'Xóa ảnh 1', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Xóa ảnh 1', exact: true }).click(); await expect(page.getByText('Chưa có ảnh đã lưu.')).toBeVisible();
    await page.getByLabel('Giá sàn riêng (đ/kg)').fill('60000'); await page.getByLabel('Ghi chú nội bộ').fill('PRIVATE TEST'); await page.getByRole('button', { name: 'Lưu thông tin riêng', exact: true }).click();
    await expect(page.getByText('Đã lưu thông tin riêng.')).toBeVisible(); await expect(page.getByRole('complementary', { name: 'Xem trước' })).not.toContainText('PRIVATE TEST');
    await page.getByRole('button', { name: 'Harness matching', exact: true }).click(); await page.getByLabel('Chọn lô cần matching').selectOption('40000000-0000-4000-8000-000000000001'); await expect(page.getByText(/86.0% phù hợp/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); expect(requests).toEqual([]);
  });
  test(`Carrier independent create/edit/active/delete UI at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 }); await page.goto('/tests/harness/index.html?panel=carrier');
    await page.getByLabel(/^Tên\ đơn\ vị\ vận\ tải/).fill('Nhà xe test'); await page.getByLabel(/^Tỉnh\ \/\ thành\ phố/).fill('Tiền Giang'); await page.getByRole('button', { name: 'Lưu hồ sơ nhà xe', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm xe', exact: true }).click(); let dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Biển\ số/).fill('60C-12345'); await dialog.getByLabel(/^Tải\ trọng/).fill('5'); await dialog.getByLabel('Loại xe').selectOption('REFRIGERATED'); await dialog.getByLabel('Nhiệt độ thấp nhất (°C)').fill('0'); await dialog.getByLabel('Nhiệt độ cao nhất (°C)').fill('4'); await dialog.getByRole('button', { name: 'Lưu xe', exact: true }).click();
    await expect(dialog).toHaveCount(0); await page.getByRole('button', { name: 'Sửa 60C-12345', exact: true }).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('Loại xe').selectOption('ENCLOSED'); await expect(dialog.getByText(/Đã bỏ khoảng nhiệt độ/)).toBeVisible(); await dialog.getByRole('button', { name: 'Lưu xe', exact: true }).click();
    await page.getByRole('button', { name: 'Ngừng 60C-12345', exact: true }).click(); await expect(page.getByRole('button', { name: 'Kích hoạt 60C-12345', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Xóa 60C-12345', exact: true }).click(); await page.getByRole('button', { name: 'Xác nhận xóa xe', exact: true }).click(); await expect(page.getByText('Không tìm thấy kết quả')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
