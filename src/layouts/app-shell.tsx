import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, Leaf, Menu } from 'lucide-react';
import { navigationFor, roleMeta } from '../app/ui-inventory';
import type { Role } from '../types/ui';
import { Drawer } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
function Navigation({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return <nav aria-label={`Điều hướng ${roleMeta[role].label}`} className="nav-list">{navigationFor(role).map(item => { const Icon = item.icon; return <NavLink end key={item.id} to={item.path} className="nav-link" onClick={onNavigate} title={item.title}>{Icon && <Icon size={19} strokeWidth={1.8} aria-hidden="true" />}<span className="nav-label">{item.title}</span></NavLink>; })}</nav>;
}
export function AppShell({ role }: { role: Role }) {
  const [menuOpen, setMenuOpen] = useState(false); const { pathname } = useLocation();
  const current = navigationFor(role).find(item => item.path === pathname); const meta = roleMeta[role];
  return <div className="shell"><a href="#main-content" className="skip-link">Đến nội dung chính</a><aside className="sidebar"><Link to="/" className="brand" aria-label="SmartFruit — chọn khu vực"><Leaf size={25} aria-hidden="true" /><span className="brand-text">SmartFruit</span></Link><p className="role-label">{meta.label}</p><Navigation role={role} /><div className="sidebar-footer"><Link to="/" className="nav-link"><ArrowLeft size={18} aria-hidden="true" /><span className="nav-label">Đổi khu vực skeleton</span></Link></div></aside><div className="shell-main"><header className="topbar"><div className="row"><Drawer title={`Menu ${meta.label}`} description="Điều hướng giao diện nền, chưa phân quyền thật." open={menuOpen} onOpenChange={setMenuOpen} trigger={<Button variant="ghost" className="mobile-menu" aria-label="Mở menu"><Menu size={22} aria-hidden="true" /></Button>}><div className="stack"><Navigation role={role} onNavigate={() => setMenuOpen(false)} /><Link to="/" onClick={() => setMenuOpen(false)}>Đổi khu vực skeleton</Link></div></Drawer><nav aria-label="Đường dẫn" className="breadcrumb"><Link to="/">SmartFruit</Link><span aria-hidden="true">/</span><span>{meta.label}</span><span aria-hidden="true">/</span><span aria-current="page">{current?.title ?? 'Trang chưa có'}</span></nav></div><span className="badge topbar-role">Giao diện nền · {meta.label}</span></header><main id="main-content" tabIndex={-1} className="content"><Outlet /></main></div></div>;
}
