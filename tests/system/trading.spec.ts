import { expect, test, type Page } from '@playwright/test';
import { installMockApi, loginAs, testIds, useMenu } from './support/mock-api';

const lotId = '40000000-0000-4000-8000-000000000001';
const requestId = '50000000-0000-4000-8000-000000000001';

for (const initiator of ['FARMER', 'BUYER'] as const) test(`${initiator} initiates persisted trading through completion and two reviews`, async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const farmerContext = await browser.newContext({ baseURL }); const buyerContext = await browser.newContext({ baseURL });
  try {
    const farmer = await farmerContext.newPage(); const buyer = await buyerContext.newPage();
    const api = await installMockApi(farmer); await installMockApi(buyer, api.database);
    const errors: string[] = []; for (const page of [farmer, buyer]) page.on('pageerror', error => errors.push(error.message));
    await loginAs(farmer, 'FARMER'); await loginAs(buyer, 'BUYER');
    const sender = initiator === 'FARMER' ? farmer : buyer; const recipient = initiator === 'FARMER' ? buyer : farmer;
    const prefix = (page: Page) => page === farmer ? '/farmer' : '/buyer';
    if (initiator === 'FARMER') {
      await farmer.goto(`/farmer/matches?lotId=${lotId}`);
      api.failNextConnection();
      await farmer.getByRole('button', { name: 'Gửi đề nghị', exact: true }).click();
      await expect(farmer.getByRole('alert')).toContainText('Không gửi được lời mời');
      await expect(farmer).toHaveURL(/\/farmer\/matches/); expect(api.database.trade_connections).toHaveLength(0);
      await farmer.getByRole('button', { name: 'Gửi đề nghị', exact: true }).click();
    } else {
      await buyer.goto(`/buyer/lots?requestId=${requestId}`);
      await buyer.getByRole('button', { name: /Xem chi tiết/ }).first().click();
      await buyer.getByRole('button', { name: /Gửi lời mời kết nối/ }).click();
    }
    await expect(sender).toHaveURL(/\/invitations\?connectionId=/);
    const connection = api.database.trade_connections[0]; expect(connection.buy_request_id).toBe(requestId);
    await expect(sender.getByRole('button', { name: 'Hủy lời mời' })).toBeVisible();
    await sender.goto(`${prefix(sender)}/negotiations?connectionId=${connection.id}`);
    await expect(sender.getByRole('link', { name: 'Xem lời mời kết nối' })).toBeVisible();
    await expect(sender.getByLabel('Tin nhắn', { exact: true })).toHaveCount(0);
    await useMenu(recipient, 'Lời mời kết nối'); await recipient.getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await recipient.getByRole('link', { name: 'Mở hội thoại →' }).click();
    await expect(recipient).toHaveURL(new RegExp(`${prefix(recipient)}/negotiations\\?connectionId=${connection.id}`));
    // Both legacy URLs resolve to the real thread, including a page reload.
    for (const page of [farmer, buyer]) {
      await page.goto(`${prefix(page)}/chat?connectionId=${connection.id}`); await page.reload();
      await expect(page.getByLabel('Tin nhắn', { exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('connectionId')).toBe(connection.id);
    }
    await farmer.getByLabel('Tin nhắn', { exact: true }).fill('Chào Buyer, thống nhất thu hoạch.'); await farmer.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(farmer.getByLabel('Tin nhắn', { exact: true })).toHaveValue('');
    await buyer.reload(); await expect(buyer.locator('.chat-messages')).toContainText('Chào Buyer, thống nhất thu hoạch.');
    await buyer.getByLabel('Tin nhắn', { exact: true }).fill('Buyer đã nhận.'); await buyer.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(buyer.getByLabel('Tin nhắn', { exact: true })).toHaveValue('');
    await farmer.reload(); await expect(farmer.locator('.chat-messages')).toContainText('Buyer đã nhận.');
    const offer = async () => {
      await buyer.getByLabel('Giá đề nghị (VND/kg)').fill('65000'); await buyer.getByLabel('Khối lượng (tấn)').fill('2'); await buyer.getByLabel('Ngày lấy hàng').fill('2026-10-18');
      await buyer.getByRole('button', { name: 'Gửi đề nghị', exact: true }).click();
      await expect(buyer.getByRole('button', { name: 'Rút đề nghị', exact: true })).toBeVisible();
      await expect(buyer.getByRole('button', { name: 'Đồng ý', exact: true })).toHaveCount(0);
    };
    await offer(); await buyer.getByRole('button', { name: 'Rút đề nghị' }).click(); await expect(buyer.getByText(/Bạn gửi · Đã rút/)).toBeVisible();
    await offer(); await farmer.reload(); await farmer.getByRole('button', { name: 'Từ chối', exact: true }).click(); await expect(farmer.getByText(/Đối tác gửi · Đã từ chối/)).toBeVisible();
    await buyer.reload(); await offer(); await farmer.reload(); await farmer.getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await expect(farmer.getByText('Đã thống nhất', { exact: true })).toBeVisible();
    await farmer.getByRole('button', { name: 'Xác nhận đã hoàn tất giao dịch' }).click();
    await expect(farmer.getByRole('button', { name: 'Bạn đã xác nhận hoàn tất' })).toBeDisabled();
    await expect(farmer.getByRole('link', { name: 'Đánh giá giao dịch' })).toHaveCount(0);
    await buyer.goto('/buyer/reviews'); await expect(buyer.getByText('Chưa có giao dịch hoàn tất cần đánh giá.')).toBeVisible();
    await buyer.goto(`/buyer/negotiations?connectionId=${connection.id}`); await buyer.getByRole('button', { name: 'Xác nhận đã hoàn tất giao dịch' }).click();
    for (const page of [buyer, farmer]) {
      await page.reload(); await page.getByRole('link', { name: 'Đánh giá giao dịch', exact: true }).click();
      await page.getByRole('button', { name: '5 sao', exact: true }).click();
      await page.getByLabel('Nhận xét').fill(`${prefix(page)} giao dịch đúng hẹn`); await page.getByRole('button', { name: 'Lưu đánh giá' }).click();
      await expect(page.getByRole('tab',{name:/Đã đánh giá/})).toHaveAttribute('aria-selected','true'); await expect(page.getByText(`${prefix(page)} giao dịch đúng hẹn`, { exact: true })).toBeVisible();
      await page.reload(); await expect(page.getByText('Chưa có giao dịch hoàn tất cần đánh giá.')).toBeVisible();
    }
    expect(api.database.trade_reviews).toHaveLength(2); expect(api.database.trade_agreements[0].status).toBe('COMPLETED'); expect(errors).toEqual([]);
  } finally { await farmerContext.close(); await buyerContext.close(); }
});

test('cancelled/declined or unavailable connections never open a different thread', async ({ page }) => {
  const api = await installMockApi(page); await loginAs(page, 'FARMER');
  const row = { id: 'pending', buyer_id: testIds.BUYER, farmer_id: testIds.FARMER, initiated_by: testIds.FARMER, lot_id: lotId, lot_title: 'Pending lot', status: 'PENDING' };
  api.database.trade_connections.push(row, { ...row, id: 'accepted', status: 'ACCEPTED' });
  await page.goto('/farmer/invitations'); await page.getByRole('button', { name: 'Hủy lời mời' }).click(); await expect(page.getByText('Đã hủy', { exact: true })).toBeVisible();
  for (const id of ['pending', 'missing']) {
    await page.goto(`/farmer/chat?connectionId=${id}`); await expect(page.getByLabel('Tin nhắn', { exact: true })).toHaveCount(0);
    await expect(page.locator('main')).toContainText(id === 'missing' ? 'Không tìm thấy kết nối' : 'Chỉ trao đổi sau khi lời mời được đồng ý');
  }
  api.database.trade_connections.push({ ...row, id: 'incoming', initiated_by: testIds.BUYER, status: 'PENDING' });
  await page.goto('/farmer/invitations'); await page.getByRole('button', { name: 'Từ chối', exact: true }).click(); await expect(page.getByText('Đã từ chối', { exact: true })).toBeVisible();
});
