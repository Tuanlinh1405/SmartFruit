import { supabase } from '../../../lib/supabase';
import { isChatResponse, parseChatInput, type FarmerChatInput, type FarmerChatResponse } from './contract';

export class AssistantRequestError extends Error {
  constructor(message: string, public code = 'UNAVAILABLE', public requestId?: string) { super(message); }
}
const errorMessages: Record<string, string> = {
  QUOTA_EXCEEDED: 'Trợ lý đã chạm hạn mức Gemini. Vui lòng thử lại sau.',
  NOT_CONFIGURED: 'Trợ lý chưa được cấu hình Gemini. Vui lòng thử lại sau.',
  TIMEOUT: 'Trợ lý phản hồi quá lâu. Vui lòng thử lại.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Trợ lý chỉ dành cho tài khoản nhà vườn.',
  INVALID_RESPONSE: 'Trợ lý chưa trả về câu trả lời đầy đủ, hợp lệ. Vui lòng thử lại.',
  BAD_REQUEST: 'Vui lòng chọn thông tin hợp lệ và nhập câu hỏi tối đa 1.500 ký tự.',
};
export async function askFarmer(input: FarmerChatInput, signal: AbortSignal): Promise<FarmerChatResponse> {
  // Explicitly whitelist the wire payload: never send transcript or garden records.
  const body = parseChatInput(input);
  if (!body) throw new AssistantRequestError(errorMessages.BAD_REQUEST, 'BAD_REQUEST');
  const { data, error } = await supabase.functions.invoke('farmer-chat', { body, signal });
  if (error) {
    const context = (error as { context?: unknown }).context;
    const statusCodes: Record<number, string> = { 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 429: 'QUOTA_EXCEEDED', 504: 'TIMEOUT' };
    let code = context instanceof Response ? statusCodes[context.status] ?? 'UNAVAILABLE' : 'UNAVAILABLE';
    let requestId: string | undefined;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (typeof payload.error?.code === 'string') code = payload.error.code;
        if (typeof payload.requestId === 'string') requestId = payload.requestId;
      } catch { /* Platform/network errors need not have our envelope. */ }
    }
    throw new AssistantRequestError(errorMessages[code] ?? 'Chưa kết nối được trợ lý. Vui lòng thử lại sau.', code, requestId);
  }
  if (!isChatResponse(data)) throw new AssistantRequestError(errorMessages.INVALID_RESPONSE, 'INVALID_RESPONSE');
  return data;
}
