import { Link, Navigate } from 'react-router-dom';
import { Brand } from '../components/shared/brand';
import { useAuth } from '../features/auth/AuthProvider';
import { roleHome } from '../features/auth/auth-routing';
import { Card, PageHeader } from '../components/shared';
export function StartPage() {
  const { status, profile } = useAuth();
  if (status === 'ready' && profile?.role) return <Navigate to={roleHome(profile.role)} replace />;
  return <main className="landing stack"><div className="brand"><Brand /></div>
    <PageHeader eyebrow="Kết nối nông sản" title="Nhà vườn, thu mua và vận tải" description="Đăng nhập để quản lý hồ sơ, lô hàng và đội xe bằng tài khoản của bạn." />
    <Card><p>Đăng ký tài khoản Nhà vườn, Thu mua hoặc Vận tải để bắt đầu. Các tiện ích minh họa được ghi nhãn riêng.</p><div className="row"><Link className="button button-primary" to="/login">Đăng nhập</Link><Link className="button button-secondary" to="/register">Đăng ký</Link></div></Card>
    {import.meta.env.DEV && <Link to="/dev/ui">Xem UI kit</Link>}
  </main>;
}
