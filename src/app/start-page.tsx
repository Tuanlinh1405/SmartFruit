import { Link } from 'react-router-dom';
import { Leaf, ArrowRight } from 'lucide-react';
import { roleMeta } from './ui-inventory';
import type { Role } from '../types/ui';
import { Card, DemoNotice, PageHeader } from '../components/shared/content';
export function StartPage() {
  return <main className="landing stack"><div className="brand"><Leaf size={28} aria-hidden="true" /><span>SmartFruit</span></div><PageHeader eyebrow="Nền giao diện dùng chung" title="Cùng một phong cách, bốn khu vực" description="Khám phá các màn minh họa. Các chức năng lưu dữ liệu đang chờ tích hợp đăng nhập." /><DemoNotice>Farmer/Carrier có màn minh họa tương tác. Chọn khu vực không đăng nhập hoặc cấp quyền truy cập dữ liệu.</DemoNotice><div className="role-grid">{(Object.keys(roleMeta) as Role[]).map(role => { const meta = roleMeta[role]; const Icon = meta.icon; return <Card key={role}><div className="role-card"><div className="role-icon"><Icon size={24} aria-hidden="true" /></div><div><h2>{meta.label}</h2><p className="muted">{meta.description}</p></div><Link to={`${meta.prefix}/dashboard`} className="button button-secondary">Mở khu vực {meta.label}<ArrowRight size={18} aria-hidden="true" /></Link></div></Card>; })}</div><div className="row"><Link to="/auth/login">Đăng nhập — skeleton</Link><Link to="/auth/register">Đăng ký — skeleton</Link>{import.meta.env.DEV && <Link to="/dev/ui">Xem UI kit</Link>}</div></main>;
}
