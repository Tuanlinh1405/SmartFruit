import { describe, expect, test, vi } from 'vitest';
import { parseChatInput, type FarmerChatInput } from './contract';
import { buildOpenRouterRequest, generateAnswer, knowledge } from '../../../../supabase/functions/farmer-chat/service';
import { createChatHandler, type ChatHandlerOptions } from '../../../../supabase/functions/farmer-chat/handler';

const input: FarmerChatInput = { crop: 'DURIAN', topic: 'DISEASE', growthStage: 'FLOWERING', question: 'Tình huống mẫu: mưa nhiều cần lưu ý dấu hiệu nào?' };
const id = knowledge.find(k => k.crop === input.crop && k.topic === input.topic)!.id;
function provider(value: unknown = { answer: 'Thông tin tham khảo.', sourceIds: [id], followUpQuestions: [] }, finishReason = 'stop') {
  return new Response(JSON.stringify({ model: 'test/model:free', choices: [{ finish_reason: finishReason, message: { content: JSON.stringify(value) } }], usage: { prompt_tokens: 900, completion_tokens: 100, completion_tokens_details: { reasoning_tokens: 10 } } }));
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
  const request = buildOpenRouterRequest(input); expect(request.messages).toHaveLength(2); expect(request).not.toHaveProperty('tools');
  const payload = JSON.parse(request.messages[1].content);
  expect(Object.keys(payload).sort()).toEqual(['context', 'knowledge', 'question']);
  expect(payload.context).toEqual({ crop: 'DURIAN', topic: 'DISEASE', growthStage: 'FLOWERING' });
  expect(payload.knowledge).toHaveLength(5); expect(payload.knowledge.every((k: { crop: string; topic: string }) => k.crop === 'DURIAN' && k.topic === 'DISEASE')).toBe(true);
  expect(request.max_tokens).toBe(1024); expect(request.provider.max_price).toEqual({prompt:0,completion:0}); expect(request.response_format.type).toBe('json_schema');
});

describe('access and input gates run before inference', () => {
  test('missing/invalid identity or wrong role cannot reach OpenRouter', async () => {
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
  ['provider', async () => new Response('private provider error', { status: 403 }), 503, 'PROVIDER_AUTH_ERROR'],
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
  new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{' } }] })),
])('rejects invalid/truncated model response %#', async response => {
  const fetcher = vi.fn(async () => response.clone()); const s = setup({ fetcher });
  const result = await s.request(); expect(result.status).toBe(502); expect((await result.json()).error.code).toBe('INVALID_RESPONSE'); expect(fetcher).toHaveBeenCalledTimes(1);
});
test('subsequent requests and a different topic contain no previous question/answer', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => provider({ answer: 'Prior answer', sourceIds: [], followUpQuestions: [] }));
  await generateAnswer(input, { apiKey: 'fake', model: 'openrouter/free', requestId: '1', fetcher });
  await generateAnswer({ ...input, crop: 'JACKFRUIT', topic: 'GRADING', question: 'Phân loại mít?' }, { apiKey: 'fake', model: 'openrouter/free', requestId: '2', fetcher });
  const body = String(fetcher.mock.calls[1][1]?.body); expect(body).not.toContain(input.question); expect(body).not.toContain('Prior answer');
  const payload = JSON.parse(JSON.parse(body).messages[1].content); expect(payload.knowledge).toHaveLength(5); expect(payload.knowledge.every((k: { topic: string }) => k.topic === 'GRADING')).toBe(true);
});

test('paid or unknown free models are refused before completion and free catalog validation is cached',async()=>{
  const fetcher=vi.fn<typeof fetch>(async url=>String(url).endsWith('/models')?Response.json({data:[{id:'test/tiny:free',pricing:{prompt:'0',completion:'0'}}]}):provider());
  await expect(generateAnswer(input,{apiKey:'test-only',model:'test/paid',requestId:'paid',fetcher})).rejects.toMatchObject({code:'MODEL_NOT_FREE'});expect(fetcher).not.toHaveBeenCalled();
  await expect(generateAnswer(input,{apiKey:'test-only',model:'test/unknown:free',requestId:'unknown',fetcher})).rejects.toMatchObject({code:'MODEL_NOT_FREE'});expect(fetcher).toHaveBeenCalledTimes(1);
  await generateAnswer(input,{apiKey:'test-only',model:'test/tiny:free',requestId:'valid',fetcher});
  expect(fetcher).toHaveBeenCalledTimes(2);const body=JSON.parse(String(fetcher.mock.calls[1][1]?.body));expect(body.provider.max_price).toEqual({prompt:0,completion:0});expect(body.reasoning.effort).toBe('none');
});
test('a :free suffix with positive or missing pricing is never trusted',async()=>{
  for(const pricing of [{prompt:'0',completion:'0.1'},{prompt:'0'}, {prompt:'0',completion:'0',request:'0.01'}]){
    const fetcher=vi.fn<typeof fetch>(async()=>Response.json({data:[{id:'test/not-free:free',pricing}]}));
    await expect(generateAnswer(input,{apiKey:'test-only',model:'test/not-free:free',requestId:'blocked',fetcher})).rejects.toMatchObject({code:'MODEL_NOT_FREE'});expect(fetcher).toHaveBeenCalledTimes(1);
  }
});
test.each([401,403,402])('provider account/key failure %s is not a user-login error',async status=>{
  const s=setup({fetcher:async()=>new Response('private key details',{status})});const r=await s.request();expect(r.status).toBe(503);expect((await r.json()).error.code).toBe(status===402?'PROVIDER_ACCOUNT_ERROR':'PROVIDER_AUTH_ERROR');
});
