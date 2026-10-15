import { useReducer, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

type Kind = 'invitations' | 'negotiations' | 'transport' | 'reviews' | 'policy';
type Message = { id: string; conversation: string; author: 'buyer' | 'farmer'; text: string };
type DemoState = { messages: Message[]; offer: string; transport: string; review: string; rating: number;
  invitations: Record<string, 'pending' | 'accepted' | 'declined'>; stage: 'chat' | 'offered' | 'confirmed' };
const initial: DemoState = { messages: [
  { id: '1', conversation: 'minh-ut', author: 'farmer', text: 'Chào anh/chị, lô nông sản hiện đang có sẵn để trao đổi.' },
  { id: '2', conversation: 'minh-ut', author: 'buyer', text: 'Tôi muốn hỏi thêm về thời gian thu hoạch và đóng gói.' },
  { id: '3', conversation: 'an-phu', author: 'farmer', text: 'HTX có lô mít Thái mới thu hoạch.' },
], offer: '', transport: '', review: '', rating: 0, invitations: { 'minh-ut': 'pending', 'an-phu': 'pending' }, stage: 'chat' };
type Action = { type: 'message'; conversation: string; text: string } | { type: 'offer'; price: string } |
  { type: 'confirm' } | { type: 'transport'; text: string } | { type: 'review'; text: string; rating: number } |
  { type: 'invitation'; id: string; decision: 'accepted' | 'declined' } | { type: 'reset' };
function reducer(state: DemoState, action: Action): DemoState {
  if (action.type === 'reset') return initial;
  if (action.type === 'message') return { ...state, messages: [...state.messages, { id: crypto.randomUUID(), conversation: action.conversation, author: 'buyer', text: action.text }] };
  if (action.type === 'offer') return { ...state, offer: action.price, stage: 'offered' };
  if (action.type === 'confirm') return state.stage === 'offered' ? { ...state, stage: 'confirmed' } : state;
  if (action.type === 'transport') return { ...state, transport: action.text };
  if (action.type === 'invitation') return { ...state, invitations: { ...state.invitations, [action.id]: action.decision } };
  return { ...state, review: action.text, rating: action.rating };
}

export function BuyerDemoPage({ kind }: { kind: Kind }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [draft, setDraft] = useState('');
  const [price, setPrice] = useState('');
  const [rating, setRating] = useState(0);
  const [conversation, setConversation] = useState('minh-ut');
  const [params] = useSearchParams();
  const lotId = params.get('lotId');
  const titles: Record<Kind, string> = { invitations: 'Lời mời kết nối', negotiations: 'Đàm phán', transport: 'Vận chuyển', reviews: 'Đánh giá & tín nhiệm', policy: 'Chính sách' };
  return <><div className="page-heading"><div><span className="eyebrow">Không gian thương lái</span><h1>{titles[kind]}</h1>
    <p>Khám phá luồng thao tác theo thiết kế Buyer.</p></div><button className="button outline" onClick={() => { dispatch({ type: 'reset' }); setDraft(''); setPrice(''); setRating(0); setConversation('minh-ut'); }}>Đặt lại demo</button></div>
    <div className="notice demo-notice"><span className="demo-badge">Dữ liệu minh họa</span> Thao tác trên trang này chỉ cập nhật màn hình hiện tại, chưa gửi tới nhà vườn hoặc tạo giao dịch thật.</div>
    {kind === 'invitations' && <div className="admin-cards">{[
      { id: 'minh-ut', name: 'Nhà vườn Minh Út', item: 'Sầu riêng Ri6 · Đồng Nai' },
      { id: 'an-phu', name: 'HTX An Phú', item: 'Mít Thái · Lâm Đồng' },
    ].map(invite => <article className="panel admin-card" key={invite.id}><div className="admin-card-mark">✳</div>
      <div><h2>{invite.name}</h2><p>{invite.item} · lời mời mẫu</p></div>
      <span className="status-pill">{state.invitations[invite.id] === 'pending' ? 'Chờ phản hồi' : state.invitations[invite.id] === 'accepted' ? 'Đã đồng ý' : 'Đã từ chối'}</span>
      <div className="admin-card-actions"><button className="button primary" disabled={state.invitations[invite.id] !== 'pending'} onClick={() => dispatch({ type: 'invitation', id: invite.id, decision: 'accepted' })}>Đồng ý</button>
        <button className="button outline" disabled={state.invitations[invite.id] !== 'pending'} onClick={() => dispatch({ type: 'invitation', id: invite.id, decision: 'declined' })}>Từ chối</button></div></article>)}</div>}
    {kind === 'negotiations' && <div className="chat-layout"><aside className="panel chat-list"><h2>Hội thoại</h2><button className={`conversation ${conversation === 'minh-ut' ? 'selected' : ''}`} onClick={() => setConversation('minh-ut')}><strong>Nhà vườn Minh Út</strong><span>Sầu riêng Ri6 · Đồng Nai</span></button>
      <button className={`conversation ${conversation === 'an-phu' ? 'selected' : ''}`} onClick={() => setConversation('an-phu')}><strong>HTX An Phú</strong><span>Mít Thái · Lâm Đồng</span></button></aside>
      <section className="panel chat-main"><div className="chat-header"><strong>{conversation === 'minh-ut' ? 'Nhà vườn Minh Út' : 'HTX An Phú'}</strong><span className="demo-badge">Demo</span></div>
        {lotId && <p className="context-strip">Ngữ cảnh lô đã chọn: {lotId.slice(0, 8)}…</p>}
        <div className="chat-messages">{state.messages.filter(message => message.conversation === conversation).map(message => <div key={message.id} className={`message ${message.author}`}><span>{message.text}</span></div>)}</div>
        <form className="chat-compose" onSubmit={event => { event.preventDefault(); if (draft.trim()) { dispatch({ type: 'message', conversation, text: draft.trim() }); setDraft(''); } }}>
          <input aria-label="Tin nhắn demo" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Nhập tin nhắn demo…" />
          <button className="button primary">Gửi</button></form></section>
      <aside className="panel chat-side"><span className="eyebrow">Thỏa thuận</span><h2>Đề nghị thu mua</h2>
        <label>Giá đề xuất (VND/kg)<input type="number" min="1" value={price} onChange={event => setPrice(event.target.value)} placeholder="65000" /></label>
        <button className="button accent full" disabled={!Number(price)} onClick={() => dispatch({ type: 'offer', price })}>Gửi đề nghị demo</button>
        {state.offer && <p className="notice">Đã tạo đề nghị minh họa: {Number(state.offer).toLocaleString('vi-VN')} đ/kg.</p>}
        <button className="button outline full" disabled={state.stage !== 'offered'} onClick={() => dispatch({ type: 'confirm' })}>Xác nhận demo</button>
        {state.stage === 'confirmed' && <p className="form-success">Đã xác nhận trong bản demo.</p>}</aside></div>}
    {kind === 'transport' && <div className="dashboard-columns"><section className="panel"><span className="eyebrow">Yêu cầu xe</span><h2>Thông tin vận chuyển</h2>
      <label>Tuyến đường mẫu<input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Đồng Nai → TP. Hồ Chí Minh" /></label>
      <button className="button primary" disabled={!draft.trim()} onClick={() => dispatch({ type: 'transport', text: draft.trim() })}>Lưu yêu cầu demo</button>
      {state.transport && <p className="form-success">Đã lưu tuyến minh họa: {state.transport}</p>}</section>
      <section className="panel"><span className="demo-badge">Minh họa</span><h2>Đơn vị vận tải gợi ý</h2><p>Vận tải Minh Phát · xe lạnh 15 tấn · Đồng Nai / Lâm Đồng</p>
        <p className="muted">Chưa có đặt xe hoặc tracking thực.</p></section></div>}
    {kind === 'reviews' && <section className="panel narrow"><span className="eyebrow">Phản hồi demo</span><h2>Đánh giá đối tác</h2>
      <div className="rating-row" role="group" aria-label="Chấm sao">{[1,2,3,4,5].map(value => <button key={value} type="button" aria-label={`${value} sao`} aria-pressed={rating === value} onClick={() => setRating(value)}>{value <= rating ? '★' : '☆'}</button>)}</div>
      <label>Nhận xét<textarea value={draft} onChange={event => setDraft(event.target.value)} rows={4} placeholder="Viết nhận xét minh họa…" /></label>
      <button className="button primary" disabled={!draft.trim() || rating === 0} onClick={() => dispatch({ type: 'review', text: draft.trim(), rating })}>Lưu đánh giá demo</button>
      {state.review && <p className="form-success">Đã lưu đánh giá {state.rating} sao: {state.review}</p>}</section>}
    {kind === 'policy' && <section className="panel narrow"><span className="demo-badge">Chưa triển khai trong MVP</span><h2>Chính sách nền tảng</h2>
      <p>Nội dung chính sách cần được đội dự án phê duyệt trước khi công bố. Trang này giữ vị trí điều hướng theo thiết kế.</p></section>}
  </>;
}
