import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, MoreHorizontal, LogOut } from 'lucide-react';
import { Brand, brandName } from '../components/shared/brand';
import { pageInventory, roleMeta } from '../app/ui-inventory';
import { workspaceNavigation } from '../app/navigation';
import type { Role } from '../types/ui';
import { Drawer } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { useAuth } from '../features/auth/AuthProvider';
import { NotificationBell } from './notification-bell';

function Navigation({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return <nav aria-label={`Điều hướng ${roleMeta[role].label}`} className="workspace-navigation">{workspaceNavigation(role).map(item => { const Icon = item.icon; return <NavLink end={item.end} key={item.path} to={item.path} className="workspace-nav-link" onClick={onNavigate}>{Icon && <Icon size={19} strokeWidth={1.8} aria-hidden="true" />}<span>{item.title}</span></NavLink>; })}</nav>;
}
export function AppShell({ role }: { role: Role }) {
  const [menuOpen, setMenuOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const { pathname } = useLocation(); const { profile, signOut } = useAuth(); const navigate = useNavigate();
  const current = pageInventory.find(item => item.role === role && item.path === pathname); const meta = roleMeta[role];
  const items=workspaceNavigation(role), shortcuts=items.slice(0,4);
  const navItem = items.find(item => item.path === pathname || (!item.end && pathname.startsWith(`${item.path}/`)));
  const accountPath = role === 'CARRIER' ? '/carrier/vehicles' : role === 'ADMIN' ? '/admin/dashboard' : `${meta.prefix}/profile`;
  const home=role==='BUYER'?'/buyer/dashboard':`${meta.prefix}/dashboard`;
  const name = profile?.full_name || meta.label; const initial = name.charAt(0).toLocaleUpperCase('vi-VN');
  const moreActive=!shortcuts.some(item=>item.path===pathname||(!item.end&&pathname.startsWith(item.path+'/')));
  async function logout() { if (busy) return; setBusy(true); setError(''); try { await signOut(); navigate('/login', { replace: true }); } catch { setError('Không thể đăng xuất. Vui lòng thử lại.'); } finally { setBusy(false); } }
  const sidebarContent = <>
    <Link to={home} className="workspace-brand" onClick={() => setMenuOpen(false)}><Brand tagline /></Link>
    <p className="workspace-caption">Không gian {meta.label}</p><Navigation role={role} onNavigate={() => setMenuOpen(false)} />
    <div className="workspace-account"><NavLink to={accountPath} className="workspace-account-link" onClick={() => setMenuOpen(false)}><span className="workspace-avatar">{initial}</span><span><strong>{name}</strong><small>{role === 'CARRIER' ? 'Hồ sơ & đội xe' : role === 'ADMIN' ? 'Tổng quan quản trị' : 'Xem hồ sơ'}</small></span></NavLink>
      <Button variant="ghost" className="workspace-logout" loading={busy} onClick={() => { void logout(); }}><LogOut size={17} aria-hidden="true" />Đăng xuất</Button>{error && <p role="alert">{error}</p>}
    </div>
  </>;
  const shortLabels:Record<string,string>={'Hồ sơ & danh sách xe':'Đội xe','Yêu cầu vận chuyển':'Yêu cầu','Theo dõi chuyến':'Theo dõi','Tổng quan vận hành':'Tổng quan','Quản lý người dùng':'Thành viên','Quản lý lô hàng':'Lô hàng','Nhu cầu thu mua':'Nhu cầu','Tổng quan':'Tổng quan','Danh sách lô hàng':'Lô hàng','Người mua phù hợp':'Kết nối','Yêu cầu thu mua':'Yêu cầu','Tìm kiếm lô hàng':'Tìm hàng','Lời mời kết nối':'Lời mời','Hồ sơ & đội xe':'Đội xe','Đàm phán':'Đàm phán','Tìm xe':'Tìm xe'};
  return <div className={`workspace-shell role-${role.toLowerCase()}`}><a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <aside className="workspace-sidebar">{sidebarContent}</aside>
    <div className="workspace-main"><header className="workspace-topbar">
      <Drawer title={`Menu ${meta.label}`} description="Điều hướng theo vai trò tài khoản đã đăng nhập." open={menuOpen} onOpenChange={setMenuOpen} trigger={<Button variant="ghost" className="workspace-menu" aria-label="Mở menu"><Menu size={20} aria-hidden="true" /></Button>}><div className="workspace-mobile-navigation">{sidebarContent}</div></Drawer>
      <Link to={home} className="workspace-mobile-brand"><Brand /></Link><span className="workspace-tag">Không gian {meta.label}</span><span className="workspace-spacer" /><NotificationBell /><span className="workspace-welcome">Xin chào, {name}</span><Link to={accountPath} className="workspace-avatar" aria-label={`Hồ sơ ${name}`}>{initial}</Link>
    </header><main id="main-content" tabIndex={-1} className="workspace-content">{!['FARMER','BUYER'].includes(role) && <nav aria-label="Đường dẫn" className="breadcrumb"><Link to="/">{brandName}</Link><span aria-hidden="true">/</span><span>{meta.label}</span><span aria-hidden="true">/</span><span aria-current="page">{current?.title ?? (pathname.endsWith('/edit') ? 'Chỉnh sửa' : navItem?.title ?? 'Chi tiết')}</span></nav>}<div className={role === 'BUYER' ? 'b-workspace' : 'workspace-pages'}><Outlet /></div></main></div>
    <nav className="workspace-bottom-nav" aria-label={`Điều hướng nhanh ${meta.label}`}>{shortcuts.map(item=>{const Icon=item.icon;return <NavLink key={item.path} to={item.path} end={item.end} aria-label={item.title}>{Icon&&<Icon size={20} aria-hidden="true"/>}<span>{shortLabels[item.title]??item.title}</span></NavLink>;})}<button type="button" onClick={()=>setMenuOpen(true)} aria-label="Mở tất cả chức năng" aria-expanded={menuOpen} className={moreActive?'active':''}><MoreHorizontal size={20} aria-hidden="true"/><span>Thêm</span></button></nav>
  </div>;
}
