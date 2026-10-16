import { Link, Navigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { roleHome } from '../features/auth/auth-routing';
import { Card, PageHeader } from '../components/shared';
export function StartPage() {
  const { status, profile } = useAuth();
  if (status === 'ready' && profile?.role) return <Navigate to={roleHome(profile.role)} replace />;
  return <main className="landing stack"><div className="brand"><Leaf size={28} aria-hidden="true" /><span>SmartFruit</span></div>
    <PageHeader eyebrow="Kết nối nông sản" title="Nhà vườn, thu mua và vận tải" description="Đăng nhập để quản lý hồ sơ, lô hàng và đội xe bằng tài khoản của bạn." />
    <Card><p>Chat, báo giá, theo dõi chuyến và các tiện ích thị trường là dữ liệu minh họa có nhãn.</p><Link className="button button-primary" to="/login">Đăng nhập</Link></Card>
    {import.meta.env.DEV && <Link to="/dev/ui">Xem UI kit</Link>}
  </main>;
}
