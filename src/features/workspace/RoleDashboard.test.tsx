import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { RoleDashboard } from './RoleDashboard';
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'owner' } } }) }));
vi.mock('../farmer/assistant/farmer-assistant', () => ({ FarmerAssistantEntry: () => <button>Hỏi trợ lý</button> }));
function show(role: 'FARMER' | 'CARRIER', load: typeof import('./RoleDashboard').loadRoleSummary) {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<MemoryRouter><QueryClientProvider client={query}><RoleDashboard role={role} load={load} /></QueryClientProvider></MemoryRouter>);
}
test('Farmer renders server counts and keeps the real assistant/matching entries', async () => {
  const load = vi.fn(async () => [7, 2, 4]); show('FARMER', load);
  expect(await screen.findByText('7')).toBeVisible(); expect(load).toHaveBeenCalledWith('owner', 'FARMER');
  expect(screen.getByRole('button', { name: 'Hỏi trợ lý' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Tìm người mua →' })).toHaveAttribute('href', '/farmer/matches');
  expect(screen.queryByText('Lô hàng mẫu')).not.toBeInTheDocument();
});
test('Carrier renders its fleet counts and defers transport instead of fabricating bookings', async () => {
  const load = vi.fn(async () => [3, 1]); show('CARRIER', load);
  expect(await screen.findByText('3')).toBeVisible(); expect(load).toHaveBeenCalledWith('owner', 'CARRIER');
  expect(screen.queryByRole('button', { name: 'Hỏi trợ lý' })).not.toBeInTheDocument();
  expect(screen.getByText(/chờ tích hợp API/)).toBeVisible();
});
test('a failed summary does not substitute fabricated or zero metrics', async () => {
  show('CARRIER', async () => { throw new Error('offline'); });
  expect(await screen.findByRole('alert')).toBeVisible(); expect(screen.queryByText('Dữ liệu đã lưu')).not.toBeInTheDocument();
});
