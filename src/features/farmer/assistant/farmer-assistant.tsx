import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, Send, Trash2 } from 'lucide-react';
import { Drawer } from '../../../components/ui/dialog';
import { Button, Select, TextArea } from '../../../components/ui';
import { crops, topics, growthStages, questionLimit, demoDisclaimer } from './contract';
import { useFarmerAssistant } from './assistant-context';
import { LoadingSteps } from '../../../components/shared';
import './farmer-assistant.css';

export function FarmerAssistantEntry() {
  const assistant = useFarmerAssistant();
  if (!assistant) return null;
  return <Button className="assistant-fab" aria-label="Hỏi trợ lý" title="Hỏi trợ lý nhà vườn" onClick={() => assistant.setOpen(true)}><Bot size={26} aria-hidden="true" /><span>Trợ lý</span></Button>;
}

export function FarmerAssistantPanel({ enabled }: { enabled: boolean }) {
  const assistant = useFarmerAssistant(); const location = useLocation(); const composer = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const dashboardPath = location.pathname.replace(/\/+$/, '');
  const onDashboard = enabled && ['/farmer/dashboard', '/farmer'].includes(dashboardPath);
  const setOpen = assistant?.setOpen;
  useEffect(() => { if (!onDashboard) setOpen?.(false); }, [onDashboard, setOpen]);
  useEffect(() => { thread.current?.scrollTo?.({ top: thread.current.scrollHeight }); }, [assistant?.exchanges.length, assistant?.pending, assistant?.open]);
  if (!assistant) return null;
  const { context, draft, exchanges, pending, error } = assistant;
  const suggestions = context.topic === 'DISEASE'
    ? [`Tình huống mẫu: ${crops[context.crop].toLowerCase()} gặp mưa nhiều, tài liệu có những dấu hiệu bệnh nào cần lưu ý?`, `Tài liệu có hướng dẫn phòng ngừa bệnh cho ${crops[context.crop].toLowerCase()} không?`]
    : [`Tài liệu phân loại ${crops[context.crop].toLowerCase()} dựa trên những tiêu chí nào?`, `Chỉ biết cân nặng có đủ phân loại ${crops[context.crop].toLowerCase()} không?`];
  return <Drawer title="Trợ lý nhà vườn" description={demoDisclaimer} open={assistant.open && onDashboard} onOpenChange={assistant.setOpen} className="farmer-assistant-dialog">
    <div className="assistant-toolbar"><span className="badge badge-demo">Kiến thức tham khảo</span><Button variant="ghost" onClick={assistant.clear}><Trash2 size={16} aria-hidden="true" />Xóa cuộc trò chuyện</Button></div>
    <div className="assistant-controls">
      <Select label="Cây trồng" value={context.crop} disabled={pending} onChange={e => assistant.setContext({ ...context, crop: e.target.value as typeof context.crop })}>{Object.entries(crops).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Select label="Chủ đề" value={context.topic} disabled={pending} onChange={e => assistant.setContext({ ...context, topic: e.target.value as typeof context.topic })}>{Object.entries(topics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Select label="Giai đoạn cây (tùy chọn)" value={context.growthStage} disabled={pending} onChange={e => assistant.setContext({ ...context, growthStage: e.target.value as typeof context.growthStage })}>{Object.entries(growthStages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
    </div>
    <div className="assistant-thread" aria-label="Các câu hỏi và trả lời" ref={thread}>
      {!exchanges.length && !pending && <div className="assistant-welcome"><Bot size={32} aria-hidden="true" /><h3>Bạn muốn tìm hiểu điều gì?</h3><p>Chọn cây và chủ đề, sau đó mô tả đầy đủ tình huống mẫu trong mỗi câu hỏi.</p></div>}
      {exchanges.map((exchange, index) => <article className="assistant-exchange" key={`${exchange.response.requestId}-${index}`}>
        <div className="assistant-question"><small>Bạn · {crops[exchange.input.crop]} · {topics[exchange.input.topic]}</small><p>{exchange.input.question}</p></div>
        <div className="assistant-answer"><strong>Trợ lý</strong><p>{exchange.response.answer}</p>
          {exchange.response.followUpQuestions.length > 0 && <><ul>{exchange.response.followUpQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul><Button variant="secondary" disabled={pending} onClick={() => { assistant.supplement(exchange); composer.current?.focus(); }}>Bổ sung câu hỏi</Button></>}
          {exchange.response.sources.length > 0 && <div className="assistant-sources"><strong>Nguồn tham khảo</strong><ul>{exchange.response.sources.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> : source.title}<small>{source.id}</small></li>)}</ul></div>}
        </div>
      </article>)}
      {pending && <LoadingSteps label="Trợ lý đang trả lời…" />}
    </div>
    <form className="assistant-compose" onSubmit={e => { e.preventDefault(); void assistant.send(); }}>
      <div className="assistant-suggestions" aria-label="Câu hỏi gợi ý">{suggestions.map((suggestion, i) => <Button key={suggestion} variant="secondary" disabled={pending} onClick={() => { assistant.setDraft(suggestion); composer.current?.focus(); }}>{i === 0 ? context.topic === 'DISEASE' ? 'Dấu hiệu bệnh thường gặp' : 'Tiêu chí phân loại' : context.topic === 'DISEASE' ? 'Thông tin phòng ngừa' : 'Kiểm tra đủ dữ kiện'}</Button>)}</div>
      <TextArea ref={composer} label="Câu hỏi cho trợ lý" rows={3} maxLength={questionLimit} value={draft} disabled={pending} onChange={e => assistant.setDraft(e.target.value)} placeholder="Nhập câu hỏi hoặc tình huống mẫu…" />
      <div className="assistant-compose-footer"><small>{draft.length}/{questionLimit} ký tự</small><Button type="submit" loading={pending} disabled={!draft.trim()}><Send size={16} aria-hidden="true" />Gửi câu hỏi</Button></div>
      {error && <div role="alert" className="assistant-error"><strong>{error.code === 'QUOTA_EXCEEDED' ? 'Đã chạm hạn mức' : 'Chưa nhận được câu trả lời'}</strong><p>{error.message}</p>{error.requestId && <small>Mã yêu cầu: {error.requestId}</small>}</div>}
    </form>
  </Drawer>;
}
