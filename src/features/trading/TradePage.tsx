import { RatingStars } from '../../components/shared/rating-stars';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { explainError, formatDate, formatMoney, formatTonnes } from '../../lib/format';
import { completeAgreement, listConnections, loadReviews, loadThread, proposeOffer, respondConnection,
  respondOffer, sendMessage, submitReview, type Agreement, type Connection, type Message, type Offer, type Review } from './api';

const labels: Record<string, string> = { PENDING: 'Chờ phản hồi', ACCEPTED: 'Đã đồng ý', DECLINED: 'Đã từ chối',
  CANCELLED: 'Đã hủy', REJECTED: 'Đã từ chối', WITHDRAWN: 'Đã rút', SUPERSEDED: 'Đã có thỏa thuận khác',
  AGREED: 'Đã thống nhất', COMPLETED: 'Đã hoàn tất' };

export function TradePage({ view }: { view: 'invitations' | 'negotiations' | 'reviews' }) {
  const { session, profile } = useAuth();
  const userId = session?.user.id || '';
  const prefix = profile?.role === 'FARMER' ? '/farmer' : '/buyer';
  const [params, setParams] = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestedId = params.get('connectionId');
  const selected = requestedId !== null ? connections.find(row => row.id === requestedId) : connections.find(row => row.status === 'ACCEPTED');
  const refresh = useCallback(async () => setConnections(await listConnections(userId)), [userId]);
  useEffect(() => {
    let active = true;
    const load = async () => { try { const rows = await listConnections(userId); if (active) { setConnections(rows); setError(''); } }
      catch (cause) { if (active) setError(explainError(cause)); } finally { if (active) setLoading(false); } };
    void load(); const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [userId]);
  async function decide(row: Connection, decision: string) {
    setBusy(true); setError('');
    try { await respondConnection(row.id, decision); await refresh(); }
    catch (cause) { setError(explainError(cause)); } finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><span className="eyebrow">Kết nối đối tác</span><h1>{view === 'invitations' ? 'Lời mời kết nối' : view === 'reviews' ? 'Đánh giá đối tác' : 'Trao đổi & thỏa thuận'}</h1>
    <p>Thông tin được lưu trên hệ thống và chỉ các bên tham gia được truy cập.</p></div><button className="button outline" onClick={() => void refresh().catch(cause => setError(explainError(cause)))}>Tải lại</button></div>
    {view==='invitations'&&!loading&&params.has('focus')&&connections.some(c=>c.id===requestedId&&c.status==='PENDING')&&<p className="notice" role="status">Lời mời kết nối đang chờ phản hồi. Sau khi hai bên đồng ý, bạn có thể nhắn tin và gửi đề nghị giá, sản lượng, ngày giao.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {loading ? <div className="panel empty-state">Đang tải kết nối…</div> : view === 'invitations' ?
      <div className="admin-cards">{connections.length === 0 && <div className="panel empty-state">Chưa có lời mời. Mở chi tiết lô hàng để gửi kết nối.</div>}
        {connections.map(row => <article className="panel admin-card" key={row.id}><div><span className="eyebrow">{row.initiated_by === userId ? 'Bạn đã gửi' : 'Bạn nhận được'}</span><h2>{row.partnerName}</h2><p>{row.lot_title}</p></div>
          <span className="status-pill">{labels[row.status]}</span><div className="admin-card-actions">
            {row.status === 'PENDING' && (row.initiated_by === userId ? <button className="button outline" disabled={busy} onClick={() => void decide(row, 'CANCELLED')}>Hủy lời mời</button> :
              <><button className="button primary" disabled={busy} onClick={() => void decide(row, 'ACCEPTED')}>Đồng ý</button><button className="button outline" disabled={busy} onClick={() => void decide(row, 'DECLINED')}>Từ chối</button></>)}
            {row.status === 'ACCEPTED' && <Link className="button primary" to={`${prefix}/negotiations?connectionId=${encodeURIComponent(row.id)}`}>Mở hội thoại →</Link>}</div></article>)}</div> :
      view === 'reviews' ? <Reviews userId={userId} connections={connections} /> :
      <div className="chat-layout"><aside className="panel chat-list"><h2>Hội thoại</h2>{connections.filter(row => row.status === 'ACCEPTED').map(row =>
        <button className={`conversation ${selected?.id === row.id ? 'selected' : ''}`} key={row.id} onClick={() => setParams({ connectionId: row.id })}><strong>{row.partnerName}</strong><span>{row.lot_title}</span></button>)}
        {!connections.some(row => row.status === 'ACCEPTED') && <p className="muted">Hai bên cần đồng ý kết nối trước khi trao đổi.</p>}</aside>
        {selected?.status === 'ACCEPTED' ? <Thread key={`${selected.id}:${params.get('focus')}`} connection={selected} userId={userId} prefix={prefix} focus={params.get('focus')} /> : <section className="panel empty-state" role="status">
          {requestedId !== null && !selected ? 'Không tìm thấy kết nối hoặc bạn không có quyền truy cập.' : selected ? `Kết nối ${labels[selected.status].toLocaleLowerCase('vi-VN')}. Chỉ trao đổi sau khi lời mời được đồng ý.` : 'Chọn một hội thoại đã kết nối.'}
          {selected && <Link to={`${prefix}/invitations?connectionId=${encodeURIComponent(selected.id)}`}>Xem lời mời kết nối</Link>}
        </section>}</div>}
  </>;
}

function Thread({ connection, userId, prefix, focus }: { connection: Connection; userId: string; prefix: string; focus?:string|null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [draft, setDraft] = useState(''); const [price, setPrice] = useState('');
  const [tonnes, setTonnes] = useState(''); const [date, setDate] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const pendingMessage = useRef({ id: crypto.randomUUID(), body: '' });
  const refresh = useCallback(async () => { const data = await loadThread(connection.id);
    setMessages(data.messages); setOffers(data.offers); setAgreement(data.agreement); }, [connection.id]);
  useEffect(() => {
    let active = true;
    const load = async () => { try { const data = await loadThread(connection.id); if (active) {
      setMessages(data.messages); setOffers(data.offers); setAgreement(data.agreement);
    } } catch (cause) { if (active) setError(explainError(cause)); } };
    void load(); const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [connection.id]);
  async function act(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true); setError('');
    try { await action(); await refresh(); } catch (cause) { setError(explainError(cause)); } finally { setBusy(false); }
  }
  const ownCompletion = agreement && (connection.buyer_id === userId ? agreement.buyer_completed_at : agreement.farmer_completed_at);
  return <><section className="panel chat-main"><div className="chat-header"><strong>{connection.partnerName}</strong><span className="status-pill">Đã kết nối</span></div>
    <p className="context-strip">{connection.lot_title}</p><div className="chat-messages" aria-live="polite">{messages.map(message =>
      <div key={message.id} className={`message ${message.sender_id === userId ? 'buyer' : 'farmer'}`}><span>{message.body}<small>{new Date(message.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small></span></div>)}
      {messages.length === 0 && <p className="muted">Bắt đầu trao đổi với đối tác.</p>}</div>
    <small className="muted">Hiển thị tối đa 100 tin nhắn gần nhất; tự cập nhật mỗi 5 giây.</small>
    <form className="chat-compose" onSubmit={event => { event.preventDefault(); const body = draft.trim(); if (!body) return;
      if (pendingMessage.current.body !== body) pendingMessage.current = { id: crypto.randomUUID(), body };
      void act(async () => { await sendMessage(connection.id, pendingMessage.current.id, body); setDraft(''); pendingMessage.current = { id: crypto.randomUUID(), body: '' }; }); }}>
      <input autoFocus={focus==='message'} aria-label="Tin nhắn" maxLength={4000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Nhập tin nhắn…" />
      <button className="button primary" disabled={busy || !draft.trim()}>Gửi</button></form>{error && <p className="form-error" role="alert">{error}</p>}</section>
    <aside className="panel chat-side"><span className="eyebrow">Điều kiện giao dịch</span><h2>Thỏa thuận thu mua</h2>
      {agreement ? <><span className="status-pill">{labels[agreement.status]}</span><p>{formatTonnes(agreement.quantity_kg)} · {formatMoney(agreement.price_vnd_per_kg)}</p><p>Ngày lấy hàng: {formatDate(agreement.delivery_date)}</p>
        <p className="muted">Buyer: {agreement.buyer_completed_at ? 'đã xác nhận' : 'chưa xác nhận'} · Nhà vườn: {agreement.farmer_completed_at ? 'đã xác nhận' : 'chưa xác nhận'}</p>
        <button className="button primary full" disabled={busy || Boolean(ownCompletion)} onClick={() => void act(() => completeAgreement(agreement.id))}>{ownCompletion ? 'Bạn đã xác nhận hoàn tất' : 'Xác nhận đã hoàn tất giao dịch'}</button>
        {agreement.status === 'COMPLETED' ? <Link className="button primary" to={`${prefix}/reviews`}>Đánh giá giao dịch</Link> : <p className="muted">Chỉ đánh giá khi cả hai bên đã xác nhận hoàn tất.</p>}</> :
        <form onSubmit={event => { event.preventDefault(); void act(() => proposeOffer(connection.id, Number(price), Number(tonnes) * 1000, date)); }}>
          <label>Giá đề nghị (VND/kg)<input autoFocus={focus==='offer'} type="number" min="1" step="1" value={price} onChange={event => setPrice(event.target.value)} required /></label>
          <label>Khối lượng (tấn)<input type="number" min="0.001" step="0.001" value={tonnes} onChange={event => setTonnes(event.target.value)} required /></label>
          <label>Ngày lấy hàng<input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label>
          <button className="button accent full" disabled={busy}>Gửi đề nghị</button></form>}
      <p className="muted small-text">Thỏa thuận chưa tự giữ hàng hoặc xử lý thanh toán.</p>{agreement&&<Link className="button outline" to={`${prefix}/transport?${prefix==='/buyer'?'agreementId='+agreement.id:'lotId='+connection.lot_id}`}>Tìm xe cho giao dịch →</Link>}
      <h3>Đề nghị gần đây</h3>{offers.map(offer => <div className="offer-card" key={offer.id}><strong>{formatMoney(offer.price_vnd_per_kg)}</strong><p>{formatTonnes(offer.quantity_kg)} · {formatDate(offer.delivery_date)}</p>
        <small>{offer.proposed_by === userId ? 'Bạn gửi' : 'Đối tác gửi'} · {labels[offer.status]}</small>
        {offer.status === 'PENDING' && <div className="chip-row">{offer.proposed_by === userId ? <button className="button outline" disabled={busy} onClick={() => void act(() => respondOffer(offer.id, 'WITHDRAWN'))}>Rút đề nghị</button> :
          <><button className="button primary" disabled={busy} onClick={() => void act(() => respondOffer(offer.id, 'ACCEPTED'))}>Đồng ý</button><button className="button outline" disabled={busy} onClick={() => void act(() => respondOffer(offer.id, 'REJECTED'))}>Từ chối</button></>}</div>}</div>)}</aside></>;
}

function ReviewForm({ agreement, name, onSaved }: { agreement: Agreement; name: string; onSaved: () => Promise<void> }) {
  const [stars,setStars]=useState(5),[comment,setComment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <article className="panel review-entry"><h2>{name}</h2><p>Giao dịch đã hoàn tất</p><form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await submitReview(agreement.id,stars,comment.trim());await onSaved();}catch(cause){setError(explainError(cause));}finally{setBusy(false);}}}>
    <div className="rating-row" role="group" aria-label={`Chấm sao ${name}`}>{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} sao`} aria-pressed={stars===n} onClick={()=>setStars(n)}>{n<=stars?'★':'☆'}</button>)}</div>
    <label>Nhận xét<textarea className="control" required rows={3} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)}/></label><button className="button primary" disabled={busy||!comment.trim()}>{busy?'Đang lưu…':'Lưu đánh giá'}</button>{error&&<p role="alert">{error}</p>}
  </form></article>;
}
function Reviews({ userId, connections }: { userId: string; connections: Connection[] }) {
  const [reviews,setReviews]=useState<Review[]>([]),[agreements,setAgreements]=useState<Agreement[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[tab,setTab]=useState<'pending'|'sent'>('pending');
  const refresh=useCallback(async()=>{const r=await loadReviews();setReviews(r.reviews);setAgreements(r.agreements);},[]);
  useEffect(()=>{let active=true;loadReviews().then(r=>{if(active){setReviews(r.reviews);setAgreements(r.agreements);}}).catch(e=>{if(active)setError(explainError(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const sent=reviews.filter(r=>r.reviewer_id===userId),available=agreements.filter(a=>!sent.some(r=>r.agreement_id===a.id));
  const name=(id:string)=>{const c=connections.find(c=>c.id===id);return `${c?.partnerName??'Đối tác'} · ${c?.lot_title??'Giao dịch'}`;};
  return <div className="stack reviews-page"><div className="tabs" role="tablist" aria-label="Danh sách đánh giá"><button role="tab" aria-selected={tab==='pending'} onClick={()=>setTab('pending')}>Chưa đánh giá ({available.length})</button><button role="tab" aria-selected={tab==='sent'} onClick={()=>setTab('sent')}>Đã đánh giá ({sent.length})</button></div>
    {error&&<p role="alert">{error} <button className="text-link" onClick={()=>void refresh().then(()=>setError('')).catch(e=>setError(explainError(e)))}>Thử lại</button></p>}
    {loading?<p role="status">Đang tải giao dịch…</p>:tab==='pending'?<>{!available.length&&<section className="panel"><p>Chưa có giao dịch hoàn tất cần đánh giá.</p></section>}{available.map(a=><ReviewForm key={a.id} agreement={a} name={name(a.connection_id)} onSaved={async()=>{await refresh();setTab('sent');}}/>)}</>:<>{!sent.length&&<section className="panel"><p>Bạn chưa gửi đánh giá nào.</p></section>}{sent.map(r=><article className="panel review-entry" key={r.id}><h2>{name(agreements.find(a=>a.id===r.agreement_id)?.connection_id??'')}</h2><RatingStars value={r.rating}/><p>{r.comment}</p><small>{formatDate(r.created_at.slice(0,10))}</small></article>)}</>}
  </div>;
}
