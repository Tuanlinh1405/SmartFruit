import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { explainError, formatDate, formatTonnes } from '../../lib/format';
import { DeferredPage } from '../deferred/DeferredPage';
import { Modal } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/fields';
import { closeListing, getConnections, getDirectory, getMarketplace, updateMember,
  type AdminConnection, type AdminListing, type Member } from './api';

const titles: Record<string, string> = { buyers: 'Thương lái', farmers: 'Nhà vườn', carriers: 'Đơn vị vận tải',
  marketplace: 'Thị trường', connections: 'Kết nối & thỏa thuận', users: 'Quản lý người dùng', lots: 'Quản lý lô hàng', requests: 'Nhu cầu thu mua' };
const roles: Record<string, string> = { buyers: 'BUYER', farmers: 'FARMER', carriers: 'CARRIER' };
const states: Record<string, string> = { OPEN: 'Đang mở', PUBLISHED: 'Đang bán', DRAFT: 'Nháp', CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy', PENDING: 'Chờ phản hồi', ACCEPTED: 'Đã kết nối', DECLINED: 'Đã từ chối', AGREED: 'Đã thống nhất', COMPLETED: 'Đã hoàn tất' };
export function AdminPage() {
  const { section: routeSection = '' } = useParams(); const location = useLocation();
  const section = routeSection === 'dashboard' ? '' : routeSection;
  const isMap = location.pathname.endsWith('/map');
  const [members, setMembers] = useState<Member[]>([]); const [listings, setListings] = useState<AdminListing[]>([]);
  const [connections, setConnections] = useState<AdminConnection[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [tab, setTab] = useState<'lot' | 'request'>('lot');
  const [roleFilter,setRoleFilter]=useState('');
  const marketTab = section==='requests'?'request':section==='lots'?'lot':tab;
  const [editing, setEditing] = useState<Member | null>(null); const [detail, setDetail] = useState<Member | null>(null);
  const refresh = useCallback(async () => { const [people, market, trades] = await Promise.all([getDirectory(), getMarketplace(), getConnections()]);
    setMembers(people); setListings(market); setConnections(trades); }, []);
  useEffect(() => { let active = true; Promise.all([getDirectory(), getMarketplace(), getConnections()]).then(([people, market, trades]) => {
    if (active) { setMembers(people); setListings(market); setConnections(trades); }
  }).catch(cause => { if (active) setError(explainError(cause)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  useEffect(() => { setPage(1); setSearch(''); }, [section]);
  const filtered = useMemo(() => members.filter(row => (!roles[section] || row.role === roles[section]) &&
    (section!=='users'||!roleFilter||row.role===roleFilter) &&
    `${row.full_name} ${row.display_name} ${row.province}`.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN'))), [members, section, search,roleFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10)); const shown = filtered.slice((Math.min(page,pages)-1)*10, Math.min(page,pages)*10);
  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setSuccess(''); try { await action(); await refresh(); setSuccess(message); }
    catch (cause) { setError(explainError(cause)); } finally { setBusy(false); }
  }
  if (['transport','transports','settings','policy'].includes(section)) return <DeferredPage kind={section==='transports'?'transport':section} />;
  return <><div className="page-heading"><div><span className="eyebrow">Quản trị LogStar</span><h1>{titles[section] || 'Tổng quan hệ thống'}</h1>
    <p>Dữ liệu từ Supabase. Thay đổi được lưu vào hệ thống.</p></div><button className="button outline" disabled={busy} onClick={() => void act(refresh, 'Đã tải dữ liệu mới.')}>Tải lại</button></div>
    {error && !editing && <p className="notice error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}
    {loading ? <div className="panel empty-state">Đang tải dữ liệu quản trị…</div> : !section ? <><div className="stat-grid">{Object.entries(roles).map(([key, role]) =>
      <Link className="stat-card" to={`/admin/${key}`} key={role}><span>{titles[key]}</span><strong>{members.filter(row => row.role === role).length}</strong><small>{members.filter(row => row.role === role && row.is_suspended).length} tài khoản đang khóa</small></Link>)}</div>
      <div className="dashboard-columns"><section className="panel"><h2>Thị trường</h2><p>{listings.filter(row => row.status === 'PUBLISHED').length} lô đang công bố</p><p>{listings.filter(row => row.status === 'OPEN').length} nhu cầu đang mở</p><Link className="text-link" to="/admin/marketplace">Quản lý tin →</Link></section>
        <section className="panel"><h2>Giao dịch</h2><p>{connections.length} kết nối · {connections.filter(row => row.agreement_status === 'COMPLETED').length} thỏa thuận hoàn tất</p><Link className="text-link" to="/admin/connections">Xem kết nối →</Link></section></div></> :
      roles[section] || section==='users' ? <><section className="panel admin-filter"><label>Tìm theo tên hoặc tỉnh<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><span>{filtered.length} hồ sơ</span>
        {section==='users'&&<label>Vai trò<select value={roleFilter} onChange={event=>{setRoleFilter(event.target.value);setPage(1);}}><option value="">Tất cả</option><option value="BUYER">Thương lái</option><option value="FARMER">Nhà vườn</option><option value="CARRIER">Nhà xe</option><option value="ADMIN">Quản trị</option></select></label>}
        <Link className="button outline" to={isMap ? `/admin/${section}` : `/admin/${section}/map`}>{isMap ? 'Xem danh sách' : 'Phân bố theo tỉnh'}</Link></section>
        {isMap && <section className="panel"><h2>Phân bố hồ sơ theo tỉnh</h2><p className="muted">Tổng hợp theo tỉnh khai báo; chưa có bản đồ tọa độ.</p><div className="province-grid">{[...new Set(filtered.map(row => row.province || 'Chưa khai báo'))].map(province =>
          <div className="offer-card" key={province}><strong>{province}</strong><p>{filtered.filter(row => (row.province || 'Chưa khai báo') === province).length} hồ sơ</p></div>)}</div></section>}
        <div className="admin-cards">{shown.map(row => <article className="panel admin-card" key={row.id}><div className="admin-card-mark">✳</div><div><span className="eyebrow">{row.province || 'Chưa khai báo tỉnh'}</span><h2>{row.display_name || row.full_name}</h2><p>{row.full_name}</p></div>
          <span className="status-pill">{row.is_suspended ? 'Đang khóa' : 'Hoạt động'}</span><div className="admin-card-actions"><button className="button outline" onClick={() => setDetail(row)}>Chi tiết</button><button className="button primary" onClick={() => setEditing({ ...row })}>Chỉnh sửa</button></div></article>)}</div>
        {!filtered.length && <div className="panel empty-state">Không có hồ sơ phù hợp.</div>}
        {pages > 1 && <div className="pagination"><button className="button outline" disabled={page<=1} onClick={() => setPage(page-1)}>← Trước</button><span>Trang {Math.min(page,pages)} / {pages}</span><button className="button outline" disabled={page>=pages} onClick={() => setPage(page+1)}>Tiếp →</button></div>}</> :
      ['marketplace','lots','requests'].includes(section) ? <section className="panel">{section==='marketplace'&&<div className="tab-row"><button className={tab==='lot'?'active':''} onClick={() => setTab('lot')}>Lô hàng</button><button className={tab==='request'?'active':''} onClick={() => setTab('request')}>Nhu cầu</button></div>}
        <div className="admin-cards">{listings.filter(row => row.kind === marketTab).map(row => <article className="admin-card" key={row.id}><div><h3>{row.title}</h3><p>{row.owner_name} · {row.province} · {formatTonnes(row.quantity_kg)}</p></div><span className="status-pill">{states[row.status] || row.status}</span>
          {['OPEN','PUBLISHED'].includes(row.status) && <button className="button outline" disabled={busy} onClick={() => void act(() => closeListing(row), 'Đã đóng tin trên hệ thống.')}>Đóng tin</button>}</article>)}</div>
        {!listings.some(row => row.kind===marketTab) && <p className="muted">Chưa có tin.</p>}</section> :
      <section className="panel"><h2>Kết nối & thỏa thuận</h2><p className="muted">Thông tin tổng quan; nội dung tin nhắn riêng không được hiển thị ở đây.</p><div className="admin-cards">{connections.map(row => <article className="admin-card" key={row.id}><div><h3>{row.buyer_name} ↔ {row.farmer_name}</h3><p>{row.lot_title} · {formatDate(row.created_at.slice(0,10))}</p></div><span className="status-pill">{states[row.agreement_status || row.status] || row.status}</span></article>)}</div>{!connections.length && <p className="muted">Chưa có kết nối.</p>}</section>}
    {detail && <Modal open title="Chi tiết tài khoản" description={detail.display_name} onOpenChange={open=>{if(!open)setDetail(null);}}>
      <div className="modal-body"><p>{detail.full_name}</p><p>{detail.role} · {detail.province}</p><p>Mã tài khoản: {detail.id}</p><p>{detail.is_suspended ? 'Đang khóa' : 'Đang hoạt động'}</p></div></Modal>}
    {editing && <Modal open title="Chỉnh sửa tài khoản" description="Thay đổi được lưu vào hồ sơ thật trên hệ thống." onOpenChange={open=>{if(!open&&!busy)setEditing(null);}}><form onSubmit={event => { event.preventDefault(); void act(async () => { await updateMember(editing); setEditing(null); }, 'Đã lưu hồ sơ tài khoản.'); }}>
      <div className="modal-body"><TextField label="Họ tên" value={editing.full_name} maxLength={160} onChange={event => setEditing({ ...editing, full_name:event.target.value })} required />
        <TextField label="Tên đơn vị" value={editing.display_name} maxLength={160} onChange={event => setEditing({ ...editing, display_name:event.target.value })} required /><TextField label="Tỉnh" value={editing.province} maxLength={120} onChange={event => setEditing({ ...editing, province:event.target.value })} required />
        <label className="checkbox-field"><input type="checkbox" disabled={editing.role==='ADMIN'} checked={editing.is_suspended} onChange={event => setEditing({ ...editing, is_suspended:event.target.checked })} /> Khóa quyền dùng ứng dụng</label>
        <p className="muted">Khóa tài khoản giữ lại hồ sơ và lịch sử. Thay đổi vai trò, mật khẩu và xóa tài khoản thuộc quy trình quản trị Auth riêng.</p>{error && <p className="form-error" role="alert">{error}</p>}</div><div className="modal-footer"><Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>Hủy</Button><Button type="submit" loading={busy}>Lưu thay đổi</Button></div></form></Modal>}
  </>;
}
