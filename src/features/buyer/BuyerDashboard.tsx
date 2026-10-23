import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { listMyRequests } from '../buy-requests/api';
import { listConnections } from '../trading/api';
import { supabase } from '../../lib/supabase';
import { explainError, formatMoney, formatTonnes } from '../../lib/format';
import { BuyingAreasCard } from '../farmer/dashboard/BuyingAreasCard';
import { ReviewSummary } from '../trading/ReviewSummary';
import { TransportSummary } from '../transport/TransportSummary';

import { MetricCard, LoadingState } from '../../components/shared';

interface MarketRow { fruit_name: string; lot_count: number; quantity_kg: number; min_price: number; max_price: number }
function fruitAccent(name: string) {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (normalized === 'mit') return 'jackfruit';
  if (normalized === 'sau rieng') return 'durian';
  if (normalized === 'thanh long') return 'dragonfruit';
  return 'other';
}
export function BuyerDashboard() {
  const { session } = useAuth();
  const [counts, setCounts] = useState({ open: 0, draft: 0, connections: 0 });
  const [market, setMarket] = useState<MarketRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    let active = true; if (!session) return;
    Promise.all([listMyRequests(session.user.id), listConnections(session.user.id), supabase.rpc('buyer_market_summary')])
      .then(([requests, connections, summary]) => {
        if (summary.error) throw summary.error; if (!active) return;
        setCounts({ open: requests.filter(row => row.status==='OPEN').length, draft: requests.filter(row=>row.status==='DRAFT').length,
          connections: connections.filter(row=>row.status==='ACCEPTED').length });
        setMarket(summary.data as MarketRow[]);
      }).catch(cause => { if(active) setError(explainError(cause)); }).finally(()=>{if(active)setLoading(false);});
    return () => { active=false; };
  }, [session?.user.id]);
  return <><div className="page-heading"><div><span className="eyebrow">Tổng quan · Buyer</span><h1>Nguồn hàng phù hợp, trong tầm tay.</h1><p>Theo dõi nhu cầu và các kết nối của bạn.</p></div><Link className="button accent" to="/buyer/requests/new">Tạo yêu cầu</Link></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {loading ? <LoadingState /> : <><section className="stat-grid">
      <MetricCard to="/buyer/requests" label="Yêu cầu đang mở" value={counts.open} description="Nhu cầu của bạn" />
      <MetricCard to="/buyer/requests" label="Bản nháp" value={counts.draft} description="Tiếp tục chỉnh sửa" />
      <MetricCard to="/buyer/negotiations" label="Đối tác đã kết nối" value={counts.connections} description="Hai bên đã đồng ý" /></section>
      <BuyingAreasCard userId={session!.user.id} compact supply/><section className="panel hero-panel"><span className="eyebrow">Tìm nguồn cung</span><h2>Đối chiếu nhu cầu với các lô đang bán</h2><p>Lọc loại, giống và thời gian; xem giá, lượng cùng lý do phù hợp.</p><div className="hero-actions"><Link className="button primary" to="/buyer/lots">Tìm lô hàng →</Link><Link className="button outline" to="/buyer/invitations">Xem lời mời</Link></div></section>
      <section className="panel buyer-market-summary" aria-labelledby="buyer-market-heading"><h2 id="buyer-market-heading">Nguồn cung đang công bố</h2><p className="muted">Tổng hợp từ các lô bạn có quyền xem. Đây là giá chào bán, chưa phải giá giao dịch.</p>
        <div className="buyer-market-grid">{market.map(row=><article className={`buyer-market-card fruit-${fruitAccent(row.fruit_name)}`} key={row.fruit_name}>
          <div className="buyer-market-heading"><h3>{row.fruit_name}</h3><span>{row.lot_count} lô</span></div>
          <p className="buyer-market-quantity">{formatTonnes(row.quantity_kg)}</p>
          <div className="buyer-market-price"><span>Giá chào bán</span><strong>{formatMoney(row.min_price)} – {formatMoney(row.max_price)}</strong></div>
        </article>)}</div>
        {!market.length&&<p>Chưa có lô hàng đang công bố.</p>}</section><Link className="text-link" to="/buyer/prices">Xem dự báo giá minh họa →</Link></>}
    {session&&<div className="dashboard-columns"><ReviewSummary userId={session.user.id} role="buyer"/><TransportSummary userId={session.user.id} role="buyer"/></div>}
  </>;
}
