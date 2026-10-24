import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp, ArrowUpRight, Bot, ChevronDown, Leaf, Trash2 } from 'lucide-react';
import { Drawer } from '../../../components/ui/dialog';
import { Button, Select, TextArea } from '../../../components/ui';
import { crops, topics, growthStages, questionLimit } from './contract';
import { useFarmerAssistant } from './assistant-context';
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
  useEffect(() => {
    if (!composer.current) return;
    composer.current.style.height = 'auto';
    composer.current.style.height = `${Math.min(composer.current.scrollHeight, 120)}px`;
  }, [assistant?.draft, assistant?.open]);
  if (!assistant) return null;
  const { context, draft, exchanges, pending, error } = assistant;
  const suggestions = context.topic === 'DISEASE'
    ? [`Tình huống mẫu: ${crops[context.crop].toLowerCase()} gặp mưa nhiều, tài liệu có những dấu hiệu bệnh nào cần lưu ý?`, `Tài liệu có hướng dẫn phòng ngừa bệnh cho ${crops[context.crop].toLowerCase()} không?`]
    : [`Tài liệu phân loại ${crops[context.crop].toLowerCase()} dựa trên những tiêu chí nào?`, `Chỉ biết cân nặng có đủ phân loại ${crops[context.crop].toLowerCase()} không?`];
  return <Drawer title="Trợ lý nhà vườn" open={assistant.open && onDashboard} onOpenChange={assistant.setOpen} className="farmer-assistant-dialog">
    <section className="assistant-context" aria-label="Thông tin tư vấn">
      <div className="assistant-toolbar"><span><Leaf size={15} aria-hidden="true" />Góc tư vấn của bạn</span><Button variant="ghost" aria-label="Xóa cuộc trò chuyện" title="Xóa cuộc trò chuyện" onClick={assistant.clear}><Trash2 size={16} aria-hidden="true" /></Button></div>
      <div className="assistant-controls">
      <Select label="Cây trồng" value={context.crop} disabled={pending} onChange={e => assistant.setContext({ ...context, crop: e.target.value as typeof context.crop })}>{Object.entries(crops).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Select label="Chủ đề" value={context.topic} disabled={pending} onChange={e => assistant.setContext({ ...context, topic: e.target.value as typeof context.topic })}>{Object.entries(topics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      </div>
      <details className="assistant-stage"><summary>Giai đoạn cây <span>{context.growthStage === 'UNKNOWN' ? 'Thêm thông tin' : growthStages[context.growthStage]}<ChevronDown size={14} aria-hidden="true" /></span></summary><Select label="Giai đoạn cây (tùy chọn)" value={context.growthStage} disabled={pending} onChange={e => assistant.setContext({ ...context, growthStage: e.target.value as typeof context.growthStage })}>{Object.entries(growthStages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></details>
    </section>
    <div className="assistant-thread" aria-label="Các câu hỏi và trả lời" ref={thread}>
      {!exchanges.length && !pending && <div className="assistant-welcome">
        <span className="assistant-welcome-icon"><Leaf size={30} strokeWidth={1.5} aria-hidden="true" /></span>
        <span className="assistant-eyebrow">CÙNG BẠN CHĂM VƯỜN</span><h3>Bạn muốn tìm hiểu điều gì?</h3><p>Hỏi về {crops[context.crop].toLowerCase()}, từ dấu hiệu bệnh<br />đến cách phân loại trái.</p>
        <div className="assistant-suggestions" aria-label="Câu hỏi gợi ý">{suggestions.map((suggestion, i) => <Button key={suggestion} variant="secondary" disabled={pending} onClick={() => { assistant.setDraft(suggestion); composer.current?.focus(); }}><span>{i === 0 ? context.topic === 'DISEASE' ? 'Dấu hiệu bệnh thường gặp' : 'Tiêu chí phân loại' : context.topic === 'DISEASE' ? 'Thông tin phòng ngừa' : 'Kiểm tra đủ dữ kiện'}</span><ArrowUpRight size={17} aria-hidden="true" /></Button>)}</div>
      </div>}
      {exchanges.map((exchange, index) => <article className="assistant-exchange" key={`${exchange.response.requestId}-${index}`}>
        <div className="assistant-question"><small>Bạn · {crops[exchange.input.crop]} · {topics[exchange.input.topic]}</small><p>{exchange.input.question}</p></div>
        <div className="assistant-answer"><div className="assistant-answer-label"><span><Bot size={16} aria-hidden="true" /></span><strong>Trợ lý nhà vườn</strong></div><p>{exchange.response.answer}</p>
          {exchange.response.followUpQuestions.length > 0 && <div className="assistant-followup"><ul>{exchange.response.followUpQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul><Button variant="ghost" disabled={pending} onClick={() => { assistant.supplement(exchange); composer.current?.focus(); }}>Bổ sung câu hỏi<ArrowUpRight size={14} aria-hidden="true" /></Button></div>}
        </div>
      </article>)}
      {pending && <div className="assistant-exchange"><div className="assistant-question"><small>Bạn · {crops[context.crop]} · {topics[context.topic]}</small><p>{draft}</p></div><div className="assistant-pending" role="status"><span className="assistant-typing" aria-hidden="true"><i /><i /><i /></span>Trợ lý đang trả lời…</div></div>}
    </div>
    <form className="assistant-compose" onSubmit={e => { e.preventDefault(); void assistant.send(); }}>
      <div className="assistant-input-box">
        <TextArea ref={composer} label="Câu hỏi cho trợ lý" rows={2} maxLength={questionLimit} value={draft} disabled={pending} onChange={e => assistant.setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!pending && draft.trim()) void assistant.send(); } }} placeholder={`Bạn muốn hỏi gì về ${crops[context.crop].toLowerCase()}?`} />
        <Button className="assistant-send" type="submit" aria-label="Gửi câu hỏi" title="Gửi câu hỏi" loading={pending} disabled={!draft.trim()}>{!pending && <ArrowUp size={20} aria-hidden="true" />}</Button>
      </div>
      <div className="assistant-compose-footer"><small>Enter để gửi · Shift + Enter xuống dòng</small><small>{draft.length}/{questionLimit}</small></div>
      {error && <div role="alert" className="assistant-error"><strong>{error.code === 'QUOTA_EXCEEDED' ? 'Đã chạm hạn mức' : 'Chưa nhận được câu trả lời'}</strong><p>{error.message}</p>{error.requestId && <small>Mã yêu cầu: {error.requestId}</small>}</div>}
    </form>
  </Drawer>;
}
