import { expect, test, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/supabase', () => ({ supabase: { functions: { invoke } } }));
import { askFarmer } from './api';
const input = { crop: 'DURIAN', topic: 'DISEASE', growthStage: 'UNKNOWN', question: 'Câu hỏi mẫu' } as const;
test('sends only whitelisted input and propagates cancellation', async () => {
  invoke.mockResolvedValue({ data: { answer: 'Tham khảo', sources: [], followUpQuestions: [], requestId: 'r' }, error: null });
  const signal = new AbortController().signal; await askFarmer(input, signal);
  expect(invoke).toHaveBeenLastCalledWith('farmer-chat', { body: input, signal });
});
test('HTTP error envelopes use safe messages, not raw provider text', async () => {
  invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: { code: 'QUOTA_EXCEEDED', message: 'secret' }, requestId: 'r' }), { status: 429 }) } });
  await expect(askFarmer(input, new AbortController().signal)).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED', requestId: 'r', message: 'Trợ lý đã chạm hạn mức OpenRouter miễn phí. Vui lòng thử lại sau.' });
});
test('invalid response is not shown as a successful answer', async () => {
  invoke.mockResolvedValue({ data: { answer: 'Bad', sources: [{ id: 'x', title: 'evil', url: 'javascript:bad()' }], followUpQuestions: [], requestId: 'r' }, error: null });
  await expect(askFarmer(input, new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
