import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../../components/shared';
import { FarmerAssistantEntry } from '../assistant/farmer-assistant';
import { WeatherCard } from './WeatherCard';
import { BuyingAreasCard } from './BuyingAreasCard';
import './dashboard.css';
export default function FarmerDashboard() {
  const {session}=useAuth(); const id=session?.user.id??'';
  return <div className="stack"><PageHeader eyebrow="Tổng quan · Nhà vườn" title="Mùa vụ sẵn sàng, kết nối người mua." description="Quản lý lô nông sản và khám phá nhu cầu thu mua phù hợp." action={<Link className="button button-accent" to="/farmer/lots/new">＋ Tạo lô hàng</Link>}/>
    <FarmerAssistantEntry/>
    <section className="panel hero-panel"><span className="eyebrow">Kết nối thu mua</span><h2>Đưa nông sản đến đúng người mua</h2><p>Chọn lô đã công bố, xem nhu cầu và lý do người mua phù hợp.</p><div className="hero-actions"><Link className="button button-primary" to="/farmer/matches">Tìm người mua →</Link><Link className="button button-secondary" to="/farmer/lots">Mở danh sách lô</Link></div></section>
    <div className="farmer-dashboard-live" key={id}><BuyingAreasCard userId={id}/><WeatherCard/></div>
    <section className="panel demo-panel"><span className="badge badge-demo">Minh họa</span><h2>Tiến trình vận chuyển</h2><p>Luồng vận chuyển mẫu; chưa kết nối đặt xe hoặc GPS thật.</p><Link to="/farmer/transport">Xem vận chuyển minh họa →</Link></section>
    <Link to="/farmer/reviews">Xem đánh giá giao dịch →</Link>
  </div>;
}
