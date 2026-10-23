import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCatalog } from '../catalog/api';
import { useAuth } from '../auth/AuthProvider';
import type { BuyRequest, RequestStatus } from '../../lib/domain';
import { formatDate, formatMoney, formatTonnes, explainError } from '../../lib/format';
import { changeRequestStatus, listMyRequests } from './api';

const filters: Array<{ value: 'ALL' | RequestStatus; label: string }> = [
  { value: 'ALL', label: 'Tất cả' }, { value: 'OPEN', label: 'Đang mở' },
  { value: 'DRAFT', label: 'Bản nháp' }, { value: 'CLOSED', label: 'Đã đóng' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

export function RequestListPage() {
  const { session } = useAuth();
  const [catalog,setCatalog]=useState<Awaited<ReturnType<typeof loadCatalog>>>({types:[],varieties:[]});
  const [rows, setRows] = useState<BuyRequest[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('ALL');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try { const [rows,items]=await Promise.all([listMyRequests(session.user.id),loadCatalog()]);setRows(rows);setCatalog(items); }
    catch (cause) { setError(explainError(cause)); }
    finally { setLoading(false); }
  }, [session?.user.id]);
  useEffect(() => { void reload(); }, [reload]);

  async function transition(row: BuyRequest, to: RequestStatus) {
    if (!session) return;
    setBusyId(row.id); setError('');
    try { await changeRequestStatus(row.id, session.user.id, row.status, to); await reload(); }
    catch (cause) { setError(explainError(cause)); }
    finally { setBusyId(''); }
  }

  const visible = filter === 'ALL' ? rows : rows.filter(row => row.status === filter);
  return <><div className="page-heading"><div><span className="eyebrow">Nhu cầu thu mua</span><h1>Yêu cầu của bạn</h1><p>Quản lý các nhu cầu đã lưu trên Supabase.</p></div>
    <Link to="/buyer/requests/new" className="button accent">Tạo yêu cầu</Link></div>
    <div className="tabs" role="tablist" aria-label="Lọc trạng thái">{filters.map(item =>
      <button role="tab" aria-selected={filter === item.value} key={item.value} className={filter === item.value ? 'active' : ''}
        onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
    {error && <div className="notice error" role="alert">{error} <button onClick={reload}>Thử lại</button></div>}
    {loading ? <div className="panel empty-state">Đang tải nhu cầu…</div> : visible.length === 0 ?
      <div className="panel empty-state"><div className="empty-icon">▤</div><h2>Chưa có yêu cầu trong mục này</h2>
        <p>Tạo nhu cầu thu mua để bắt đầu tìm các lô phù hợp.</p><Link className="button primary" to="/buyer/requests/new">Tạo yêu cầu</Link></div> :
      <div className="request-grid">{visible.map(row => <article className={`panel request-card request-${row.status.toLowerCase()}`} key={row.id}>
        <div className="card-top"><span className={`status-pill ${row.status.toLowerCase()}`}>{row.status === 'OPEN' ? 'Đang mở' : row.status === 'DRAFT' ? 'Bản nháp' : row.status === 'CLOSED' ? 'Đã đóng' : 'Đã hủy'}</span><small>{formatDate(row.created_at)}</small></div>
        <div><h2>{row.title}</h2><small>{catalog.types.find(x=>x.id===row.fruit_type_id)?.name} {catalog.varieties.find(x=>x.id===row.variety_id)?.name}</small></div><div className="request-meta"><span><small>Khối lượng</small><strong>{formatTonnes(row.target_quantity_kg)}</strong></span><span><small>Giá mong muốn</small><strong>{formatMoney(row.min_price_vnd_per_kg)} – {formatMoney(row.max_price_vnd_per_kg)}</strong></span><span><small>Thời gian lấy hàng</small><strong>{formatDate(row.required_start)} – {formatDate(row.required_end)}</strong></span></div>
        <div className="chip-row">{row.preferred_provinces.map(province => <span className="chip" key={province}>{province}</span>)}</div>
        <div className="card-actions"><Link className="button outline" to={`/buyer/requests/${row.id}/edit`}>Xem / sửa</Link>
          {['OPEN', 'DRAFT'].includes(row.status) && <Link className="button primary" to={`/buyer/lots?requestId=${row.id}`}>Tìm lô phù hợp</Link>}
          {row.status === 'DRAFT' && <button className="button subtle" disabled={busyId === row.id} onClick={() => transition(row, 'OPEN')}>Đăng nhu cầu</button>}
          {row.status === 'OPEN' && <button className="button subtle" disabled={busyId === row.id} onClick={() => transition(row, 'CLOSED')}>Đóng</button>}
        </div></article>)}</div>}
  </>;
}
