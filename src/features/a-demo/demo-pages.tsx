import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Card, DemoNotice, EmptyState, FormLayout, PageHeader } from '../../components/shared';
import { Button, Modal, Select, TextArea, TextField } from '../../components/ui';
import { formatDate, formatVnd } from '../../lib/formatters';
import { demoPartners, demoVehicles, type DemoTransport } from '../../mocks/a-demo';
import { useADemo } from './demo-context';
import { parsePrice, parseQuantity, formatQuantity } from '../farmer/lots/lot.model';
import type { Vehicle } from '../carrier/vehicles/vehicle.model';
import { Package, Handshake, Truck } from 'lucide-react';
import { FarmerAssistantEntry } from '../farmer/assistant/farmer-assistant';

function Frame({ title, children }: { title: string; children: ReactNode }) {
  const { reset } = useADemo(); return <div className="stack"><PageHeader title={title} action={<Button variant="secondary" onClick={reset}>Đặt lại minh họa</Button>} /><DemoNotice />{children}</div>;
}
function MapList({ farmerMap = false }: { farmerMap?: boolean }) {
  const [province, setProvince] = useState(''); const [fruit, setFruit] = useState(''); const [map, setMap] = useState(true);
  const rows = demoPartners.filter(p => (!province || p.province === province) && (!fruit || p.fruit === fruit));
  return <div className="stack-sm"><div className="row"><Select label="Khu vực" value={province} onChange={e => setProvince(e.target.value)}><option value="">Tất cả</option><option>Tiền Giang</option><option>Long An</option><option>Đồng Tháp</option></Select><Select label="Loại quả minh họa" value={fruit} onChange={e => setFruit(e.target.value)}><option value="">Tất cả</option><option>Sầu riêng</option><option>Mít</option></Select><Button variant="secondary" onClick={() => setMap(v => !v)}>{map ? 'Chỉ xem danh sách' : 'Xem sơ đồ'}</Button></div>
    {map && <svg viewBox="0 0 400 140" role="img" aria-label="Sơ đồ khu vực minh họa" style={{ width: '100%', maxHeight: 180 }}><rect width="400" height="140" rx="12" fill="var(--mist)" /><path d="M20 110 Q100 10 200 80 T380 40" fill="none" stroke="var(--forest)" strokeWidth="2" />{rows.map((row, i) => <g key={row.id}><circle cx={90 + i * 180} cy={65} r="7" fill="var(--primary)" /><text x={45 + i * 180} y="100" fontSize="12" fill="var(--ink)">{row.province}</text></g>)}</svg>}
    <p className="muted">Sơ đồ minh họa khu vực, không phải bản đồ địa lý hoặc vị trí trực tiếp.</p>
    {!rows.length ? <EmptyState title="Không có đối tác minh họa phù hợp" /> : rows.map(row => <Card key={row.id} title={farmerMap ? row.name : `Vùng ${row.province}`}><p>{row.fruit} · {row.province}</p></Card>)}
  </div>;
}
export function DemoDashboard({ role }: { role: 'FARMER' | 'CARRIER' }) {
  const { state, reset } = useADemo(); const farmer = role === 'FARMER';
  return <div className="stack">
    <PageHeader eyebrow={`Tổng quan · ${farmer ? 'Nhà vườn' : 'Nhà xe'}`} title={farmer ? 'Mùa vụ sẵn sàng, kết nối người mua.' : 'Chuyến hàng tiếp nối, vững bước đường xa.'} description={farmer ? 'Quản lý lô nông sản và khám phá nhu cầu thu mua phù hợp.' : 'Quản lý đội xe và tìm yêu cầu vận chuyển phù hợp.'} action={<Link className="button button-accent" to={farmer ? '/farmer/lots/new' : '/carrier/vehicles'}>{farmer ? '＋ Tạo lô hàng' : 'Quản lý đội xe'}</Link>} />
    {farmer && <FarmerAssistantEntry />}
    <DemoNotice />
    <section className="stat-grid" aria-label="Hoạt động minh họa">
      <section className="stat-card"><span className="stat-icon"><Package size={20} aria-hidden="true" /></span><h2>{farmer ? 'Lô hàng mẫu' : 'Yêu cầu xe mẫu'}</h2><strong>{farmer ? 3 : state.transports.length}</strong><small>Dữ liệu minh họa</small></section>
      <section className="stat-card"><span className="stat-icon amber"><Handshake size={20} aria-hidden="true" /></span><h2>{farmer ? 'Nhu cầu thu mua mẫu' : 'Chuyến nhận mẫu'}</h2><strong>{farmer ? demoPartners.length : state.transports.filter(t => t.status === 'ACCEPTED').length}</strong><small>Dữ liệu minh họa</small></section>
      <section className="stat-card"><span className="stat-icon green"><Truck size={20} aria-hidden="true" /></span><h2>Vận chuyển minh họa</h2><strong>{state.transports.length}</strong><small>Yêu cầu trong phiên minh họa</small></section>
    </section>
    <div className="dashboard-columns">
      <section className="panel hero-panel"><span className="eyebrow">{farmer ? 'Kết nối thu mua' : 'Kết nối vận tải'}</span><h2>{farmer ? 'Đưa nông sản đến đúng người mua' : 'Tìm chuyến phù hợp với đội xe'}</h2><p>{farmer ? 'Chọn lô đã công bố, xem nhu cầu và lý do người mua phù hợp.' : 'Xem tuyến đường, tải trọng và thời gian trước khi báo giá minh họa.'}</p><div className="hero-actions"><Link className="button button-primary" to={farmer ? '/farmer/matches' : '/carrier/requests'}>{farmer ? 'Tìm người mua →' : 'Xem yêu cầu xe →'}</Link><Link className="button button-secondary" to={farmer ? '/farmer/lots' : '/carrier/vehicles'}>{farmer ? 'Mở danh sách lô' : 'Mở hồ sơ & xe'}</Link></div><div className="hero-pattern" aria-hidden="true">◌ ◍ ◌</div></section>
      <section className="panel demo-panel"><span className="badge badge-demo">Minh họa</span><h2>Tiến trình vận chuyển</h2><div className="timeline"><span className="done">Tạo yêu cầu</span><span>Báo giá</span><span>Nhận chuyến</span></div><p>Khám phá luồng vận chuyển mẫu. Chưa kết nối GPS hoặc giao dịch thật.</p><Link className="text-link" to={farmer ? '/farmer/transport' : '/carrier/tracking'}>Xem vận chuyển →</Link></section>
    </div>
    <Card title={farmer ? 'Khu vực thu mua' : 'Tuyến hoạt động'}><MapList farmerMap={farmer} /></Card>
    <div className="row"><Link className="text-link" to={farmer ? '/farmer/reviews' : '/carrier/reviews'}>{farmer ? 'Xem đánh giá giao dịch →' : 'Xem đánh giá minh họa →'}</Link><Button variant="secondary" onClick={reset}>Đặt lại minh họa</Button></div>
  </div>;
}
export function FarmerTransport() {
  const location = useLocation(); const raw: unknown = location.state?.transportLot;
  const snapshot = raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string' && 'title' in raw && typeof raw.title === 'string' && 'quantityKg' in raw && typeof raw.quantityKg === 'number' && Number.isFinite(raw.quantityKg) && raw.quantityKg > 0 && 'province' in raw && typeof raw.province === 'string' ? { id: raw.id, title: raw.title, quantityKg: raw.quantityKg, province: raw.province } : null;
  const { state, update } = useADemo(); const [form, setForm] = useState(() => ({ origin: snapshot?.province ?? '', destination: '', quantity: snapshot ? formatQuantity(snapshot.quantityKg, 'tonne') : '', when: '', vehicleType: 'ENCLOSED', packaging: 'Thùng carton', offer: '' }));
  const [error, setError] = useState(''); const [requestId, setRequestId] = useState(''); const [chosen, setChosen] = useState('');
  const kg = parseQuantity(form.quantity, 'tonne'); const [params] = useSearchParams(); const lotId = params.get('lotId');
  function submit(event: FormEvent) {
    event.preventDefault(); const offer = parsePrice(form.offer);
    if (!form.origin.trim() || !form.destination.trim() || !kg || !offer || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.when)) { setError('Nhập đủ điểm nhận/giao, khối lượng, thời gian và cước dương hợp lệ.'); return; }
    const id = `transport-${crypto.randomUUID()}`;
    update(previous => ({ ...previous, transports: [...previous.transports, { id, origin: form.origin.trim(), destination: form.destination.trim(), kg, when: form.when, vehicleType: form.vehicleType, packaging: form.packaging, offer, status: 'NEW' }] }));
    setRequestId(id); setChosen(''); setError('');
  }
  const request = state.transports.find(item => item.id === requestId);
  return <Frame title="Tìm xe">{snapshot && <p>Ngữ cảnh công khai: {snapshot.title} · {snapshot.quantityKg} kg · {snapshot.province}</p>}{lotId && <DemoNotice>Chuyển từ lô thật sang yêu cầu vận chuyển minh họa; không đặt xe cho đối tác.</DemoNotice>}
    <FormLayout preview={<Card title="Nhà xe gợi ý">{!request ? <EmptyState title="Nhập yêu cầu để xem xe minh họa" /> : demoVehicles.filter(v => v.capacity >= request.kg && v.type === request.vehicleType).length ? demoVehicles.filter(v => v.capacity >= request.kg && v.type === request.vehicleType).map(v => <div className="stack-sm" key={v.id}><p>{v.name}</p><Button variant="secondary" onClick={() => setChosen(v.id)}>Chọn {v.name}</Button></div>) : <EmptyState title="Không có xe mẫu đủ tải" />}</Card>}>
      <Card title="Yêu cầu vận chuyển"><form className="stack-sm" noValidate onSubmit={submit}>{([['origin', 'Điểm nhận'], ['destination', 'Điểm giao'], ['quantity', 'Khối lượng (tấn)'], ['offer', 'Cước đề xuất (đ)']] as const).map(([key, label]) => <TextField key={key} label={label} required value={form[key]} onChange={e => { setForm(v => ({ ...v, [key]: e.target.value })); setRequestId(''); setError(''); }} />)}
        <TextField label="Giờ nhận hàng" type="datetime-local" required value={form.when} onChange={e => { setForm(v => ({ ...v, when: e.target.value })); setRequestId(''); }} />
        <Select label="Loại xe yêu cầu" value={form.vehicleType} onChange={e => { setForm(v => ({ ...v, vehicleType: e.target.value })); setRequestId(''); }}><option value="ENCLOSED">Thùng kín</option><option value="REFRIGERATED">Xe lạnh</option><option value="TARPAULIN">Thùng bạt</option></Select>
        <Select label="Đóng gói" value={form.packaging} onChange={e => { setForm(v => ({ ...v, packaging: e.target.value })); setRequestId(''); }}><option>Thùng carton</option><option>Sọt nhựa</option><option>Hàng xô</option></Select>
        <Button type="submit">Tìm xe minh họa</Button>{error && <p role="alert">{error}</p>}
      </form></Card>
    </FormLayout>
    <Modal title="Tóm tắt lựa chọn xe" description="Thao tác mô phỏng, không xác nhận đặt xe thật." open={!!chosen} onOpenChange={open => { if (!open) setChosen(''); }}><p>{request?.origin} → {request?.destination}</p><p>{request?.kg} kg · {request && formatVnd(request.offer)}</p><Button onClick={() => setChosen('')}>Đóng tóm tắt</Button></Modal>
  </Frame>;
}
export function CarrierRequests({ vehicles }: { vehicles?: Vehicle[] }) {
  const { state, update } = useADemo(); const [filter, setFilter] = useState(''); const [selected, setSelected] = useState<string | null>(null); const [quote, setQuote] = useState(''); const [vehicle, setVehicle] = useState(''); const [error, setError] = useState('');
  const request = state.transports.find(t => t.id === selected); const fleet = vehicles ? vehicles.filter(v => v.active).map(v => ({ id: v.id, name: v.license_plate, capacity: v.capacity_kg, type: v.vehicle_type })) : demoVehicles;
  function confirm(accept: boolean) {
    const price = parsePrice(quote); const picked = fleet.find(v => v.id === vehicle);
    if (!request || !price || !picked || picked.capacity < request.kg || picked.type !== request.vehicleType) { setError('Chọn xe đủ tải và nhập báo giá nguyên dương.'); return; }
    update(previous => ({ ...previous, transports: previous.transports.map(t => t.id === request.id ? { ...t, quote: price, vehicleId: vehicle, status: accept ? 'ACCEPTED' : 'QUOTED' } : t) })); setSelected(null);
  }
  const rows = state.transports.filter(t => !filter || t.origin.toLowerCase().includes(filter.toLowerCase()) || t.destination.toLowerCase().includes(filter.toLowerCase()));
  return <Frame title="Yêu cầu vận chuyển"><p>{vehicles ? 'Chọn xe của bạn; báo giá/nhận chuyến vẫn là mô phỏng.' : 'Đội xe và yêu cầu đang dùng dữ liệu minh họa.'}</p><TextField label="Tìm tuyến" value={filter} onChange={e => setFilter(e.target.value)} />
    {!rows.length && <EmptyState title="Không có yêu cầu phù hợp" />}{rows.map(t => <Card key={t.id} title={`${t.origin} → ${t.destination}`}><p>{t.kg} kg · {formatVnd(t.quote ?? t.offer)} · {t.status === 'NEW' ? 'Mới' : t.status === 'QUOTED' ? 'Đã báo giá' : 'Đã nhận chuyến'} · Minh họa</p><Button variant="secondary" onClick={() => { setSelected(t.id); setQuote(String(t.quote ?? t.offer)); setVehicle(t.vehicleId ?? ''); setError(''); }}>Chi tiết / báo giá</Button></Card>)}
    <Modal title="Chi tiết / báo giá nhận chuyến" description="Không gửi báo giá hoặc nhận booking thật." open={!!request} onOpenChange={open => { if (!open) setSelected(null); }}>
      {request && <div className="stack-sm"><p>{request.origin} → {request.destination}</p><p>{request.kg} kg · {request.packaging} · {request.when.replace('T', ' ')}</p><Select label="Chọn xe" value={vehicle} onChange={e => setVehicle(e.target.value)}><option value="">Chọn xe</option>{fleet.map(v => <option key={v.id} value={v.id} disabled={v.capacity < request.kg || v.type !== request.vehicleType}>{v.name} · {v.capacity} kg</option>)}</Select><TextField label="Báo giá (đ)" value={quote} onChange={e => setQuote(e.target.value)} /><div className="row"><Button onClick={() => confirm(false)}>Báo giá minh họa</Button><Button onClick={() => confirm(true)}>Nhận chuyến minh họa</Button></div>{error && <p role="alert">{error}</p>}</div>}
    </Modal>
  </Frame>;
}
export function CarrierTracking() {
  const { state } = useADemo(); const [id, setId] = useState(''); const selected = state.transports.find(t => t.id === id); const steps = ['Yêu cầu đã tạo', 'Nhà xe báo giá', 'Nhận chuyến minh họa'];
  return <Frame title="Theo dõi chuyến"><Select label="Chọn yêu cầu theo dõi" value={id} onChange={e => setId(e.target.value)}><option value="">Chọn yêu cầu</option>{state.transports.map(t => <option key={t.id} value={t.id}>{t.origin} → {t.destination}</option>)}</Select>
    {!selected ? <EmptyState title="Chưa chọn chuyến" /> : <Card title="Tiến trình minh họa"><p>{selected.origin} → {selected.destination}</p><ol className="trip-timeline">{steps.map((step, i) => <li key={step} data-complete={i <= (selected.status === 'NEW' ? 0 : selected.status === 'QUOTED' ? 1 : 2)}>{step} · {i <= (selected.status === 'NEW' ? 0 : selected.status === 'QUOTED' ? 1 : 2) ? 'Đã đạt' : 'Chưa đạt'}</li>)}</ol><p>Không có GPS trực tiếp hoặc xác nhận giao hàng thật.</p></Card>}
  </Frame>;
}
export function FarmerChat() {
  const location = useLocation(); const deal = location.state?.demoDeal;
  // Only a public, explicitly selected snapshot enters a simulated conversation.
  const contextPartner = deal && typeof deal.partnerId === 'string' && typeof deal.name === 'string' && typeof deal.fruit === 'string' && Number.isFinite(deal.quantity) && deal.quantity > 0 && Number.isFinite(deal.price) && deal.price > 0
    ? { id: deal.partnerId as string, name: deal.name as string, fruit: deal.fruit as string, quantity: deal.quantity as number, price: deal.price as number, province: typeof deal.province === 'string' ? deal.province : '' } : null;
  const partners = contextPartner ? [contextPartner, ...demoPartners.filter(p => p.id !== contextPartner.id)] : demoPartners;
  const { state, update } = useADemo(); const [params] = useSearchParams(); const [selected, setSelected] = useState(params.get('partnerId') ?? ''); const [view, setView] = useState('list');
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [confirm, setConfirm] = useState(false); const partner = partners.find(p => p.id === selected);
  function send(e: FormEvent) { e.preventDefault(); if (!text.trim() || !partner) { setError('Chọn hội thoại và nhập tin nhắn.'); return; } update(p => ({ ...p, messages: [...p.messages, { id: crypto.randomUUID(), partnerId: partner.id, text: text.trim(), mine: true }] })); setText(''); setError(''); }
  return <Frame title="Đàm phán"><DemoNotice>Hội thoại minh họa; tin nhắn không được gửi tới đối tác.</DemoNotice><div className="a-chat" data-view={view}>
    <section className="card a-chat-list" aria-label="Danh sách hội thoại"><h2>Hội thoại</h2>{partners.map(p => <Button key={p.id} variant="ghost" onClick={() => { setSelected(p.id); setView('conversation'); }}>{p.name}</Button>)}</section>
    <section className="card a-chat-conversation" aria-label="Tin nhắn"><Button variant="secondary" onClick={() => setView('list')}>Danh sách hội thoại</Button>{!partner ? <EmptyState title="Chọn hội thoại để bắt đầu" /> : <div className="stack-sm"><h2>{partner.name}</h2><div aria-live="polite">{state.messages.filter(m => m.partnerId === partner.id).map(m => <p key={m.id}><strong>{m.mine ? 'Bạn' : partner.name}:</strong> {m.text}</p>)}</div><form onSubmit={send} className="stack-sm"><TextArea label="Tin nhắn minh họa" value={text} onChange={e => setText(e.target.value)} /><Button type="submit">Gửi minh họa</Button></form><Button variant="secondary" onClick={() => setView('detail')}>Thông tin trao đổi</Button>{error && <p role="alert">{error}</p>}</div>}</section>
    <section className="card a-chat-detail" aria-label="Thông tin trao đổi"><Button variant="secondary" onClick={() => setView('conversation')}>Quay lại hội thoại</Button>{!partner ? <p>Chưa chọn đối tác.</p> : <div className="stack-sm"><h2>Thông tin trao đổi</h2><p>{partner.fruit} · {partner.quantity.toLocaleString('vi-VN')} kg · {formatVnd(partner.price)}/kg</p><p>{params.get('lotId') ? 'Đang trao đổi từ một lô của bạn; giao dịch chỉ minh họa.' : 'Ngữ cảnh lô Ri6 mẫu, dữ liệu minh họa.'}</p><Button onClick={() => setConfirm(true)}>Xác nhận đàm phán minh họa</Button>{state.confirmations.includes(partner.id) && <p>Đã xác nhận minh họa.</p>}<Link to="/farmer/transport">Tìm xe minh họa</Link></div>}</section>
  </div><Modal title="Xác nhận đàm phán" description="Tóm tắt minh họa, không tạo đơn hàng hoặc hợp đồng thật." open={confirm} onOpenChange={setConfirm}><p>{partner?.name} · {partner?.fruit} · {partner && formatVnd(partner.price)}/kg</p><Button onClick={() => { if (partner) update(p => ({ ...p, confirmations: [...new Set([...p.confirmations, partner.id])] })); setConfirm(false); }}>Xác nhận minh họa</Button></Modal></Frame>;
}
export function DemoReviews({ role }: { role: 'FARMER' | 'CARRIER' }) {
  const { state, update } = useADemo(); const [tab, setTab] = useState('received'); const [stars, setStars] = useState(''); const [text, setText] = useState(''); const [error, setError] = useState('');
  const all = state.reviews.filter(r => r.role === role); const received = all.filter(r => !r.sent); const rows = all.filter(r => r.sent === (tab === 'sent'));
  function submit(e: FormEvent) { e.preventDefault(); if (![1, 2, 3, 4, 5].includes(Number(stars))) { setError('Chọn từ một đến năm sao.'); return; } update(p => ({ ...p, reviews: [...p.reviews, { id: crypto.randomUUID(), role, author: 'Bạn', stars: Number(stars), text: text.trim(), sent: true }] })); setTab('sent'); setText(''); setStars(''); setError(''); }
  return <Frame title={role === 'FARMER' ? 'Đánh giá & tín nhiệm' : 'Đánh giá tài xế'}><Card title="Điểm minh họa"><p>{received.length ? (received.reduce((n, r) => n + r.stars, 0) / received.length).toFixed(1) : 'Chưa có điểm'} / 5</p>{[5, 4, 3, 2, 1].map(star => <p key={star}>{star} sao: {received.filter(r => r.stars === star).length}</p>)}</Card><Select label="Nhóm đánh giá" value={tab} onChange={e => setTab(e.target.value)}><option value="received">Đã nhận</option><option value="sent">Đã gửi</option></Select>
    {!rows.length ? <EmptyState title="Chưa có đánh giá" /> : rows.map(r => <Card key={r.id} title={`${r.author} · ${r.stars} sao`}><p>{r.text || 'Không có nhận xét.'}</p></Card>)}
    <Card title="Gửi đánh giá minh họa"><form onSubmit={submit} className="stack-sm"><Select label="Số sao" value={stars} onChange={e => setStars(e.target.value)}><option value="">Chọn sao</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</Select><TextArea label="Nhận xét" value={text} onChange={e => setText(e.target.value)} /><Button type="submit">Gửi đánh giá minh họa</Button>{error && <p role="alert">{error}</p>}</form></Card>
  </Frame>;
}
export function FarmerPrices() {
  const [fruit, setFruit] = useState(''); const [province, setProvince] = useState(''); const rows = demoPartners.filter(p => (!fruit || p.fruit === fruit) && (!province || p.province === province));
  return <Frame title="Giá tham khảo"><p>Nguồn: dữ liệu giả lập nội bộ ngày {formatDate('2026-10-15')}; không dùng làm cam kết giá giao dịch.</p><Select label="Loại quả tham khảo" value={fruit} onChange={e => setFruit(e.target.value)}><option value="">Tất cả</option><option>Sầu riêng</option><option>Mít</option><option>Thanh long</option></Select><Select label="Tỉnh tham khảo" value={province} onChange={e => setProvince(e.target.value)}><option value="">Tất cả</option><option>Tiền Giang</option><option>Long An</option></Select>{!rows.length ? <EmptyState title="Chưa có giá minh họa" /> : rows.map(p => <Card key={p.id} title={p.fruit}><p>{p.province} · {formatVnd(p.price)}/kg</p></Card>)}</Frame>;
}
export function FarmerWeather() {
  const [province, setProvince] = useState('Tiền Giang');
  return <Frame title="Thời tiết & khuyến nghị"><Select label="Tỉnh xem thời tiết" value={province} onChange={e => setProvince(e.target.value)}><option>Tiền Giang</option><option>Long An</option><option>Đồng Tháp</option></Select>{province === 'Đồng Tháp' ? <EmptyState title="Chưa có dữ liệu minh họa tại khu vực" /> : <><Card title="Dự báo mẫu"><p>{province} · 29°C · Có thể mưa · Dữ liệu minh họa</p></Card><Card title="Khuyến nghị mẫu"><p>Kiểm tra che phủ hàng và trao đổi thời gian thu hoạch, vận chuyển khi có mưa.</p><p>Thông tin mẫu, chưa kết nối dịch vụ dự báo.</p></Card></>}</Frame>;
}
export function FarmerMap() { return <Frame title="Bản đồ thương lái"><MapList farmerMap /></Frame>; }
export function FarmerNotifications() {
  const { state, update } = useADemo(); const [selected, setSelected] = useState(''); const notices = [{ id: 'notice-demo-1', title: 'Nhắc kiểm tra lịch thu hoạch', body: 'Kiểm tra lại khối lượng dự kiến trước khi trao đổi với thương lái.' }];
  return <Frame title="Thông báo / chính sách">{notices.map(n => <Card key={n.id} title={n.title}><p>{state.readNotifications.includes(n.id) ? 'Đã xem · Minh họa' : 'Chưa xem · Minh họa'}</p><Button variant="secondary" onClick={() => { setSelected(n.id); update(p => ({ ...p, readNotifications: [...new Set([...p.readNotifications, n.id])] })); }}>Mở thông báo</Button></Card>)}<Card title="Chính sách"><p>Chưa có nội dung chính sách chính thức. Nội dung này sẽ được bổ sung sau khi được duyệt.</p></Card><Modal title="Thông báo minh họa" description="Nội dung mẫu, không phải thông báo hệ thống thực." open={!!selected} onOpenChange={open => { if (!open) setSelected(''); }}><p>{notices.find(n => n.id === selected)?.body}</p></Modal></Frame>;
}
