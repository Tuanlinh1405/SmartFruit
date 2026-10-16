import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { AppShell } from '../layouts/app-shell';


export function BuyerShell() { return <AppShell role="BUYER" />; }

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
  const { profile, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();
  async function logout() { try { await signOut(); navigate('/login', { replace: true }); } catch { setLogoutError('Không thể đăng xuất. Vui lòng thử lại.'); } }
  return <div className="admin-shell">
    <header className="admin-header"><div className="brand"><span className="brand-icon">✳</span><span>SmartFruit · Quản trị<small>Trang quản trị hệ thống</small></span></div>
      <span className="topbar-spacer" /><span>{profile?.full_name || 'Admin'}</span>
      <button className="button subtle" onClick={logout}>Đăng xuất</button></header>
    <nav className="admin-nav" aria-label="Điều hướng Admin">{adminNav.map(item =>
      <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'active' : ''}>{item.label}</NavLink>)}</nav>
    <main className="admin-content">{logoutError && <p role="alert">{logoutError}</p>}<Outlet /></main>
  </div>;
}
