import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';

const buyerNavigation = [
  { to: '/buyer', label: 'Tổng quan', icon: '▦', end: true },
  { to: '/buyer/requests', label: 'Yêu cầu thu mua', icon: '▤' },
  { to: '/buyer/lots', label: 'Tìm kiếm lô hàng', icon: '⌕' },
  { to: '/buyer/invitations', label: 'Lời mời kết nối', icon: '✉' },
  { to: '/buyer/negotiations', label: 'Đàm phán', icon: '☏' },
  { to: '/buyer/transport', label: 'Vận chuyển', icon: '▣' },
  { to: '/buyer/reviews', label: 'Đánh giá', icon: '☆' },
  { to: '/buyer/policy', label: 'Chính sách', icon: '♧' },
];

export function BuyerShell() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  async function logout() { await supabase.auth.signOut(); navigate('/login', { replace: true }); }
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><span className="brand-icon">✳</span><span>LogStar<small>Nông sản Việt Nam</small></span></div>
      <div className="sidebar-caption">KHÔNG GIAN THƯƠNG LÁI</div>
      <nav aria-label="Điều hướng Buyer">{buyerNavigation.map(item =>
        <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">{item.icon}</span>{item.label}</NavLink>)}</nav>
      <div className="sidebar-bottom"><NavLink to="/buyer/profile" onClick={() => setOpen(false)} className="account-card">
        <span className="avatar">{profile?.full_name?.charAt(0) || 'B'}</span><span><strong>{profile?.full_name || 'Tài khoản Buyer'}</strong><small>Xem hồ sơ</small></span></NavLink>
        <button className="logout" onClick={logout}>↗ Đăng xuất</button>
      </div>
    </aside>
    {open && <button className="sidebar-scrim" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <div className="main-column"><header className="topbar">
      <button className="menu-button" onClick={() => setOpen(value => !value)} aria-label="Mở menu">☰</button>
      <span className="topbar-tag">B2B AGRITECH VIETNAM</span><span className="topbar-spacer" />
      <span className="topbar-welcome">Xin chào, {profile?.full_name || 'thương lái'} 👋</span>
      <span className="avatar small">{profile?.full_name?.charAt(0) || 'B'}</span>
    </header><main className="page-content"><Outlet /></main></div>
  </div>;
}

const adminNav = [
  { to: '/admin', label: 'Tổng quan', end: true },
  { to: '/admin/buyers', label: 'Thương lái' },
  { to: '/admin/farmers', label: 'Nhà vườn' },
  { to: '/admin/carriers', label: 'Vận tải' },
  { to: '/admin/marketplace', label: 'Thị trường' },
  { to: '/admin/connections', label: 'Kết nối' },
  { to: '/admin/transport', label: 'Yêu cầu xe' },
  { to: '/admin/settings', label: 'Cấu hình' },
];

export function AdminShell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  async function logout() { await supabase.auth.signOut(); navigate('/login', { replace: true }); }
  return <div className="admin-shell">
    <header className="admin-header"><div className="brand"><span className="brand-icon">✳</span><span>LogStar · Quản trị<small>Trang quản trị hệ thống</small></span></div>
      <span className="topbar-spacer" /><span>{profile?.full_name || 'Admin'}</span>
      <button className="button subtle" onClick={logout}>Đăng xuất</button></header>
    <nav className="admin-nav" aria-label="Điều hướng Admin">{adminNav.map(item =>
      <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'active' : ''}>{item.label}</NavLink>)}</nav>
    <main className="admin-content"><Outlet /></main>
  </div>;
}
