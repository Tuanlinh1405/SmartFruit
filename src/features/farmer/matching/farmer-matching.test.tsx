import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createFarmerMatchingRepository, FarmerMatchingPanel, validateMatches, type BuyCandidate, type FarmerMatchingRepository, type MatchResult } from './farmer-matching';
import { testLot } from '../lots/lot.fixtures';
const request: BuyCandidate = { id: 'r', buyer_id: 'b', fruit_type_id: 'fruit-1', variety_id: null, title: 'Nhu cầu', target_quantity_kg: 5000, min_lot_quantity_kg: null, allow_partial: true, min_price_vnd_per_kg: 60000, max_price_vnd_per_kg: 70000, required_start: '2026-10-15', required_end: '2026-10-20', preferred_provinces: [] };
const match: MatchResult = { lotId: 'lot-1', requestId: 'r', score: 86, reasons: ['Cùng loại quả'], missingInformation: [], ruleVersion: 'fixture-only', suggestedQuantityKg: 1000 };
function repo(): FarmerMatchingRepository { return { lots: vi.fn(async () => [testLot()]), candidates: vi.fn(async () => ({ lot: testLot(), requests: [request], partners: [{ user_id: 'b', display_name: 'Buyer công khai', province: 'Tiền Giang' }] })) }; }
function show(repository: FarmerMatchingRepository, scorer?: () => MatchResult[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><FarmerMatchingPanel authenticatedUserId="u" repository={repository} scorer={scorer} onConnect={vi.fn()} /></QueryClientProvider>);
}
test('missing scoring dependency never invents scores or fetches candidates', async () => {
  const repository = repo(); show(repository); expect(screen.getByText('Chưa có quy tắc matching dùng chung')).toBeVisible();
  fireEvent.change(await screen.findByLabelText('Chọn lô cần matching'), { target: { value: 'lot-1' } });
  expect(repository.candidates).not.toHaveBeenCalled(); expect(screen.queryByText(/Phù hợp 86/)).not.toBeInTheDocument();
});
test('result UI preserves supplied rule/reasons/partial quantity and excludes private fields', async () => {
  const repository = repo(); show(repository, () => [match]);
  fireEvent.change(await screen.findByLabelText('Chọn lô cần matching'), { target: { value: 'lot-1' } });
  expect(await screen.findByText('Buyer công khai')).toBeVisible(); expect(screen.getByText('Cùng loại quả')).toBeVisible(); expect(screen.getByText(/1000 kg đề xuất/)).toBeVisible(); expect(screen.getByText(/Chấp nhận một phần/)).toBeVisible();
});
test('empty result and broken scoring contract are explicit states', async () => {
  const first = show(repo(), () => []); fireEvent.change(await screen.findByLabelText('Chọn lô cần matching'), { target: { value: 'lot-1' } }); expect(await screen.findByText('Không có người mua phù hợp')).toBeVisible(); first.unmount();
  show(repo(), () => [{ ...match, score: NaN }]); fireEvent.change(await screen.findByLabelText('Chọn lô cần matching'), { target: { value: 'lot-1' } }); expect(await screen.findByRole('alert')).toHaveTextContent('không đúng contract');
});
test('contract rejects foreign IDs, duplicate matches, invalid scores/quantities', () => {
  for (const value of [{ ...match, lotId: 'foreign' }, { ...match, requestId: 'foreign' }, { ...match, score: 101 }, { ...match, suggestedQuantityKg: 999999 }]) expect(() => validateMatches(testLot(), [request], [value])).toThrow();
  expect(() => validateMatches(testLot(), [request], [match, match])).toThrow();
});
test('connect passes only public deal context, not arbitrary fields from lot rows', async () => {
  const repository = repo();
  repository.candidates = async () => ({ lot: { ...testLot(), internal_notes: 'PRIVATE', price_floor_vnd_per_kg: 1000 } as ReturnType<typeof testLot>, requests: [request], partners: [{ user_id: 'b', display_name: 'Buyer công khai', province: null }] });
  const connect = vi.fn(); const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><FarmerMatchingPanel authenticatedUserId="u" repository={repository} scorer={() => [match]} onConnect={connect} initialLotId="lot-1" /></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Trao đổi minh họa' }));
  expect(connect).toHaveBeenCalledWith('lot-1', 'b', { partnerId: 'b', name: 'Buyer công khai', lotId: 'lot-1', fruit: 'Lô Ri6', quantity: 1000, price: 65000, province: 'Tiền Giang' });
});
test('candidate adapter refuses oversize sets instead of scoring a truncated first page; public projection only', async () => {
  const projections: string[] = []; let table = '';
  const from = vi.fn((name: string) => { table = name; const current = name;
    const done = async () => current === 'lots' ? { data: testLot(), error: null } : { data: Array(100).fill(request), count: 1001, error: null };
    const chain: Record<string, unknown> = {}; for (const method of ['eq', 'lte', 'gte', 'order', 'range']) chain[method] = () => chain;
    chain.select = (columns: string) => { projections.push(columns); return chain; }; chain.maybeSingle = done; chain.then = (resolve: (value: unknown) => unknown) => done().then(resolve); return chain;
  });
  const repository = createFarmerMatchingRepository({ from, auth: { getUser: async () => ({ data: { user: { id: 'u' } }, error: null }) } } as unknown as SupabaseClient);
  await expect(repository.candidates('u', 'lot-1')).rejects.toThrow('Quá nhiều ứng viên'); expect(projections.join(',')).not.toMatch(/phone|address|private|floor/); expect(table).toBe('buy_requests');
});
