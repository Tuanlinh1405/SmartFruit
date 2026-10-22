import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, FilePenLine, CircleCheck, Handshake, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader, ErrorState, LoadingState, MetricCard } from '../../../components/shared';
import { loadRoleSummary } from '../../workspace/RoleDashboard';
import { FarmerAssistantEntry } from '../assistant/farmer-assistant';
import { WeatherCard } from './WeatherCard';
import { BuyingAreasCard } from './BuyingAreasCard';
import './dashboard.css';
import { ReviewSummary } from '../../trading/ReviewSummary';
import { TransportSummary } from '../../transport/TransportSummary';

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
  // Old saved tab URLs now show the same overview and preserve other parameters.
  useEffect(() => { if (params.has('tab')) { const next = new URLSearchParams(params); next.delete('tab'); setParams(next, { replace: true }); } }, [params, setParams]);
  return <div className="farmer-dashboard stack" key={id}>
    <PageHeader eyebrow="Không gian nhà vườn" title="Tổng quan nhà vườn" description="Quản lý lô hàng và theo dõi thông tin phục vụ mùa vụ."
      action={<Link className="button button-primary" to="/farmer/lots/new"><Plus size={16} aria-hidden="true" />Tạo lô hàng</Link>} />
    <div className="farmer-overview stack">
        <LotSummary userId={id} />
        <div className="farmer-overview-grid"><FarmerAssistantEntry />
          <section className="panel farmer-matching"><span className="farmer-feature-icon"><Handshake size={22} aria-hidden="true" /></span><h2>Kết nối người mua</h2><p>Chọn lô đã công bố và tìm nhu cầu thu mua phù hợp.</p><div className="hero-actions"><Link className="button button-primary" to="/farmer/matches">Tìm người mua →</Link><Link className="text-link" to="/farmer/lots">Danh sách lô hàng</Link></div></section>
        </div>
        <div className="farmer-overview-tools"><ReviewSummary userId={id} role="farmer"/><TransportSummary userId={id} role="farmer"/><WeatherCard compact/><BuyingAreasCard userId={id} compact/></div>
        <section className="panel farmer-reference-prices" aria-label="Giá tham khảo"><h2>Giá tham khảo</h2><p>Chưa có nguồn giá thị trường được tích hợp. Bạn có thể tham khảo giá chào của các lô hàng và khoảng giá thu mua đã đăng.</p><Link className="text-link" to="/farmer/lots">Xem giá chào lô hàng →</Link></section>
    </div>
  </div>;
}
