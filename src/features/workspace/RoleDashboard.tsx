import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader, LoadingState, ErrorState, MetricCard } from '../../components/shared';
import { FarmerAssistantEntry } from '../farmer/assistant/farmer-assistant';
import { TransportSummary } from '../transport/TransportSummary';

type Role = 'FARMER' | 'CARRIER';
export async function loadRoleSummary(userId: string, role: Role) {
  const table = role === 'FARMER' ? 'lots' : 'vehicles';
  const owner = role === 'FARMER' ? 'farmer_id' : 'carrier_id';
  const filter = role === 'FARMER' ? 'status' : 'active';
  const states = role === 'FARMER' ? ['PUBLISHED', 'DRAFT', 'CLOSED'] : [true, false];
  return Promise.all(states.map(async state => {
    const result = await supabase.from(table).select('id', { count: 'exact', head: true }).eq(owner, userId).eq(filter, state);
    if (result.error || result.count === null) throw new Error('Không thể tải thống kê tài khoản.');
    return result.count;
  }));
}
export function RoleDashboard({ role, load = loadRoleSummary }: { role: Role; load?: typeof loadRoleSummary }) {
  const { session } = useAuth(); const userId = session?.user.id;
  const farmer = role === 'FARMER';
  const summary = useQuery({ queryKey: ['role-summary', userId, role], enabled: !!userId, retry: false, queryFn: () => load(userId!, role) });
  const labels = farmer ? ['Lô đang công bố', 'Lô nháp', 'Lô đã đóng'] : ['Xe đang hoạt động', 'Xe tạm ngưng'];
  return <div className="stack"><PageHeader eyebrow={`Tổng quan · ${farmer ? 'Nhà vườn' : 'Nhà xe'}`} title={farmer ? 'Mùa vụ sẵn sàng, kết nối người mua.' : 'Chuyến hàng tiếp nối, vững bước đường xa.'}
    description="Thống kê từ dữ liệu tài khoản của bạn." action={<Link className="button button-accent" to={farmer ? '/farmer/lots/new' : '/carrier/vehicles'}>{farmer ? 'Tạo lô hàng' : 'Quản lý đội xe'}</Link>} />
    {farmer && <FarmerAssistantEntry />}
    {!userId ? <p>Vui lòng đăng nhập.</p> : summary.isPending ? <LoadingState /> : summary.isError ? <ErrorState message="Không thể tải thống kê tài khoản." onRetry={() => { void summary.refetch(); }} /> : <section className="stat-grid" aria-label="Thống kê tài khoản">
      {labels.map((label, index) => <MetricCard key={label} label={label} value={summary.data[index]} description="Dữ liệu đã lưu" />)}
    </section>}
    {farmer && <section className="panel"><h2>Tìm người mua phù hợp</h2><p>Chọn lô đang công bố để đối chiếu tên nông sản, giá và khối lượng.</p><Link className="button button-secondary" to="/farmer/matches">Tìm người mua →</Link></section>}
    <TransportSummary userId={userId??''} role={farmer?'farmer':'carrier'}/>
  </div>;
}
