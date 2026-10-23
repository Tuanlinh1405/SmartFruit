import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createFarmerMatchingRepository, FarmerMatchingPanel, validateMatches, type BuyCandidate, type FarmerMatchingRepository, type MatchResult } from './farmer-matching';
import { testLot } from '../lots/lot.fixtures';
const request: BuyCandidate = { id: 'r', status: 'OPEN', buyer_id: 'b', fruit_type_id: 'fruit-1', variety_id: null, title: 'Nhu cầu', target_quantity_kg: 5000, min_lot_quantity_kg: null, allow_partial: true, min_price_vnd_per_kg: 60000, max_price_vnd_per_kg: 70000, required_start: '2026-10-15', required_end: '2026-10-20', preferred_provinces: [] };
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
test('result UI displays business facts and percentage while hiding scoring internals', async () => {
  const repository = repo(); show(repository, () => [match]);
  fireEvent.change(await screen.findByLabelText('Chọn lô cần matching'), { target: { value: 'lot-1' } });
  expect(await screen.findByText('Buyer công khai')).toBeVisible(); expect(screen.getByText('86.0% phù hợp')).toBeVisible();expect(screen.getByText('Sản lượng nhập')).toBeVisible();expect(screen.queryByText(/Quy tắc|Cosine|fixture-only/)).not.toBeInTheDocument();
});

test('buyer card opens full request details without sending an invitation and routes message intent', async () => {
  const repository=repo();repository.candidates=async()=>({lot:testLot(),requests:[{...request,quality_requirements:['VietGAP'],packaging_options:['CARTON'],notes:'Nhận tại điểm tập kết'}],partners:[{user_id:'b',display_name:'Thu mua An Phú',province:'Đồng Nai'}]});
  const connect=vi.fn();const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  render(<QueryClientProvider client={client}><FarmerMatchingPanel authenticatedUserId="u" repository={repository} scorer={()=>[match]} initialLotId="lot-1" onConnect={connect}/></QueryClientProvider>);
  expect(await screen.findByText('Thu mua An Phú')).toBeVisible();expect(screen.getByText('Đồng Nai')).toBeVisible();expect(screen.getByText('Thùng carton')).toBeVisible();
  await userEvent.click(screen.getByRole('button',{name:'Xem chi tiết'}));expect(screen.getByRole('dialog')).toHaveTextContent('Nhận tại điểm tập kết');expect(connect).not.toHaveBeenCalled();
  expect(screen.queryByText(/45\s*km|Cosine|fixture-only/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Đóng chi tiết'}));await userEvent.click(screen.getByRole('button',{name:'Nhắn tin'}));expect(connect).toHaveBeenCalledWith('lot-1','r','message');
});
test('empty result and broken scoring contract are explicit states', async () => {
  const first = show(repo(), () => []); fireEvent.change(await screen.findByLabelText('Chọn lô cần matching'), { target: { value: 'lot-1' } }); expect(await screen.findByText('Không có người mua phù hợp')).toBeVisible(); first.unmount();
  show(repo(), () => [{ ...match, score: NaN }]); fireEvent.change(await screen.findByLabelText('Chọn lô cần matching'), { target: { value: 'lot-1' } }); expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tìm người mua lúc này');
});
test('contract rejects foreign IDs, duplicate matches, invalid scores/quantities', () => {
  for (const value of [{ ...match, lotId: 'foreign' }, { ...match, requestId: 'foreign' }, { ...match, score: 101 }, { ...match, suggestedQuantityKg: 999999 }]) expect(() => validateMatches(testLot(), [request], [value])).toThrow();
  expect(() => validateMatches(testLot(), [request], [match, match])).toThrow();
});
test('connect passes only lot and request IDs, not private fields', async () => {
  const repository = repo();
  repository.candidates = async () => ({ lot: { ...testLot(), internal_notes: 'PRIVATE', price_floor_vnd_per_kg: 1000 } as ReturnType<typeof testLot>, requests: [request], partners: [{ user_id: 'b', display_name: 'Buyer công khai', province: null }] });
  const connect = vi.fn(); const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><FarmerMatchingPanel authenticatedUserId="u" repository={repository} scorer={() => [match]} onConnect={connect} initialLotId="lot-1" /></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Gửi đề nghị' }));
  expect(connect).toHaveBeenCalledWith('lot-1', 'r', 'offer');
});
test('connection failure stays on matching and allows retry without duplicate submissions', async () => {
  let reject!: (reason: Error) => void;
  const connect = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; })).mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><FarmerMatchingPanel authenticatedUserId="u" repository={repo()} scorer={() => [match]} initialLotId="lot-1" onConnect={connect} /></QueryClientProvider>);
  const button = await screen.findByRole('button', { name: 'Gửi đề nghị' });
  fireEvent.click(button); fireEvent.click(button);
  expect(connect).toHaveBeenCalledTimes(1); expect(button).toBeDisabled();
  reject(new Error('Không gửi được lời mời'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không gửi được lời mời');
  await userEvent.click(screen.getByRole('button', { name: 'Gửi đề nghị' }));
  await waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
  expect(connect).toHaveBeenLastCalledWith('lot-1', 'r', 'offer');
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
