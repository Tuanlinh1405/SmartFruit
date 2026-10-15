import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

type Fixture = { id: string; name: string; province: string; description: string; kind: 'buyers' | 'farmers' | 'carriers' };
const initial: Fixture[] = [
  { id: 'b1', name: 'Nông sản Vạn Đạt', province: 'Đồng Nai', description: 'Thu mua sầu riêng, mít', kind: 'buyers' },
  { id: 'b2', name: 'Thu mua An Bình', province: 'Tây Ninh', description: 'Thu mua thanh long', kind: 'buyers' },
  { id: 'f1', name: 'Nhà vườn Minh Út', province: 'Đồng Nai', description: 'Sầu riêng Ri6, Monthong', kind: 'farmers' },
  { id: 'f2', name: 'Hợp tác xã An Phú', province: 'Lâm Đồng', description: 'Mít Thái, sầu riêng', kind: 'farmers' },
  { id: 'f3', name: 'Vườn Thanh Long Bình An', province: 'Tây Ninh', description: 'Thanh long ruột đỏ', kind: 'farmers' },
  { id: 'c1', name: 'Vận tải Minh Phát', province: 'Đồng Nai', description: 'Xe lạnh và mui bạt', kind: 'carriers' },
];
const title: Record<string, string> = { buyers: 'Thương lái', farmers: 'Nhà vườn', carriers: 'Đơn vị vận tải',
  marketplace: 'Thị trường', connections: 'Kết nối', transport: 'Yêu cầu xe',
  settings: 'Cấu hình', policy: 'Chính sách' };
const marketplace = [
  { id: 'm1', label: 'Sầu riêng Ri6 · 15 tấn', owner: 'Nhà vườn Minh Út', status: 'Đang bán' },
  { id: 'm2', label: 'Mít Thái · 8 tấn', owner: 'HTX An Phú', status: 'Đang bán' },
  { id: 'm3', label: 'Thu mua Ri6 · 50 tấn', owner: 'Nông sản Vạn Đạt', status: 'Đang tìm' },
  { id: 'm4', label: 'Thu mua thanh long · 20 tấn', owner: 'Thu mua An Bình', status: 'Đang tìm' },
];
const initialConnections = [
  { id: 'c1', buyer: 'Nông sản Vạn Đạt', farmer: 'Nhà vườn Minh Út', item: 'Ri6 · 15 tấn', status: 'Chờ phản hồi' },
  { id: 'c2', buyer: 'Thu mua An Bình', farmer: 'Vườn Bình An', item: 'Thanh long · 10 tấn', status: 'Đang trao đổi' },
];

export function AdminPage() {
  const { section, view } = useParams();
  const current = section || '';
  const [rows, setRows] = useState(initial);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Fixture | null>(null);
  const [connections, setConnections] = useState(initialConnections);
  const [tab, setTab] = useState<'lots' | 'requests'>('lots');
  const [editing, setEditing] = useState<Fixture | null>(null);
  const [name, setName] = useState('');
  const visible = useMemo(() => rows.filter(row => (!current || current === row.kind) &&
    `${row.name} ${row.province}`.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN'))), [rows, current, search]);
  const list = ['buyers', 'farmers', 'carriers'].includes(current);
  const pages = Math.max(1, Math.ceil(visible.length / 2));
  const shown = visible.slice((Math.min(page, pages) - 1) * 2, Math.min(page, pages) * 2);
  function startEdit(row: Fixture) { setEditing(row); setName(row.name); }
  return <><div className="page-heading"><div><span className="eyebrow">Quản trị LogStar</span><h1>{title[current] || 'Tổng quan hệ thống'}</h1>
    <p>Giao diện quản trị theo bộ thiết kế · dữ liệu minh họa.</p></div><button className="button outline" onClick={() => { setRows(initial); setConnections(initialConnections); setSearch(''); setPage(1); }}>Đặt lại demo</button></div>
    <div className="notice demo-notice"><span className="demo-badge">Dữ liệu minh họa</span> Chỉnh sửa và xóa trong khu vực Admin chỉ tác động fixture trên màn hình.</div>
    {!current ? <><div className="stat-grid">{(['buyers','farmers','carriers'] as const).map(kind => <div className="stat-card" key={kind}>
      <span className="stat-icon">▦</span><span>{title[kind]}</span><strong>{rows.filter(row => row.kind === kind).length}</strong><small>Dữ liệu fixture</small></div>)}</div>
      <section className="panel"><h2>Hoạt động quản trị</h2><p>Chọn một nhóm ở thanh điều hướng để xem danh sách và mô phỏng thao tác quản lý.</p></section></> :
      list ? <><section className="panel admin-filter"><label>Tìm kiếm {title[current]?.toLowerCase()}<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tên hoặc tỉnh…" /></label><span>{visible.length} tài khoản mẫu</span>
        {current !== 'carriers' && <Link className="button outline" to={`/admin/${current}/map`}>{view === 'map' ? 'Bản đồ đang mở' : 'Xem bản đồ mẫu →'}</Link>}</section>
        {view === 'map' && current !== 'carriers' && <section className="panel demo-map"><span className="demo-badge">Bản đồ tỉnh minh họa</span><div className="demo-map-grid">{['Lâm Đồng', 'Đồng Nai', 'Tây Ninh'].map(province =>
          <div key={province}><span className="map-pin">●</span><strong>{province}</strong><small>{visible.filter(row => row.province === province).length} hồ sơ mẫu</small></div>)}</div>
          <p className="muted">Vị trí ô chỉ minh họa nhóm tỉnh, không phải tọa độ địa lý.</p></section>}
        <div className="admin-cards">{shown.map(row => <article className="panel admin-card" key={row.id}><div className="admin-card-mark">✳</div>
          <div><span className="eyebrow">{title[row.kind]} · {row.province}</span><h2>{row.name}</h2><p>{row.description}</p></div>
          <div className="admin-card-actions"><button className="button outline" onClick={() => setDetail(row)}>Chi tiết</button><button className="button outline" onClick={() => startEdit(row)}>Chỉnh sửa</button><button className="button danger" onClick={() => setRows(rows.filter(item => item.id !== row.id))}>Xóa mẫu</button></div></article>)}</div>
        {visible.length === 0 && <div className="panel empty-state">Không có dữ liệu phù hợp.</div>}
        {pages > 1 && <div className="pagination"><button className="button outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Trước</button><span>Trang {Math.min(page, pages)} / {pages}</span><button className="button outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Tiếp →</button></div>}</> :
      current === 'marketplace' ? <section className="panel"><div className="tab-row"><button className={tab === 'lots' ? 'active' : ''} onClick={() => setTab('lots')}>Lô hàng</button><button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Nhu cầu</button></div>
        <div className="admin-cards">{marketplace.filter(row => tab === 'lots' ? row.id.startsWith('m1') || row.id.startsWith('m2') : row.id.startsWith('m3') || row.id.startsWith('m4')).map(row =>
          <article className="admin-card" key={row.id}><div className="admin-card-mark">✳</div><div><h2>{row.label}</h2><p>{row.owner}</p></div><span className="status-pill">{row.status}</span></article>)}</div></section> :
      current === 'connections' || current === 'transport' ? <section className="panel"><span className="demo-badge">Luồng minh họa</span><h2>{current === 'transport' ? 'Điều phối vận chuyển' : 'Kết nối đối tác'}</h2>
        <div className="admin-cards">{connections.map(row => <article className="admin-card" key={row.id}><div className="admin-card-mark">↔</div><div><h3>{row.buyer} ↔ {row.farmer}</h3><p>{row.item}</p></div>
          <span className="status-pill">{current === 'transport' ? 'Chưa đặt xe' : row.status}</span>
          {current === 'connections' && <button className="button outline" onClick={() => setConnections(previous => previous.map(item => item.id === row.id ? { ...item, status: 'Đã xem' } : item))}>Đánh dấu đã xem</button>}</article>)}</div></section> :
      <section className="panel narrow"><span className="demo-badge">Minh họa / Placeholder</span><h2>{title[current] || 'Quản trị'}</h2>
        <p>Cấu hình, chính sách, giá và thanh toán chờ nội dung được duyệt; chưa xử lý giao dịch trong MVP.</p></section>}
    {detail && <div className="modal-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) setDetail(null); }}><section className="modal admin-modal" role="dialog" aria-modal="true" aria-label="Chi tiết fixture">
      <div className="modal-header"><h2>{detail.name}</h2><button className="icon-button" aria-label="Đóng" onClick={() => setDetail(null)}>×</button></div>
      <div className="modal-body"><p><strong>Nhóm:</strong> {title[detail.kind]}</p><p><strong>Tỉnh:</strong> {detail.province}</p><p>{detail.description}</p><p className="muted">Mã hồ sơ mẫu: {detail.id}. Không hiển thị mật khẩu.</p></div>
      <div className="modal-footer"><button className="button primary" onClick={() => setDetail(null)}>Đóng</button></div></section></div>}
    {editing && <div className="modal-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) setEditing(null); }}><section className="modal admin-modal" role="dialog" aria-modal="true" aria-label="Chỉnh sửa fixture">
      <div className="modal-header"><h2>Chỉnh sửa dữ liệu mẫu</h2><button className="icon-button" onClick={() => setEditing(null)}>×</button></div>
      <div className="modal-body"><label>Tên hiển thị<input value={name} onChange={event => setName(event.target.value)} /></label></div>
      <div className="modal-footer"><button className="button outline" onClick={() => setEditing(null)}>Hủy</button>
        <button className="button primary" disabled={!name.trim()} onClick={() => { setRows(rows.map(row => row.id === editing.id ? { ...row, name: name.trim() } : row)); setEditing(null); }}>Lưu mẫu</button></div></section></div>}
  </>;
}
