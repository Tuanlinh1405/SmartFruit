import { parseChatInput } from '../../../src/features/farmer/assistant/contract.ts';
import { ChatError, defaultModel, generateAnswer } from './service.ts';

export interface ChatHandlerOptions {
  authenticate: (jwt: string) => Promise<{ role: string | null } | null>;
  apiKey?: string; model?: string; allowedOrigins: string[]; fetcher?: typeof fetch;
  log?: (event: Record<string, unknown>) => void;
}
export function createChatHandler(options: ChatHandlerOptions) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID(); const start = Date.now(); const model = options.model?.trim() || defaultModel;
    const origin = request.headers.get('Origin');
    const allowed = !!origin && options.allowedOrigins.includes(origin);
    const headers = {
      ...(allowed ? { 'Access-Control-Allow-Origin': origin! } : {}),
      'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8',
    };
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
    const log = (code: string, usage?: unknown, providerStatus?: number, providerCode?: string, actualModel = model) => options.log?.({ requestId, provider: 'openrouter', model: actualModel, durationMs: Date.now() - start, code, ...(usage ? { usage } : {}), ...(providerStatus ? { providerStatus } : {}), ...(providerCode ? { providerCode } : {}) });
    try {
      if (!options.allowedOrigins.length || options.allowedOrigins.includes('*')) throw new ChatError('NOT_CONFIGURED', 503, 'Trợ lý chưa được cấu hình.');
      if (origin && !allowed) throw new ChatError('FORBIDDEN_ORIGIN', 403, 'Nguồn truy cập không được phép.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') throw new ChatError('METHOD_NOT_ALLOWED', 405, 'Phương thức không được hỗ trợ.');
      const match = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i);
      if (!match) throw new ChatError('UNAUTHENTICATED', 401, 'Vui lòng đăng nhập lại để hỏi trợ lý.');
      const identity = await options.authenticate(match[1]);
      if (!identity) throw new ChatError('UNAUTHENTICATED', 401, 'Phiên đăng nhập đã hết hạn.');
      if (identity.role !== 'FARMER') throw new ChatError('FORBIDDEN', 403, 'Trợ lý chỉ dành cho tài khoản nhà vườn.');
      const body = await request.text();
      if (new TextEncoder().encode(body).length > 10_000) throw new ChatError('BAD_REQUEST', 400, 'Câu hỏi quá dài.');
      let value: unknown;
      try { value = JSON.parse(body); } catch { throw new ChatError('BAD_REQUEST', 400, 'Nội dung yêu cầu không hợp lệ.'); }
      const input = parseChatInput(value);
      if (!input) throw new ChatError('BAD_REQUEST', 400, 'Chọn cây, chủ đề, giai đoạn hợp lệ và nhập câu hỏi tối đa 1.500 ký tự.');
      if (!options.apiKey?.trim()) throw new ChatError('NOT_CONFIGURED', 503, 'Trợ lý chưa được cấu hình OpenRouter.');
      const result = await generateAnswer(input, { apiKey: options.apiKey, model, requestId, fetcher: options.fetcher });
      log('OK', result.usage, undefined, undefined, result.model); return json(result.response);
    } catch (cause) {
      const error = cause instanceof ChatError ? cause : new ChatError('UNAVAILABLE', 503, 'Không thể kiểm tra dịch vụ trợ lý. Vui lòng thử lại sau.');
      log(error.code, error.usage, error.providerStatus, error.providerCode, error.actualModel ?? model); return json({ error: { code: error.code, message: error.message }, requestId }, error.status);
    }
  };
}
