import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TransportPage } from './TransportPage';
import { TransportSummary } from './TransportSummary';
import type { TransportRequest } from './api';
import { formatMoney } from '../../lib/format';

vi.mock('../auth/AuthProvider', () => ({useAuth: () => ({session: {user: {id: 'carrier-test'}}, profile: {role: 'CARRIER'}})}));
// Cached query data isolates rendering from network access. Any unexpected fetch fails the test.
vi.mock('../../lib/supabase', () => ({supabase: {from: () => {throw new Error('Unexpected transport fetch');}}}));

const request: TransportRequest = {
  id: 'transport-test', requester_id: 'farmer-test', carrier_id: 'carrier-test',
  source_title: 'Sầu riêng Ri6', carrier_name: 'Nhà xe kiểm thử', vehicle_label: 'Xe thùng kín',
  quantity_kg: 1000, origin_province: 'Đồng Nai', destination_province: 'Hồ Chí Minh',
  origin_address: 'Vườn kiểm thử', destination_address: 'Kho kiểm thử', pickup_date: '2026-10-25',
  status: 'QUOTED', quote_vnd: 1500000, quote_note: '', created_at: '2026-10-22T00:00:00Z',
};

function show(view: ReactNode, row: TransportRequest) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity, gcTime: Infinity}}});
  client.setQueryData(['transport-requests', 'carrier-test', 1], {items: [row], count: 1});
  client.setQueryData(['transport-summary', 'carrier-test'], {latest: row, quotes: row.status === 'QUOTED' ? 1 : 0});
  return render(<QueryClientProvider client={client}><MemoryRouter>{view}</MemoryRouter></QueryClientProvider>);
}

describe('transport fare units', () => {
  it.each(['QUOTED', 'ACCEPTED'] as const)('shows the total fare per trip on the %s request card', status => {
    show(<TransportPage/>, {...request, status});
    expect(screen.getByText('1.500.000 ₫/chuyến')).toBeVisible();
    expect(screen.queryByText(/₫\/kg/)).not.toBeInTheDocument();
  });
  it.each(['farmer', 'buyer', 'carrier'] as const)('shows the total fare per trip on the %s dashboard', role => {
    show(<TransportSummary userId="carrier-test" role={role}/>, request);
    expect(screen.getByText('1.500.000 ₫/chuyến')).toBeVisible();
    expect(screen.queryByText(/₫\/kg/)).not.toBeInTheDocument();
  });
  it('keeps the waiting message when a request has no quote', () => {
    show(<TransportPage/>, {...request, status: 'PENDING', quote_vnd: null});
    expect(screen.getByText('Chờ báo giá')).toBeVisible();
    expect(screen.queryByText(/₫\/chuyến/)).not.toBeInTheDocument();
  });
  it('keeps commodity prices per kilogram', () => {
    expect(formatMoney(65000)).toBe('65.000 ₫/kg');
  });
});
