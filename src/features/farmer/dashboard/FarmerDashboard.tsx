import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, FilePenLine, CircleCheck, Handshake, Truck, Star, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader, ErrorState, LoadingState, MetricCard } from '../../../components/shared';
import { Tabs } from '../../../components/ui/tabs';
import { loadRoleSummary } from '../../workspace/RoleDashboard';
import { FarmerAssistantEntry } from '../assistant/farmer-assistant';
import { WeatherCard } from './WeatherCard';
import { BuyingAreasCard } from './BuyingAreasCard';
import './dashboard.css';

const dashboardTabs = ['overview', 'prices', 'weather', 'map'];
function LotSummary({ userId }: { userId: string }) {
  const summary = useQuery({ queryKey: ['role-summary', userId, 'FARMER'], enabled: !!userId, retry: false, queryFn: () => loadRoleSummary(userId, 'FARMER') });
  if (summary.isPending) return <LoadingState />;
  if (summary.isError) return <ErrorState message="Không thể tải thống kê lô hàng." onRetry={() => void summary.refetch()} />;
  return <section className="farmer-summary" aria-label="Thống kê lô hàng">{[
    { label: 'Lô đang công bố', icon: Package }, { label: 'Lô nháp', icon: FilePenLine }, { label: 'Lô đã đóng', icon: CircleCheck },
  ].map(({ label, icon: Icon }, index) => <MetricCard key={label} label={label} value={summary.data[index]} icon={Icon} />)}</section>;
}

export default function FarmerDashboard() {
  const { session } = useAuth(); const id = session?.user.id ?? '';
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') ?? 'overview';
  const tab = dashboardTabs.includes(requested) ? requested : 'overview';
  const [visited, setVisited] = useState(() => new Set([tab]));
  useEffect(() => { setVisited(previous => previous.has(tab) ? previous : new Set([...previous, tab])); }, [tab]);
  const changeTab = (value: string) => { const next = new URLSearchParams(params); if (value === 'overview') next.delete('tab'); else next.set('tab', value); setParams(next, { replace: true }); };
  return <div className="farmer-dashboard stack" key={id}>
    <PageHeader eyebrow="Không gian nhà vườn" title="Tổng quan nhà vườn" description="Quản lý lô hàng và theo dõi thông tin phục vụ mùa vụ."
      action={<Link className="button button-primary" to="/farmer/lots/new"><Plus size={16} aria-hidden="true" />Tạo lô hàng</Link>} />
    <Tabs label="Tiện ích nhà vườn" value={tab} onChange={changeTab} items={[
      { value: 'overview', label: 'Tổng quan', content: <div className="farmer-overview stack">
        <LotSummary userId={id} />
        <div className="farmer-overview-grid"><FarmerAssistantEntry />
          <section className="panel farmer-matching"><span className="farmer-feature-icon"><Handshake size={22} aria-hidden="true" /></span><h2>Kết nối người mua</h2><p>Chọn lô đã công bố và tìm nhu cầu thu mua phù hợp.</p><div className="hero-actions"><Link className="button button-primary" to="/farmer/matches">Tìm người mua →</Link><Link className="text-link" to="/farmer/lots">Danh sách lô hàng</Link></div></section>
        </div>
        <div className="farmer-shortcuts"><Link to="/farmer/transport"><Truck size={18} aria-hidden="true" /><span>Vận chuyển<small>Xem thông tin dịch vụ</small></span><span aria-hidden="true">→</span></Link><Link to="/farmer/reviews"><Star size={18} aria-hidden="true" /><span>Đánh giá giao dịch<small>Theo dõi tín nhiệm</small></span><span aria-hidden="true">→</span></Link></div>
      </div> },
      { value: 'prices', label: 'Giá tham khảo', content: <section className="panel farmer-reference-prices" aria-label="Giá tham khảo"><h2>Giá tham khảo</h2><p>Chưa có nguồn giá thị trường được tích hợp.</p><p className="muted">Bạn có thể xem giá chào của các lô hàng và khoảng giá thu mua đã được đăng trên hệ thống.</p><Link className="text-link" to="/farmer/lots">Xem giá chào lô hàng →</Link></section> },
      { value: 'weather', label: 'Thời tiết & khuyến nghị', content: (tab === 'weather' || visited.has('weather')) && <div className="farmer-dashboard-live farmer-dashboard-weather"><WeatherCard /></div> },
      { value: 'map', label: 'Bản đồ thương lái', content: (tab === 'map' || visited.has('map')) && <div className="farmer-dashboard-live" key={id}><BuyingAreasCard userId={id} /></div> },
    ]} />
  </div>;
}
