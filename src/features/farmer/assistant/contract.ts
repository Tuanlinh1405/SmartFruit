export const crops = { DURIAN: 'Sầu riêng', JACKFRUIT: 'Mít', DRAGON_FRUIT: 'Thanh long' } as const;
export const topics = { DISEASE: 'Bệnh & phòng ngừa', GRADING: 'Phân loại trái' } as const;
export const growthStages = { UNKNOWN: 'Chưa rõ', NEW_SHOOTS: 'Đọt non', FLOWERING: 'Ra hoa', YOUNG_FRUIT: 'Trái non', FRUIT_DEVELOPMENT: 'Nuôi trái', PRE_HARVEST: 'Trước thu hoạch', POST_HARVEST: 'Sau thu hoạch' } as const;
export interface FarmerChatInput {
  crop: keyof typeof crops;
  topic: keyof typeof topics;
  growthStage: keyof typeof growthStages;
  question: string;
}
export interface ChatSource { id: string; title: string; url?: string; }
export interface FarmerChatResponse { answer: string; sources: ChatSource[]; followUpQuestions: string[]; requestId: string; }
export const questionLimit = 1500;
export const demoDisclaimer = 'Kiến thức tham khảo. Không nhập thông tin cá nhân hoặc bí mật kinh doanh. Mỗi câu hỏi được xử lý độc lập, không dùng nội dung các lượt trước.';
export const defaultContext: Omit<FarmerChatInput, 'question'> = { crop: 'DURIAN', topic: 'DISEASE', growthStage: 'UNKNOWN' };

export function parseChatInput(value: unknown): FarmerChatInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !['crop', 'topic', 'growthStage', 'question'].includes(key)) ||
      typeof row.crop !== 'string' || !Object.hasOwn(crops, row.crop) ||
      typeof row.topic !== 'string' || !Object.hasOwn(topics, row.topic) ||
      typeof row.growthStage !== 'string' || !Object.hasOwn(growthStages, row.growthStage) ||
      typeof row.question !== 'string' || row.question.length > questionLimit || !row.question.trim()) return null;
  return { crop: row.crop as FarmerChatInput['crop'], topic: row.topic as FarmerChatInput['topic'], growthStage: row.growthStage as FarmerChatInput['growthStage'], question: row.question.trim() };
}

export function isChatResponse(value: unknown): value is FarmerChatResponse {
  if (!value || typeof value !== 'object') return false;
  const row = value as FarmerChatResponse;
  return typeof row.answer === 'string' && !!row.answer.trim() && typeof row.requestId === 'string' &&
    Array.isArray(row.followUpQuestions) && row.followUpQuestions.length <= 2 && row.followUpQuestions.every(s => typeof s === 'string' && !!s.trim()) &&
    Array.isArray(row.sources) && row.sources.every(s => s && typeof s.id === 'string' && typeof s.title === 'string' &&
      (s.url === undefined || (typeof s.url === 'string' && /^https:\/\//.test(s.url))));
}
