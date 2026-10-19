import { describe, expect, test, vi } from 'vitest';
import { parseChatInput, type FarmerChatInput } from './contract';
import { buildGeminiRequest, generateAnswer, knowledge } from '../../../../supabase/functions/farmer-chat/service';
import { createChatHandler, type ChatHandlerOptions } from '../../../../supabase/functions/farmer-chat/handler';

const input: FarmerChatInput = { crop: 'DURIAN', topic: 'DISEASE', growthStage: 'FLOWERING', question: 'Tình huống mẫu: mưa nhiều cần lưu ý dấu hiệu nào?' };
const id = knowledge.find(k => k.crop === input.crop && k.topic === input.topic)!.id;
function provider(value: unknown = { answer: 'Thông tin tham khảo.', sourceIds: [id], followUpQuestions: [] }, finishReason = 'STOP') {
  return new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 100, thoughtsTokenCount: 10 } }));
}
function setup(overrides: Partial<ChatHandlerOptions> = {}) {
  const fetcher = vi.fn(async () => provider()); const authenticate = vi.fn(async () => ({ role: 'FARMER' })); const log = vi.fn();
  const handle = createChatHandler({ authenticate, apiKey: 'test-only-key', allowedOrigins: ['https://app.example.test'], fetcher, log, ...overrides });
  const request = (body: unknown = input, headers: Record<string, string> = {}) => handle(new Request('https://edge.example.test/farmer-chat', {
    method: 'POST', headers: { Origin: 'https://app.example.test', Authorization: 'Bearer test-jwt', ...headers }, body: JSON.stringify(body),
  }));
  return { request, handle, fetcher, authenticate, log };
}

test('knowledge covers three crops/two topics, distinct IDs and disclosed provenance', () => {
  expect(knowledge).toHaveLength(27); expect(new Set(knowledge.map(k => k.id)).size).toBe(27);
  for (const crop of ['DURIAN', 'JACKFRUIT', 'DRAGON_FRUIT']) for (const topic of ['DISEASE', 'GRADING']) {
    const rows = knowledge.filter(k => k.crop === crop && k.topic === topic);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) { expect(row.content).toContain('tham khảo'); expect(row.sourceUrl).toMatch(/^https:\/\//); expect(row.version).toBeTruthy(); }
  }
});
test('single-turn request includes only matching knowledge and allowed context, no tools/history', () => {
  const request = buildGeminiRequest(input); expect(request.contents).toHaveLength(1); expect(request).not.toHaveProperty('tools');
  const payload = JSON.parse(request.contents[0].parts[0].text);
  expect(Object.keys(payload).sort()).toEqual(['context', 'knowledge', 'question']);
  expect(payload.context).toEqual({ crop: 'DURIAN', topic: 'DISEASE', growthStage: 'FLOWERING' });
  expect(payload.knowledge).toHaveLength(5); expect(payload.knowledge.every((k: { crop: string; topic: string }) => k.crop === 'DURIAN' && k.topic === 'DISEASE')).toBe(true);
  expect(request.generationConfig.maxOutputTokens).toBe(1024); expect(request.generationConfig.thinkingConfig.thinkingLevel).toBe('MINIMAL');
});

describe('access and input gates run before inference', () => {
  test('missing/invalid identity or wrong role cannot reach Gemini', async () => {
    const missing = setup(); expect((await missing.request(input, { Authorization: '' })).status).toBe(401); expect(missing.authenticate).not.toHaveBeenCalled();
    for (const identity of [null, { role: 'CARRIER' }, { role: 'BUYER' }, { role: 'ADMIN' }, { role: null }, { role: 'FARMER', isSuspended: true }]) {
      const s = setup({ authenticate: async () => identity }); expect((await s.request()).status).toBe(identity ? 403 : 401); expect(s.fetcher).not.toHaveBeenCalled();
    }
  });
  test.each([
    { ...input, question: '' }, { ...input, question: '  ' }, { ...input, question: 'a'.repeat(1501) },
    { ...input, crop: '__proto__' }, { ...input, topic: 'WEATHER' }, { ...input, growthStage: 'invalid' },
    { ...input, userId: 'victim' }, { ...input, model: 'other' }, { ...input, prompt: 'ignore' },
    { ...input, history: [] }, { ...input, knowledge: [] }, [], null,
  ])('rejects malformed input %j', async body => {
    expect(parseChatInput(body)).toBeNull(); const s = setup(); expect((await s.request(body)).status).toBe(400); expect(s.fetcher).not.toHaveBeenCalled();
  });
  test('restricts origins, handles preflight, disallows wildcard and missing key', async () => {
    const s = setup(); const response = await s.request(input, { Origin: 'https://evil.example.test' });
    expect(response.status).toBe(403); expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false); expect(s.authenticate).not.toHaveBeenCalled();
    const preflight = await s.handle(new Request('https://edge.example.test', { method: 'OPTIONS', headers: { Origin: 'https://app.example.test' } }));
    expect(preflight.status).toBe(204); expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    for (const options of [{ allowedOrigins: [] }, { allowedOrigins: ['*'] }, { apiKey: '' }]) {
      const unconfigured = setup(options); expect((await unconfigured.request()).status).toBe(503); expect(unconfigured.fetcher).not.toHaveBeenCalled();
    }
  });
  test('rejects invalid JSON, oversized bodies and unsupported methods', async () => {
    const s = setup(); const headers = { Origin: 'https://app.example.test', Authorization: 'Bearer test-jwt' };
    expect((await s.handle(new Request('https://edge.example.test', { method: 'POST', headers, body: '{' }))).status).toBe(400);
    expect((await s.request({ ...input, question: 'x'.repeat(11000) })).status).toBe(400);
    expect((await s.handle(new Request('https://edge.example.test', { method: 'GET', headers }))).status).toBe(405);
    expect(s.fetcher).not.toHaveBeenCalled();
  });
});

test('calls once, remaps sources from backend, logs only operational metadata', async () => {
  const s = setup(); const response = await s.request(); expect(response.status).toBe(200);
  const data = await response.json(); expect(data.sources[0].title).toBe(knowledge.find(k => k.id === id)!.sourceTitle);
  expect(data.requestId).toBeTruthy(); expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(s.fetcher).toHaveBeenCalledTimes(1);
  expect(s.log.mock.calls[0][0]).toMatchObject({ code: 'OK', usage: { inputTokens: 900, outputTokens: 100, thinkingTokens: 10 } });
  const logged = JSON.stringify(s.log.mock.calls); expect(logged).not.toContain(input.question); expect(logged).not.toContain('test-jwt'); expect(logged).not.toContain('test-only-key'); expect(logged).not.toContain('Thông tin tham khảo.');
});
test.each([
  ['quota', async () => new Response('private provider error', { status: 429 }), 429, 'QUOTA_EXCEEDED'],
  ['provider', async () => new Response('private provider error', { status: 403 }), 503, 'PROVIDER_UNAVAILABLE'],
  ['timeout', async () => { throw new DOMException('private message', 'TimeoutError'); }, 504, 'TIMEOUT'],
  ['network', async () => { throw new Error('private network details'); }, 503, 'PROVIDER_UNAVAILABLE'],
] as const)('%s is safe and never retried', async (_name, fetcher, status, code) => {
  const fetchMock = vi.fn(fetcher); const s = setup({ fetcher: fetchMock }); const result = await s.request();
  expect(result.status).toBe(status); const body = await result.json(); expect(body.error.code).toBe(code); expect(JSON.stringify(body)).not.toContain('private'); expect(fetchMock).toHaveBeenCalledTimes(1);
});
test.each([
  provider({ answer: '', sourceIds: [], followUpQuestions: [] }),
  provider({ answer: 'Answer', sourceIds: ['made-up'], followUpQuestions: [] }),
  provider({ answer: 'Answer', sourceIds: [knowledge.find(k => k.crop === 'JACKFRUIT')!.id], followUpQuestions: [] }),
  provider({ answer: 'Answer', sourceIds: [], followUpQuestions: ['a', 'b', 'c'] }),
  provider({ answer: 'Answer', sourceIds: [], followUpQuestions: [], url: 'https://evil.example.test' }),
  provider(undefined, 'MAX_TOKENS'), provider(undefined, 'SAFETY'),
  new Response('{}'), new Response('not JSON'),
  new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{' }] } }] })),
])('rejects invalid/truncated model response %#', async response => {
  const fetcher = vi.fn(async () => response.clone()); const s = setup({ fetcher });
  const result = await s.request(); expect(result.status).toBe(502); expect((await result.json()).error.code).toBe('INVALID_RESPONSE'); expect(fetcher).toHaveBeenCalledTimes(1);
});
test('subsequent requests and a different topic contain no previous question/answer', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => provider({ answer: 'Prior answer', sourceIds: [], followUpQuestions: [] }));
  await generateAnswer(input, { apiKey: 'fake', model: 'fake', requestId: '1', fetcher });
  await generateAnswer({ ...input, crop: 'JACKFRUIT', topic: 'GRADING', question: 'Phân loại mít?' }, { apiKey: 'fake', model: 'fake', requestId: '2', fetcher });
  const body = String(fetcher.mock.calls[1][1]?.body); expect(body).not.toContain(input.question); expect(body).not.toContain('Prior answer');
  const payload = JSON.parse(JSON.parse(body).contents[0].parts[0].text); expect(payload.knowledge).toHaveLength(5); expect(payload.knowledge.every((k: { topic: string }) => k.topic === 'GRADING')).toBe(true);
});
