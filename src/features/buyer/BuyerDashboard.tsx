import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { listMyRequests } from '../buy-requests/api';
import { explainError } from '../../lib/format';

export function BuyerDashboard() {
  const { session } = useAuth();
  const [counts, setCounts] = useState({ open: 0, draft: 0 });
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (session?.user.id) listMyRequests(session.user.id)
      .then(rows => { if (active) setCounts({ open: rows.filter(row => row.status === 'OPEN').length,
        draft: rows.filter(row => row.status === 'DRAFT').length }); })
      .catch(cause => { if (active) setError(explainError(cause)); });
    return () => { active = false; };
  }, [session?.user.id]);
  return <>
    <div className="page-heading"><div><span className="eyebrow">Tổng quan · Buyer</span><h1>Nguồn hàng phù hợp, trong tầm tay.</h1><p>Theo dõi nhu cầu của bạn và khám phá lô nông sản mới.</p></div>
      <Link className="button accent" to="/buyer/requests/new">＋ Tạo yêu cầu</Link></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <section className="stat-grid" aria-label="Hoạt động của bạn">
      <div className="stat-card"><span className="stat-icon">▤</span><span>Yêu cầu đang mở</span><strong>{counts.open}</strong><small>Dữ liệu từ tài khoản của bạn</small></div>
      <div className="stat-card"><span className="stat-icon amber">◫</span><span>Bản nháp</span><strong>{counts.draft}</strong><small>Có thể tiếp tục chỉnh sửa</small></div>
      <div className="stat-card"><span className="stat-icon green">⌕</span><span>Tìm nhà vườn</span><strong>Khám phá</strong><small>Lô đã công bố trên thị trường</small></div>
    </section>
    <div className="dashboard-columns">
      <section className="panel hero-panel"><span className="eyebrow">Tìm kiếm nông sản</span><h2>Khớp nhu cầu với nguồn cung</h2>
        <p>Chọn nhu cầu đang mở, xem giá, số lượng, thời gian thu hoạch và lý do lô hàng phù hợp.</p>
        <div className="hero-actions"><Link className="button primary" to="/buyer/lots">Tìm lô hàng →</Link><Link className="button outline" to="/buyer/requests">Quản lý nhu cầu</Link></div>
        <div className="hero-pattern" aria-hidden="true">◌ ◍ ◌</div>
      </section>
      <section className="panel demo-panel"><span className="demo-badge">Minh họa</span><h2>Tiến trình vận chuyển</h2>
        <div className="timeline"><span className="done">Tạo yêu cầu</span><span className="done">Đóng hàng</span><span>Đang di chuyển</span><span>Giao hàng</span></div>
        <p>Timeline trong bản thiết kế là dữ liệu mẫu. Tính năng theo dõi GPS/IoT chưa được kết nối.</p>
        <Link className="text-link" to="/buyer/transport">Xem trang vận chuyển →</Link></section>
    </div>
    <section className="panel"><div className="section-title"><div><span className="demo-badge">Minh họa</span><h2>Thị trường nông sản</h2></div></div>
      <div className="market-bars" aria-hidden="true">{[42,56,48,63,75,68,84,92,82,70,64,59].map((height, index) =>
        <div key={index}><i style={{ height: `${height}%` }} /><small>T{index + 1}</small></div>)}</div>
      <p className="muted">Biểu đồ minh họa bố cục dashboard, không đại diện số liệu giao dịch thật.</p></section>
  </>;
}
