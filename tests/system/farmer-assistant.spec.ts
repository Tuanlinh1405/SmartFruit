import { expect, test, type Page } from '@playwright/test';
import { installMockApi, loginAs, logout, useMenu } from './support/mock-api';
import { createChatHandler } from '../../supabase/functions/farmer-chat/handler';

async function assistantApi(page: Page, options: { status?: number; delay?: Promise<void> } = {}) {
  const requests: Record<string, unknown>[] = []; const prompts: Record<string, unknown>[] = [];
  const handle = createChatHandler({
    authenticate: async () => ({ role: 'FARMER' }), apiKey: 'test-only-openrouter', allowedOrigins: ['http://127.0.0.1:4175'],
    fetcher: async (_url, init) => {
      const body = JSON.parse(String(init?.body)); prompts.push(body);
      await options.delay;
      if (options.status) return new Response('private provider details', { status: options.status });
      const payload = JSON.parse(body.messages[1].content);
      return new Response(JSON.stringify({ model: 'test/model:free', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        answer: `Nội dung tham khảo cho ${payload.context.crop}. <script>window.chatInjected=true</script>`,
        sourceIds: [payload.knowledge[0].id], followUpQuestions: ['Bạn có thể bổ sung dấu hiệu trong tình huống mẫu không?'],
      }) } }], usage: { prompt_tokens: 1500, completion_tokens: 150 } }));
    },
  });
  await page.route('http://127.0.0.1:54321/functions/v1/farmer-chat', async route => {
    const incoming = route.request();
    const response = await handle(new Request(incoming.url(), { method: incoming.method(), headers: incoming.headers(), ...(incoming.method() === 'POST' ? { body: incoming.postData() } : {}) }));
    if (incoming.method() === 'POST') requests.push(incoming.postDataJSON());
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers.entries()), body: await response.text() });
  });
  return { requests, prompts };
}

test('Farmer assistant opens after refreshing a trailing-slash dashboard URL', async ({ page }) => {
  await installMockApi(page); const api = await assistantApi(page); await loginAs(page, 'FARMER');
  await page.goto('/farmer/dashboard/?from=refresh'); await page.reload();
  await page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Trợ lý nhà vườn', exact: true });
  await expect(panel).toBeVisible();
  await panel.getByLabel('Câu hỏi cho trợ lý').fill('Tình huống mẫu: dấu hiệu nào cần lưu ý?');
  await panel.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(panel.locator('.assistant-answer')).toContainText('Nội dung tham khảo cho DURIAN.');
  expect(api.requests).toHaveLength(1);
});

for (const width of [1440, 768, 390, 320]) test(`Farmer assistant at ${width}px: single prompt, clean answer, focus and reset`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 }); await installMockApi(page); const api = await assistantApi(page); await loginAs(page, 'FARMER');
  const entry = page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }); await expect(entry).toBeVisible();
  expect(api.requests).toHaveLength(0); await entry.click();
  const panel = page.getByRole('dialog', { name: 'Trợ lý nhà vườn', exact: true }); await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('width', width <= 850 ? `${width}px` : '520px');
  await expect(panel).not.toContainText('Không nhập thông tin cá nhân');
  if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`assistant-welcome-${width}.png`) });
  await panel.getByRole('button', { name: 'Dấu hiệu bệnh thường gặp', exact: true }).click(); expect(api.requests).toHaveLength(0);
  await panel.getByLabel('Câu hỏi cho trợ lý').fill('Tình huống mẫu: có dấu hiệu nào cần lưu ý?');
  await panel.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(panel.getByText('Nội dung tham khảo cho DURIAN.', { exact: false })).toBeVisible();
  await expect(panel.getByText('Nguồn tham khảo', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('link')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { chatInjected?: boolean }).chatInjected)).toBeUndefined();
  await panel.getByRole('button', { name: 'Bổ sung câu hỏi', exact: true }).click(); await expect(panel.getByLabel('Câu hỏi cho trợ lý')).toHaveValue('Tình huống mẫu: có dấu hiệu nào cần lưu ý?');
  await panel.getByLabel('Cây trồng', { exact: true }).selectOption('JACKFRUIT'); await panel.getByLabel('Chủ đề', { exact: true }).selectOption('GRADING');
  await panel.getByLabel('Câu hỏi cho trợ lý').fill('Tình huống mẫu: phân loại mít dựa vào đâu?'); await panel.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(panel.getByText('Nội dung tham khảo cho JACKFRUIT.', { exact: false })).toBeVisible();
  expect(api.requests).toHaveLength(2); expect(Object.keys(api.requests[1]).sort()).toEqual(['crop', 'growthStage', 'question', 'topic']);
  const prompt = api.prompts[1] as { messages: { content: string }[] }; expect(prompt.messages).toHaveLength(2);
  expect(JSON.stringify(prompt)).not.toContain('Tình huống mẫu: có dấu hiệu nào cần lưu ý?'); expect(JSON.stringify(prompt)).not.toContain('Nội dung tham khảo cho DURIAN'); expect(prompt).not.toHaveProperty('tools');
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Tab'); expect(await panel.evaluate(element => element.contains(document.activeElement))).toBe(true);
  if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`assistant-${width}.png`) });
  await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0); await expect(entry).toBeFocused();
  await entry.click(); await expect(panel.getByText('Nội dung tham khảo cho JACKFRUIT.', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape'); await useMenu(page, 'Danh sách lô hàng'); await expect(page).toHaveURL(/\/farmer\/lots$/); await expect(panel).toHaveCount(0);
  await useMenu(page, 'Tổng quan'); await page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }).click(); await expect(panel.getByText('Nội dung tham khảo cho JACKFRUIT.', { exact: false })).toBeVisible();
  // SPA navigation preserves the provider; a reload deliberately clears the transcript.
  await page.reload(); await page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }).click(); await expect(panel.getByText('Nội dung tham khảo cho JACKFRUIT.', { exact: false })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Xóa cuộc trò chuyện', exact: true }).click(); await expect(panel.getByText('Bạn muốn tìm hiểu điều gì?')).toBeVisible();
});

test('quota retains composer without retries; logout/login clears session', async ({ page }) => {
  await installMockApi(page); const api = await assistantApi(page, { status: 429 }); await loginAs(page, 'FARMER');
  await page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }).click(); const panel = page.getByRole('dialog');
  await panel.getByLabel('Câu hỏi cho trợ lý').fill('Tình huống mẫu bị lỗi quota'); await panel.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Đã chạm hạn mức'); await expect(panel.getByLabel('Câu hỏi cho trợ lý')).toHaveValue('Tình huống mẫu bị lỗi quota'); expect(api.requests).toHaveLength(1);
  await page.keyboard.press('Escape'); await logout(page); await loginAs(page, 'FARMER'); await page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }).click();
  await expect(page.getByLabel('Câu hỏi cho trợ lý')).toHaveValue(''); await expect(page.getByRole('alert')).toHaveCount(0);
});

test('compact mobile layout keeps composer visible and supports keyboard sending', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await installMockApi(page); const api = await assistantApi(page); await loginAs(page, 'FARMER');
  await page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Trợ lý nhà vườn', exact: true });
  await panel.locator('summary').click();
  await panel.getByLabel('Giai đoạn cây (tùy chọn)', { exact: true }).selectOption('FLOWERING');
  await panel.locator('summary').click();
  const input = panel.getByLabel('Câu hỏi cho trợ lý');
  await input.fill('Sầu riêng đang ra hoa.');
  await input.press('Shift+Enter');
  await input.pressSequentially('Can luu y gi?');
  expect(api.requests).toHaveLength(0);
  await input.press('Enter');
  await expect(panel.locator('.assistant-answer')).toContainText('Nội dung tham khảo cho DURIAN.');
  expect(api.requests).toHaveLength(1);
  expect(api.requests[0].growthStage).toBe('FLOWERING');
  expect(api.requests[0].question).toContain('\n');
  const bounds = await panel.locator('.assistant-input-box').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
  expect(await panel.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  await page.screenshot({ path: info.outputPath('assistant-compact-mobile.png') });
});
for (const role of ['CARRIER', 'BUYER', 'ADMIN'] as const) test(`${role} has no Farmer assistant entry`, async ({ page }) => {
  await installMockApi(page); await loginAs(page, role); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await expect(page.getByRole('button', { name: 'Hỏi trợ lý', exact: true })).toHaveCount(0);
});
test('pending request cannot be submitted twice', async ({ page }) => {
  let done!: () => void; const delay = new Promise<void>(resolve => { done = resolve; });
  await installMockApi(page); const api = await assistantApi(page, { delay }); await loginAs(page, 'FARMER'); await page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }).click();
  await page.getByLabel('Câu hỏi cho trợ lý').fill('Tình huống mẫu đang chờ'); const send = page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }); await send.click();
  await expect(send).toBeDisabled(); await expect(page.getByText('Trợ lý đang trả lời…')).toBeVisible(); expect(api.prompts).toHaveLength(1); done();
  await expect(page.getByText('Trợ lý đang trả lời…')).toHaveCount(0); await expect(page.getByLabel('Câu hỏi cho trợ lý')).toBeEnabled();
  await page.getByLabel('Câu hỏi cho trợ lý').fill('Câu hỏi mẫu tiếp theo'); await expect(send).toBeEnabled(); expect(api.prompts).toHaveLength(1);
});
