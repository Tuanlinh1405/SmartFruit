import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StartPage } from './start-page';
import { pageInventory, roleMeta } from './ui-inventory';
import { AppShell } from '../layouts/app-shell';
import { AuthLayout } from '../layouts/auth-layout';
import { SkeletonPage, StatusPage } from './skeleton-page';
import { LoadingState } from '../components/shared/content';
import type { Role } from '../types/ui';
import { aDemoRoutes } from '../features/a-demo/demo-routes';

const DevUi = import.meta.env.DEV ? lazy(() => import('../dev/ui-page')) : null;

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        {(Object.keys(roleMeta) as Role[]).map(role => <Route key={role} path={roleMeta[role].prefix} element={<AppShell role={role} />}><Route index element={<Navigate to="dashboard" replace />} />{pageInventory.filter(entry => entry.role === role).map(entry => <Route key={entry.id} path={entry.path.slice(roleMeta[role].prefix.length + 1)} element={aDemoRoutes[entry.id] ?? <SkeletonPage entry={entry} />} />)}</Route>)}
        <Route path="/auth" element={<AuthLayout />}>{pageInventory.filter(entry => entry.id === 'AUTH-01' || entry.id === 'AUTH-02').map(entry => <Route key={entry.id} path={entry.path.split('/').at(-1)} element={<SkeletonPage entry={entry} />} />)}</Route>
        <Route path="/403" element={<StatusPage code="403" />} />
        <Route path="/404" element={<StatusPage code="404" />} />
        {DevUi && <Route path="/dev/ui" element={<Suspense fallback={<LoadingState />}><DevUi /></Suspense>} />}
        <Route path="*" element={<StatusPage code="404" />} />
      </Routes>
    </BrowserRouter>
  );
}
