import { expect, test, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { searchFarmerCandidates } from './hybrid-search';
import { testLot } from '../lots/lot.fixtures';

const item = (id: string) => ({ request: { id, buyer_id: 'buyer' }, score: 87,
  nameMatch: { reason: 'Khớp giống Ri6' }, business: { reasons: ['Giá phù hợp'], contributionKg: 2000 },
  ruleVersion: 'e5-top20-name-rerank-v2', cosineSimilarity: 0.91 });
function fixture(items = [item('second'), item('first')], meta = { mode: 'hybrid', rankingScope: 'vector_top20' }) {
  const invoke = vi.fn(async () => ({ data: { items, meta }, error: null }));
  const inside = vi.fn(async () => ({ data: [{ user_id: 'buyer', display_name: 'Test', province: null }], error: null }));
  const select = vi.fn(() => ({ in: inside })); const from = vi.fn(() => ({ select }));
  return { client: { functions: { invoke }, from } as unknown as SupabaseClient, invoke, from, select };
}
test('Farmer uses server top 20 order, cosine and name reasons without loading extra requests', async () => {
  const { client, invoke, from } = fixture(); const lot = testLot();
  const result = await searchFarmerCandidates(client, lot);
  expect(invoke).toHaveBeenCalledWith('search-matches', { body: { direction: 'farmer-to-requests', sourceId: lot.id, text: '', page: 1, pageSize: 20 } });
  expect(result.matches.map(row => row.requestId)).toEqual(['second', 'first']);
  expect(result.matches[0]).toMatchObject({ cosineSimilarity: 0.91, reasons: ['Khớp giống Ri6', 'Giá phù hợp'] });
  expect(from).toHaveBeenCalledTimes(1); expect(from).toHaveBeenCalledWith('marketplace_profiles');
});
test('successful empty retrieval stays empty and does not fetch partners or backfill', async () => {
  const { client, from } = fixture([]); const result = await searchFarmerCandidates(client, testLot());
  expect(result.matches).toEqual([]); expect(result.mode).toBe('hybrid'); expect(from).not.toHaveBeenCalled();
});
test('rejects hybrid candidates outside vector top 20', async () => {
  await expect(searchFarmerCandidates(fixture(Array.from({ length: 21 }, (_, i) => item(String(i)))).client, testLot())).rejects.toThrow();
  await expect(searchFarmerCandidates(fixture([], { mode: 'hybrid', rankingScope: 'all_eligible' }).client, testLot())).rejects.toThrow();
});
test('keeps degraded server mode explicit', async () => {
  expect((await searchFarmerCandidates(fixture([], { mode: 'degraded', rankingScope: 'all_eligible' }).client, testLot())).mode).toBe('degraded');
});
