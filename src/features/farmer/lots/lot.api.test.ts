import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, test, vi } from 'vitest';
import { createLotRepositories, escapeLike } from './lot.api';
import { initialLotFilters } from './lot.model';
import { testCatalog, testInput, testLot } from './lot.fixtures';

type Response = { data: unknown; error: { code?: string; message?: string } | null; count?: number | null };
type Call = { table: string; method: string; args: unknown[] };
function setup(responses: Record<string, Response[]> = {}) {
  const calls: Call[] = [];
  const defaults: Record<string, unknown> = { lots: testLot(), farmer_profiles: { user_id: 'farmer-1' }, fruit_types: testCatalog.fruits,
    fruit_varieties: testCatalog.varieties, lot_images: [], lot_private_details: null };
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'farmer-1' } }, error: null });
  const from = vi.fn((table: string) => {
    const finish = () => Promise.resolve(responses[table]?.shift() ?? { data: defaults[table], error: null });
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'ilike', 'order', 'range', 'insert', 'update', 'delete', 'limit']) {
      chain[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return chain; };
    }
    chain.single = finish; chain.maybeSingle = finish;
    chain.then = (resolve: (value: Response) => unknown, reject: (error: unknown) => unknown) => finish().then(resolve, reject);
    return chain;
  });
  return { ...createLotRepositories({ auth: { getUser }, from } as unknown as SupabaseClient), calls, from, getUser };
}
const success = (data: unknown, count?: number): Response => ({ data, error: null, count });
const failure = (code = '42501'): Response => ({ data: null, error: { code, message: 'PRIVATE SERVER DETAIL' } });

test('list filters/sorts/ranges at server, uses stable tie-break and only public columns', async () => {
  const s = setup({ lots: [success([testLot()], 21)] });
  expect(await s.lots.list('farmer-1', { ...initialLotFilters, page: 2, search: '50%_', status: 'DRAFT', fruitTypeId: 'fruit-1', province: ' Tiền Giang ', sort: 'price_asc' }))
    .toEqual({ rows: [testLot()], count: 21 });
  const calls = s.calls.filter(call => call.table === 'lots');
  expect(calls).toContainEqual({ table: 'lots', method: 'range', args: [20, 39] });
  expect(calls).toContainEqual({ table: 'lots', method: 'ilike', args: ['title', '%50\\%\\_%'] });
  expect(calls).toContainEqual({ table: 'lots', method: 'eq', args: ['farmer_id', 'farmer-1'] });
  expect(calls.filter(call => call.method === 'order').map(call => call.args)).toEqual([['price_vnd_per_kg', { ascending: true }], ['id', { ascending: true }]]);
  expect(calls[0].args[0]).not.toMatch(/private|floor|notes/);
  expect(escapeLike('a\\b_%')).toBe('a\\\\b\\_\\%');
});
test('newest order is created_at then id; missing list counts and API failures fail closed', async () => {
  const s = setup({ lots: [success([], 0), { data: [], count: null, error: null }, failure()] });
  await s.lots.list('farmer-1', initialLotFilters);
  expect(s.calls).toContainEqual({ table: 'lots', method: 'order', args: ['created_at', { ascending: false }] });
  await expect(s.lots.list('farmer-1', initialLotFilters)).rejects.toThrow('Không thể tải');
  await expect(s.lots.list('farmer-1', initialLotFilters)).rejects.toThrow('Không thể tải');
});
test.each(['missing', 'foreign', 'expired'])('all entry points reject %s Auth before DB access', async kind => {
  const s = setup();
  s.getUser.mockResolvedValue({ data: { user: kind === 'missing' ? null : { id: kind === 'foreign' ? 'other' : 'farmer-1' } }, error: kind === 'expired' ? { message: 'expired' } : null });
  for (const operation of [
    () => s.lots.hasFarmerProfile('farmer-1'), () => s.lots.catalog('farmer-1'),
    () => s.lots.list('farmer-1', initialLotFilters), () => s.lots.detail('farmer-1', 'lot-1'),
    () => s.lots.createDraft('farmer-1', testInput, 'draft-id'), () => s.lots.update('farmer-1', 'lot-1', testInput),
    () => s.lots.changeStatus('farmer-1', 'lot-1', 'PUBLISHED'), () => s.lots.remove('farmer-1', 'lot-1'),
    () => s.privateDetails.load('farmer-1', 'lot-1'), () => s.privateDetails.save('farmer-1', 'lot-1', { price_floor_vnd_per_kg: null, internal_notes: '' }),
  ]) await expect(operation()).rejects.toThrow('Phiên đăng nhập');
  expect(s.from).not.toHaveBeenCalled();
});
test('create always inserts DRAFT with stable id, default owner and business fields only', async () => {
  const s = setup();
  await s.lots.createDraft('farmer-1', { ...testInput, farmer_id: 'forged', status: 'PUBLISHED', created_at: 'forged', internal_notes: 'SECRET' } as typeof testInput, 'stable-id');
  expect(s.calls.find(call => call.table === 'lots' && call.method === 'insert')?.args).toEqual([{ ...testInput, id: 'stable-id', status: 'DRAFT' }]);
});
test('missing profile and inactive/invalid catalog block creation before insert', async () => {
  const missing = setup({ farmer_profiles: [success(null)] });
  await expect(missing.lots.createDraft('farmer-1', testInput, 'id')).rejects.toThrow('hồ sơ nhà vườn');
  const invalid = setup();
  await expect(invalid.lots.createDraft('farmer-1', { ...testInput, variety_id: 'variety-2' }, 'id')).rejects.toThrow('chưa hợp lệ');
  expect([...missing.calls, ...invalid.calls].some(call => call.method === 'insert')).toBe(false);
});
test('service refuses non-finite or overprecise kg without rounding them through form mapping', async () => {
  for (const quantity_kg of [Infinity, NaN, 1.0001, 0.0001]) {
    const s = setup();
    await expect(s.lots.createDraft('farmer-1', { ...testInput, quantity_kg }, 'id')).rejects.toThrow('Khối lượng không hợp lệ');
    expect(s.calls.some(call => call.method === 'insert')).toBe(false);
  }
});
test('ambiguous insert retry reuses draft id instead of creating a second lot', async () => {
  const s = setup({ lots: [failure('23505'), success(testLot({ id: 'same-id' })), success(testLot({ id: 'same-id' }))] });
  await expect(s.lots.createDraft('farmer-1', testInput, 'same-id')).resolves.toMatchObject({ id: 'same-id' });
  expect(s.calls.filter(call => call.table === 'lots' && call.method === 'insert')).toHaveLength(1);
  expect(s.calls.find(call => call.table === 'lots' && call.method === 'update')?.args).toEqual([testInput]);
});
test('update whitelists content, never status/owner; unknown private price blocks public update', async () => {
  const s = setup(); await s.lots.update('farmer-1', 'lot-1', { ...testInput, status: 'CLOSED', updated_at: 'bad' } as typeof testInput);
  expect(s.calls.find(call => call.table === 'lots' && call.method === 'update')?.args).toEqual([testInput]);
  const privateError = setup({ lot_private_details: [failure()] });
  await expect(privateError.lots.update('farmer-1', 'lot-1', testInput)).rejects.toThrow('Chưa thể xác nhận giá sàn');
  expect(privateError.calls.some(call => call.method === 'update')).toBe(false);
});
test('lower asking price requires lowering floor first; a concurrent DB constraint failure stays an error', async () => {
  const s = setup({ lot_private_details: [success({ price_floor_vnd_per_kg: 60000, internal_notes: '' })] });
  await expect(s.lots.update('farmer-1', 'lot-1', { ...testInput, price_vnd_per_kg: 59000 })).rejects.toThrow('giá sàn thấp hơn');
  const race = setup({ lots: [success(testLot()), failure('23514')] });
  await expect(race.lots.update('farmer-1', 'lot-1', testInput)).rejects.toThrow('Chưa lưu được');
});
test('zero-row update/status/delete and inaccessible detail cannot report success', async () => {
  await expect(setup({ lots: [success(null)] }).lots.detail('farmer-1', 'lot-1')).rejects.toThrow('Không tìm thấy');
  await expect(setup({ lots: [success(testLot()), success(null)] }).lots.update('farmer-1', 'lot-1', testInput)).rejects.toThrow('Chưa lưu');
  await expect(setup({ lots: [success(testLot()), success(null)] }).lots.changeStatus('farmer-1', 'lot-1', 'PUBLISHED')).rejects.toThrow('Chưa đổi');
  await expect(setup({ lots: [success(testLot()), success(null)] }).lots.remove('farmer-1', 'lot-1')).rejects.toThrow('Chưa xóa');
});
test('status checks current state, writes status alone and guards concurrent status changes', async () => {
  const s = setup(); await s.lots.changeStatus('farmer-1', 'lot-1', 'PUBLISHED');
  expect(s.calls).toContainEqual({ table: 'lots', method: 'update', args: [{ status: 'PUBLISHED' }] });
  expect(s.calls).toContainEqual({ table: 'lots', method: 'eq', args: ['status', 'DRAFT'] });
  await expect(setup({ lots: [success(testLot({ status: 'CLOSED' }))] }).lots.changeStatus('farmer-1', 'lot-1', 'PUBLISHED')).rejects.toThrow('Không thể chuyển');
});
test('delete refuses existing images or unknown image state; empty image list permits deletion', async () => {
  for (const response of [success([{ id: 'image-1' }]), failure()]) {
    const s = setup({ lot_images: [response] });
    await expect(s.lots.remove('farmer-1', 'lot-1')).rejects.toThrow();
    expect(s.calls.some(call => call.method === 'delete')).toBe(false);
  }
  const empty = setup(); await empty.lots.remove('farmer-1', 'lot-1');
  expect(empty.calls.some(call => call.method === 'delete')).toBe(true);
});
test('private data has separate projection, explicit insert/update and no immutable columns in update', async () => {
  const input = { price_floor_vnd_per_kg: null, internal_notes: 'SECRET' };
  const create = setup({ lot_private_details: [success(null), success(input)] });
  await expect(create.privateDetails.save('farmer-1', 'lot-1', input)).resolves.toEqual(input);
  expect(create.calls).toContainEqual({ table: 'lot_private_details', method: 'insert', args: [{ ...input, lot_id: 'lot-1' }] });
  const update = setup({ lot_private_details: [success(input), success(input)] });
  await update.privateDetails.save('farmer-1', 'lot-1', { ...input, lot_id: 'forged', updated_at: 'forged' } as typeof input);
  expect(update.calls).toContainEqual({ table: 'lot_private_details', method: 'update', args: [input] });
  await expect(setup().privateDetails.save('farmer-1', 'lot-1', { ...input, price_floor_vnd_per_kg: 65001 })).rejects.toThrow('không vượt giá chào');
  await expect(setup({ lot_private_details: [success(null), failure()] }).privateDetails.save('farmer-1', 'lot-1', input)).rejects.toThrow('Chưa lưu được thông tin riêng');
});
