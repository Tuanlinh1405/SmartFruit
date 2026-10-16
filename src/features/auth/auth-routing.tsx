import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { AppRole } from '../../lib/domain';
import { Button } from '../../components/ui';
import { ErrorState, LoadingState } from '../../components/shared';
export function roleHome(role: AppRole) { return role === 'FARMER' ? '/farmer/dashboard' : role === 'CARRIER' ? '/carrier/dashboard' : role === 'BUYER' ? '/buyer' : '/admin'; }
export function SessionState() {
  const { status, profile, error, retry, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  if (status === 'loading') return <LoadingState />;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  return <main className="landing stack"><h1>{status === 'error' ? 'Chưa tải được hồ sơ' : 'Chờ cấp quyền'}</h1>
    {status === 'error' ? <ErrorState message={error ?? 'Không thể kiểm tra phiên.'} onRetry={retry} /> : <p>Tài khoản chưa được gán vai trò ứng dụng. Liên hệ chủ dự án để cấp quyền.</p>}
    {(!profile?.role || status === 'error') && <Button variant="secondary" onClick={() => { void signOut().catch(() => setLogoutError('Không thể đăng xuất. Vui lòng thử lại.')); }}>Đăng xuất</Button>}{logoutError && <p role="alert">{logoutError}</p>}
  </main>;
}
export function RoleGuard({ role }: { role: AppRole }) {
  const { status, profile } = useAuth();
  if (status !== 'ready' || !profile?.role) return <SessionState />;
  if (profile.role !== role) return <Navigate to="/403" replace />;
  return <Outlet />;
}
export function RoleHome() {
  const { status, profile } = useAuth();
  return status === 'ready' && profile?.role ? <Navigate to={roleHome(profile.role)} replace /> : <SessionState />;
}
