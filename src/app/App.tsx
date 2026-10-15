import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { BuyerShell, AdminShell } from './Shell';
import { BuyerDashboard } from '../features/buyer/BuyerDashboard';
import { BuyerProfilePage } from '../features/buyer-profile/BuyerProfilePage';
import { RequestListPage } from '../features/buy-requests/RequestListPage';
import { RequestFormPage } from '../features/buy-requests/RequestFormPage';
import { LotsPage } from '../features/lots/LotsPage';
import { TradePage } from '../features/trading/TradePage';
import { DeferredPage } from '../features/deferred/DeferredPage';
import { RoleShell, RoleWorkspace, RoleProfilePage } from '../features/workspace/RoleWorkspace';
import { supabase } from '../lib/supabase';
import { AdminPage } from '../features/admin/AdminPage';
import type { AppRole } from '../lib/domain';
import { LoadingState } from '../components/shared/content';
import { StatusPage } from './status-page';

const DevUi = import.meta.env.DEV ? lazy(() => import('../dev/ui-page')) : null;

function Home() {
  const { status, profile } = useAuth();
  if (status === 'loading') return <div className="center-state">Đang tải phiên đăng nhập…</div>;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (status === 'suspended') return <div className="center-state"><h2>Tài khoản đang bị khóa</h2><p>Liên hệ quản trị viên để được hỗ trợ.</p><button className="button outline" onClick={() => void supabase.auth.signOut()}>Đăng xuất</button></div>;
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
  if (status === 'suspended') return <div className="center-state"><h2>Tài khoản đang bị khóa</h2><p>Liên hệ quản trị viên để được hỗ trợ.</p><button className="button outline" onClick={() => void supabase.auth.signOut()}>Đăng xuất</button></div>;
  if (status === 'error') return <div className="center-state"><h2>Chưa tải được hồ sơ</h2><p>{error}</p><button className="button primary" onClick={retry}>Thử lại</button></div>;
  if (!profile?.role) return <div className="center-state"><h2>Chờ cấp quyền</h2><p>Tài khoản đã đăng nhập nhưng chưa được gán vai trò ứng dụng.</p></div>;
  return null;
}

function RoleGuard({ role }: { role: AppRole | AppRole[] }) {
  const { status, profile } = useAuth();
  if (status !== 'ready' || !profile?.role) return <SessionState />;
  if (!(Array.isArray(role) ? role.includes(profile.role) : profile.role === role))
    return <StatusPage code="403" />;
  return <Outlet />;
}

function OtherRoleHome() {
  const { profile } = useAuth();
  return <Navigate to={profile?.role === 'FARMER' ? '/farmer' : '/carrier'} replace />;
}

export function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/auth/login" element={<LoginPage />} />
    <Route path="/register" element={<Navigate to="/login" replace />} />
    <Route path="/auth/register" element={<Navigate to="/login" replace />} />
    <Route path="/" element={<Home />} />
    <Route path="/role-home" element={<RoleGuard role={['FARMER', 'CARRIER']} />}>
      <Route index element={<OtherRoleHome />} />
    </Route>
    <Route element={<RoleGuard role="BUYER" />}>
      <Route path="/buyer" element={<BuyerShell />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<BuyerDashboard />} />
        <Route path="profile" element={<BuyerProfilePage />} />
        <Route path="requests" element={<RequestListPage />} />
        <Route path="requests/new" element={<RequestFormPage />} />
        <Route path="requests/:id/edit" element={<RequestFormPage />} />
        <Route path="lots" element={<LotsPage />} />
        <Route path="invitations" element={<TradePage view="invitations" />} />
        <Route path="negotiations" element={<TradePage view="negotiations" />} />
        <Route path="chat" element={<TradePage view="negotiations" />} />
        <Route path="transport" element={<DeferredPage kind="transport" />} />
        <Route path="reviews" element={<TradePage view="reviews" />} />
        <Route path="policy" element={<DeferredPage kind="policy" />} />
        <Route path="notifications" element={<DeferredPage kind="policy" />} />
        <Route path="map" element={<DeferredPage kind="map" />} />
      </Route>
    </Route>
    <Route element={<RoleGuard role="FARMER" />}><Route path="/farmer" element={<RoleShell />}>
      <Route index element={<Navigate to="dashboard" replace />} /><Route path="dashboard" element={<RoleWorkspace />} />
      <Route path="lots" element={<RoleWorkspace view="lots" />} /><Route path="matches" element={<RoleWorkspace view="matches" />} />
      <Route path="lots/new" element={<DeferredPage kind="farmer-lots" />} /><Route path="profile" element={<RoleProfilePage />} />
      <Route path="invitations" element={<TradePage view="invitations" />} /><Route path="negotiations" element={<TradePage view="negotiations" />} />
      <Route path="chat" element={<TradePage view="negotiations" />} /><Route path="transport" element={<DeferredPage kind="transport" />} />
      <Route path="prices" element={<DeferredPage kind="prices" />} /><Route path="weather" element={<DeferredPage kind="weather" />} />
      <Route path="map" element={<DeferredPage kind="map" />} /><Route path="notifications" element={<DeferredPage kind="policy" />} />
      <Route path="reviews" element={<TradePage view="reviews" />} /></Route></Route>
    <Route element={<RoleGuard role="CARRIER" />}><Route path="/carrier" element={<RoleShell />}>
      <Route index element={<Navigate to="dashboard" replace />} /><Route path="dashboard" element={<RoleWorkspace />} />
      <Route path="vehicles" element={<RoleWorkspace view="vehicles" />} /><Route path="profile" element={<RoleProfilePage />} />
      <Route path="transport" element={<DeferredPage kind="transport" />} /><Route path="requests" element={<DeferredPage kind="transport" />} />
      <Route path="tracking" element={<DeferredPage kind="tracking" />} /><Route path="reviews" element={<DeferredPage kind="carrier-reviews" />} /></Route></Route>
    <Route element={<RoleGuard role="ADMIN" />}>
      <Route path="/admin" element={<AdminShell />}><Route index element={<Navigate to="dashboard" replace />} />
        <Route path=":section/map" element={<AdminPage />} />
        <Route path=":section" element={<AdminPage />} /></Route>
    </Route>
    <Route path="/403" element={<StatusPage code="403" />} /><Route path="/404" element={<StatusPage code="404" />} />
    {DevUi && <Route path="/dev/ui" element={<Suspense fallback={<LoadingState />}><DevUi /></Suspense>} />}
    <Route path="*" element={<StatusPage code="404" />} />
  </Routes></AuthProvider></BrowserRouter>;
}
