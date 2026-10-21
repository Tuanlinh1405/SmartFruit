import { useState } from 'react';
import { Brand, brandName } from '../components/shared/brand';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
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
  const navItem = workspaceNavigation(role).find(item => item.path === pathname || (!item.end && pathname.startsWith(`${item.path}/`)));
  const accountPath = role === 'CARRIER' ? '/carrier/vehicles' : `${meta.prefix}/profile`;
  const name = profile?.full_name || meta.label; const initial = name.charAt(0).toLocaleUpperCase('vi-VN');
  async function logout() { if (busy) return; setBusy(true); setError(''); try { await signOut(); navigate('/login', { replace: true }); } catch { setError('Không thể đăng xuất. Vui lòng thử lại.'); } finally { setBusy(false); } }
  const sidebarContent = <>
    <Link to={role === 'BUYER' ? '/buyer' : `${meta.prefix}/dashboard`} className="workspace-brand" onClick={() => setMenuOpen(false)}><Brand tagline /></Link>
    <p className="workspace-caption">Không gian {meta.label}</p><Navigation role={role} onNavigate={() => setMenuOpen(false)} />
    <div className="workspace-account"><NavLink to={accountPath} className="workspace-account-link" onClick={() => setMenuOpen(false)}><span className="workspace-avatar">{initial}</span><span><strong>{name}</strong><small>{role === 'CARRIER' ? 'Hồ sơ & đội xe' : 'Xem hồ sơ'}</small></span></NavLink>
      <Button variant="ghost" className="workspace-logout" loading={busy} onClick={() => { void logout(); }}><LogOut size={17} aria-hidden="true" />Đăng xuất</Button>{error && <p role="alert">{error}</p>}
    </div>
  </>;
  return <div className="workspace-shell"><a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <aside className="workspace-sidebar">{sidebarContent}</aside>
    <div className="workspace-main"><header className="workspace-topbar">
      <Drawer title={`Menu ${meta.label}`} description="Điều hướng theo vai trò tài khoản đã đăng nhập." open={menuOpen} onOpenChange={setMenuOpen} trigger={<Button variant="ghost" className="workspace-menu" aria-label="Mở menu"><Menu size={22} aria-hidden="true" /></Button>}><div className="workspace-mobile-navigation">{sidebarContent}</div></Drawer>
      <span className="workspace-tag">B2B AGRITECH VIETNAM</span><span className="workspace-spacer" /><NotificationBell /><span className="workspace-welcome">Xin chào, {name}</span><Link to={accountPath} className="workspace-avatar" aria-label={`Hồ sơ ${name}`}>{initial}</Link>
    </header><main id="main-content" tabIndex={-1} className="workspace-content"><nav aria-label="Đường dẫn" className="breadcrumb"><Link to="/">{brandName}</Link><span aria-hidden="true">/</span><span>{meta.label}</span><span aria-hidden="true">/</span><span aria-current="page">{current?.title ?? (pathname.endsWith('/edit') ? 'Chỉnh sửa' : navItem?.title ?? 'Chi tiết')}</span></nav><div className={role === 'BUYER' ? 'b-workspace' : 'workspace-pages'}><Outlet /></div></main></div>
  </div>;
}
