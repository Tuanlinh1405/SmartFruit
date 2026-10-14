import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterDemoPage } from '../features/auth/RegisterDemoPage';
import { BuyerShell, AdminShell } from './Shell';
import { BuyerDashboard } from '../features/buyer/BuyerDashboard';
import { BuyerProfilePage } from '../features/buyer-profile/BuyerProfilePage';
import { RequestListPage } from '../features/buy-requests/RequestListPage';
import { RequestFormPage } from '../features/buy-requests/RequestFormPage';
import { LotsPage } from '../features/lots/LotsPage';
import { BuyerDemoPage } from '../features/demo/BuyerDemoPage';
import { AdminPage } from '../features/admin/AdminPage';
import type { AppRole } from '../lib/domain';

function Home() {
  const { status, profile } = useAuth();
  if (status === 'loading') return <div className="center-state">Đang tải phiên đăng nhập…</div>;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (status === 'ready') {
    return <Navigate to={profile?.role === 'BUYER' ? '/buyer' :
      profile?.role === 'ADMIN' ? '/admin' : '/role-home'} replace />;
  }
  return <SessionState />;
}

function SessionState() {
  const { status, error, profile, retry } = useAuth();
  if (status === 'loading') return <div className="center-state">Đang kiểm tra quyền truy cập…</div>;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (status === 'error') return <div className="center-state"><h2>Chưa tải được hồ sơ</h2><p>{error}</p><button className="button primary" onClick={retry}>Thử lại</button></div>;
  if (!profile?.role) return <div className="center-state"><h2>Chờ cấp quyền</h2><p>Tài khoản đã đăng nhập nhưng chưa được gán vai trò ứng dụng.</p></div>;
  return null;
}

function RoleGuard({ role }: { role: AppRole | AppRole[] }) {
  const { status, profile } = useAuth();
  if (status !== 'ready' || !profile?.role) return <SessionState />;
  if (!(Array.isArray(role) ? role.includes(profile.role) : profile.role === role))
    return <div className="center-state"><h2>Không có quyền truy cập</h2><p>Vai trò {profile.role} không được mở khu vực này.</p></div>;
  return <Outlet />;
}

function OtherRoleHome() {
  const { profile } = useAuth();
  return <div className="center-state"><h2>Xin chào {profile?.full_name || 'bạn'}</h2>
    <p>Tài khoản {profile?.role} đã đăng nhập. Dev A sẽ gắn giao diện Farmer/Carrier vào router chung.</p></div>;
}

export function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterDemoPage />} />
    <Route path="/" element={<Home />} />
    <Route path="/role-home" element={<RoleGuard role={['FARMER', 'CARRIER']} />}>
      <Route index element={<OtherRoleHome />} />
    </Route>
    <Route element={<RoleGuard role="BUYER" />}>
      <Route path="/buyer" element={<BuyerShell />}>
        <Route index element={<BuyerDashboard />} />
        <Route path="profile" element={<BuyerProfilePage />} />
        <Route path="requests" element={<RequestListPage />} />
        <Route path="requests/new" element={<RequestFormPage />} />
        <Route path="requests/:id/edit" element={<RequestFormPage />} />
        <Route path="lots" element={<LotsPage />} />
        <Route path="invitations" element={<BuyerDemoPage kind="invitations" />} />
        <Route path="negotiations" element={<BuyerDemoPage kind="negotiations" />} />
        <Route path="transport" element={<BuyerDemoPage kind="transport" />} />
        <Route path="reviews" element={<BuyerDemoPage kind="reviews" />} />
        <Route path="policy" element={<BuyerDemoPage kind="policy" />} />
      </Route>
    </Route>
    <Route element={<RoleGuard role="ADMIN" />}>
      <Route path="/admin" element={<AdminShell />}><Route index element={<AdminPage />} />
        <Route path=":section/map" element={<AdminPage />} />
        <Route path=":section" element={<AdminPage />} /></Route>
    </Route>
    <Route path="*" element={<div className="center-state"><h2>Không tìm thấy trang</h2><a href="/">Về trang chủ</a></div>} />
  </Routes></AuthProvider></BrowserRouter>;
}
