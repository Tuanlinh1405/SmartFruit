import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StartPage } from './start-page';
import { pageInventory } from './ui-inventory';
import { AppShell } from '../layouts/app-shell';
import { StatusPage } from './skeleton-page';
import { LoadingState } from '../components/shared';
import { RoleDashboard } from '../features/workspace/RoleDashboard';
const AFeaturePage = lazy(() => import('../features/a-feature-page').then(module => ({ default: module.AFeaturePage })));
const FarmerDashboard = lazy(() => import('../features/farmer/dashboard/FarmerDashboard'));
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { RoleGuard, RoleHome } from '../features/auth/auth-routing';
import { SessionWorkspace } from './session-workspace';
import { FarmerAssistantPanel } from '../features/farmer/assistant/farmer-assistant';
import { RULE_VERSION } from '../features/matching/core';
import { scoreFarmerRequests } from '../features/farmer/matching/shared-scorer';
import { BuyerShell, AdminShell } from './Shell';
const BuyerDashboard = lazy(() => import('../features/buyer/BuyerDashboard').then(module => ({ default: module.BuyerDashboard })));
const BuyerProfilePage = lazy(() => import('../features/buyer-profile/BuyerProfilePage').then(module => ({ default: module.BuyerProfilePage })));
const RequestListPage = lazy(() => import('../features/buy-requests/RequestListPage').then(module => ({ default: module.RequestListPage })));
const RequestFormPage = lazy(() => import('../features/buy-requests/RequestFormPage').then(module => ({ default: module.RequestFormPage })));
const LotsPage = lazy(() => import('../features/lots/LotsPage').then(module => ({ default: module.LotsPage })));
const TradePage = lazy(() => import('../features/trading/TradePage').then(module => ({ default: module.TradePage })));
const DeferredPage = lazy(() => import('../features/deferred/DeferredPage').then(module => ({ default: module.DeferredPage })));
const AdminPage = lazy(() => import('../features/admin/AdminPage').then(module => ({ default: module.AdminPage })));
import './b-styles.css';
const PolicyPage = lazy(() => import('../features/policy/PolicyPage').then(m=>({default:m.PolicyPage})));
const TransportPage = lazy(() => import('../features/transport/TransportPage').then(m=>({default:m.TransportPage})));
import { NotificationsPage } from '../features/notifications/NotificationCenter';
const DevUi = import.meta.env.DEV ? lazy(() => import('../dev/ui-page')) : null;
type Feature = import('react').ComponentProps<typeof AFeaturePage>['feature'];
function FarmerCarrierFeature({ feature }: { feature: Feature }) {
  const { session } = useAuth();
  return <AFeaturePage feature={feature} authenticatedUserId={session!.user.id} scorer={scoreFarmerRequests} scoringVersion={`${RULE_VERSION}:${import.meta.env.VITE_MATCHING_MODE}`} />;
}
// Exported without BrowserRouter/AuthProvider for integration tests using real
// routing with injected SDK dependencies. Production always uses AppRouter.
export function ApplicationRoutes() {
  const { status, profile } = useAuth();
  return <><Suspense fallback={<LoadingState />}><Routes>
    <Route path="/" element={<StartPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/policy" element={<main className="landing"><PolicyPage/></main>} />
    <Route path="/auth/register" element={<Navigate to="/register" replace />} />
    <Route path="/auth/login" element={<Navigate to="/login" replace />} />
    <Route path="/role-home" element={<RoleHome />} />
    {(['FARMER','CARRIER'] as const).map(role => <Route key={role} element={<RoleGuard role={role} />}>
      <Route path={role === 'FARMER' ? '/farmer' : '/carrier'} element={<AppShell role={role} />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        {role === 'FARMER' && <><Route path="invitations" element={<TradePage view="invitations" />} /><Route path="negotiations" element={<TradePage view="negotiations" />} /><Route path="chat" element={<TradePage view="negotiations" />} /><Route path="reviews" element={<TradePage view="reviews" />} /></>}
        {role === 'CARRIER' && <Route path="dashboard" element={<RoleDashboard role={role} />} />}
        <Route path="policy" element={<PolicyPage/>}/><Route path="notifications" element={<NotificationsPage/>}/>
        {pageInventory.filter(entry => entry.role === role && ['FUI-06','CUI-03','CUI-05','CUI-06'].includes(entry.id)).map(entry => <Route key={entry.id} path={entry.path.split('/').slice(2).join('/')} element={['FUI-06','CUI-03'].includes(entry.id)?<TransportPage/>:<DeferredPage kind={entry.id==='CUI-05'?'tracking':'carrier-reviews'} />} />)}
        {role === 'FARMER' ? <>
          <Route path="dashboard" element={<FarmerDashboard />} />
          {['prices','weather','map'].map(path => <Route key={path} path={path} element={<Navigate to="/farmer/dashboard" replace />} />)}
          <Route path="profile" element={<FarmerCarrierFeature feature="profile" />} />
          <Route path="lots" element={<FarmerCarrierFeature feature="lots" />} />
          <Route path="lots/new" element={<FarmerCarrierFeature feature="new" />} />
          <Route path="lots/:id" element={<FarmerCarrierFeature feature="detail" />} />
          <Route path="lots/:id/edit" element={<FarmerCarrierFeature feature="edit" />} />
          <Route path="matches" element={<FarmerCarrierFeature feature="matches" />} />
        </> : <><Route path="vehicles" element={<FarmerCarrierFeature feature="vehicles" />} /><Route path="profile" element={<Navigate to="/carrier/vehicles" replace />} /><Route path="transport" element={<Navigate to="/carrier/requests" replace />} /></>}
        <Route path="*" element={<StatusPage code="404" />} />
      </Route>
    </Route>)}
    <Route element={<RoleGuard role="BUYER" />}><Route path="/buyer" element={<BuyerShell />}>
      <Route index element={<Navigate to="dashboard" replace />} /><Route path="dashboard" element={<BuyerDashboard />} />
      <Route path="profile" element={<BuyerProfilePage />} /><Route path="requests" element={<RequestListPage />} />
      <Route path="requests/new" element={<RequestFormPage />} /><Route path="requests/:id/edit" element={<RequestFormPage />} />
      <Route path="lots" element={<LotsPage />} /><Route path="chat" element={<TradePage view="negotiations" />} />
      {(['invitations','negotiations','reviews'] as const).map(view => <Route key={view} path={view} element={<TradePage view={view} />} />)}
      <Route path="transport" element={<TransportPage/>}/><Route path="policy" element={<PolicyPage/>}/><Route path="map" element={<DeferredPage kind="map"/>}/>
      <Route path="notifications" element={<NotificationsPage/>} />
      <Route path="*" element={<StatusPage code="404" />} />
    </Route></Route>
    <Route element={<RoleGuard role="ADMIN" />}><Route path="/admin" element={<div className="b-workspace"><AdminShell /></div>}>
      <Route index element={<Navigate to="/admin/dashboard" replace />} /><Route path="dashboard" element={<AdminPage />} />
      <Route path="policy" element={<PolicyPage/>}/><Route path="notifications" element={<NotificationsPage/>}/>
      <Route path=":section/map" element={<AdminPage />} /><Route path=":section" element={<AdminPage />} />
    </Route></Route>
    <Route path="/403" element={<StatusPage code="403" />} /><Route path="/404" element={<StatusPage code="404" />} />
    {DevUi && <Route path="/dev/ui" element={<Suspense fallback={<LoadingState />}><DevUi /></Suspense>} />}
    <Route path="*" element={<StatusPage code="404" />} />
  </Routes></Suspense><FarmerAssistantPanel enabled={status === 'ready' && profile?.role === 'FARMER'} /></>;
}
export function AppRouter() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><AuthProvider><SessionWorkspace><ApplicationRoutes /></SessionWorkspace></AuthProvider></BrowserRouter>;
}
