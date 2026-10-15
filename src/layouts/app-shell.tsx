import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Leaf, LogOut, Menu, UserRound } from 'lucide-react';
import { navigationFor, roleMeta } from '../app/ui-inventory';
import type { Role } from '../types/ui';
import { Drawer } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';

function Navigation({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return <nav aria-label={`Điều hướng ${roleMeta[role].label}`} className="nav-list">{navigationFor(role).map(item => {
    const Icon = item.icon;
    return <NavLink end key={item.id} to={item.path} className="nav-link" onClick={onNavigate} title={item.title}>
      {Icon && <Icon size={19} strokeWidth={1.8} aria-hidden="true" />}<span className="nav-label">{item.title}</span>
    </NavLink>;
  })}</nav>;
}

export function AppShell({ role }: { role: Role }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const { pathname } = useLocation(); const { profile } = useAuth(); const navigate = useNavigate();
  const current = [...navigationFor(role)].sort((a, b) => b.path.length - a.path.length)
    .find(item => pathname === item.path || pathname.startsWith(`${item.path}/`));
  const meta = roleMeta[role]; const profilePath = `${meta.prefix}/profile`;
  async function logout() {
    setSigningOut(true); setError('');
    try { const result = await supabase.auth.signOut(); if (result.error) throw result.error; navigate('/login', { replace: true }); }
    catch { setError('Chưa đăng xuất được. Vui lòng thử lại.'); }
    finally { setSigningOut(false); }
  }
  const account = <div className="account-menu">
    {role !== 'ADMIN' && <Link className="nav-link" to={profilePath} onClick={() => setMenuOpen(false)} title="Hồ sơ tài khoản"><UserRound size={19} aria-hidden="true" /><span className="nav-label">{profile?.full_name || 'Hồ sơ tài khoản'}</span></Link>}
    <Button variant="ghost" className="sidebar-logout" loading={signingOut} onClick={() => void logout()} title="Đăng xuất"><LogOut size={19} aria-hidden="true" /><span className="nav-label">Đăng xuất</span></Button>
  </div>;
  return <div className="shell"><a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <aside className="sidebar"><Link to={meta.prefix} className="brand" aria-label="SmartFruit — trang chính"><Leaf size={25} aria-hidden="true" /><span className="brand-text">SmartFruit</span></Link><p className="role-label">{meta.label}</p><Navigation role={role} /><div className="sidebar-footer">{account}</div></aside>
    <div className="shell-main"><header className="topbar"><div className="row">
      <Drawer title={`Menu ${meta.label}`} description="Điều hướng khu vực tài khoản của bạn." open={menuOpen} onOpenChange={setMenuOpen}
        trigger={<Button variant="ghost" className="mobile-menu" aria-label="Mở menu"><Menu size={22} aria-hidden="true" /></Button>}>
        <div className="stack"><Navigation role={role} onNavigate={() => setMenuOpen(false)} />{account}</div>
      </Drawer><nav aria-label="Đường dẫn" className="breadcrumb"><Link to={meta.prefix}>SmartFruit</Link><span aria-hidden="true">/</span><span>{meta.label}</span><span aria-hidden="true">/</span><span aria-current="page">{current?.title ?? 'Chi tiết'}</span></nav>
    </div><span className="badge topbar-role">{profile?.full_name || meta.label}</span></header>
      <main id="main-content" tabIndex={-1} className="content">{error && <p className="notice error" role="alert">{error}</p>}<Outlet /></main>
    </div>
  </div>;
}
