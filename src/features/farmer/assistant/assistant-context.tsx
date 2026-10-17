import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { askFarmer, AssistantRequestError } from './api';
import { defaultContext, parseChatInput, type FarmerChatInput, type FarmerChatResponse } from './contract';

export interface ChatExchange { input: FarmerChatInput; response: FarmerChatResponse; }
function useAssistantState(sendRequest: typeof askFarmer) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState({ ...defaultContext });
  const [draft, setDraft] = useState('');
  const [exchanges, setExchanges] = useState<ChatExchange[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AssistantRequestError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { ++generation.current; controller.current?.abort(); controller.current = null; }, []);
  function clear() {
    ++generation.current; controller.current?.abort(); controller.current = null;
    setExchanges([]); setDraft(''); setError(null); setPending(false); setContext({ ...defaultContext });
  }
  async function send() {
    if (controller.current) return;
    const input = parseChatInput({ ...context, question: draft });
    if (!input) { setError(new AssistantRequestError('Nhập câu hỏi từ 1 đến 1.500 ký tự.', 'BAD_REQUEST')); return; }
    const ticket = ++generation.current; const abort = new AbortController(); controller.current = abort;
    setPending(true); setError(null);
    try {
      const response = await sendRequest(input, abort.signal);
      if (ticket !== generation.current) return;
      setExchanges(previous => [...previous, { input, response }]); setDraft('');
    } catch (cause) {
      if (ticket !== generation.current) return;
      setError(cause instanceof AssistantRequestError ? cause : new AssistantRequestError('Chưa kết nối được trợ lý. Vui lòng thử lại sau.'));
    } finally {
      if (ticket === generation.current) { controller.current = null; setPending(false); }
    }
  }
  function supplement(exchange: ChatExchange) {
    if (controller.current) return;
    setContext({ crop: exchange.input.crop, topic: exchange.input.topic, growthStage: exchange.input.growthStage });
    setDraft(exchange.input.question); setError(null);
  }
  return { open, setOpen, context, setContext, draft, setDraft, exchanges, pending, error, send, clear, supplement };
}
const Context = createContext<ReturnType<typeof useAssistantState> | null>(null);
export function FarmerAssistantProvider({ children, sendRequest = askFarmer }: PropsWithChildren<{ sendRequest?: typeof askFarmer }>) {
  const state = useAssistantState(sendRequest);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useFarmerAssistant() { return useContext(Context); }
