import { describe, expect, it } from 'vitest';
import type { BuyRequest, Lot } from '../../lib/domain';
import { searchMatches, SearchAccessError, type SearchRepository } from './search-service';

const request: BuyRequest = {
  id: 'request-1', buyer_id: 'buyer-1', fruit_type_id: 'durian', variety_id: 'ri6',
  title: 'Thu mua Ri6', grade: 'A', target_quantity_kg: 50000,
  min_lot_quantity_kg: 5000, allow_partial: true, min_price_vnd_per_kg: 60000,
  max_price_vnd_per_kg: 70000, required_start: '2026-10-20', required_end: '2026-10-30',
  preferred_provinces: ['Đồng Nai'], preferred_districts: [], quality_requirements: [],
  packaging_options: [], buying_method: 'BY_GRADE', transport_by: 'BUYER', notes: '',
  status: 'OPEN', created_at: '', updated_at: '',
};
const lot: Lot = {
  id: 'lot-1', farmer_id: 'farmer-1', fruit_type_id: 'durian', variety_id: 'ri6',
  title: 'Sầu riêng Ri6', grade: 'A', quantity_kg: 15000, price_vnd_per_kg: 65000,
  harvest_start: '2026-10-20', harvest_end: '2026-10-28', province: 'Đồng Nai',
  district: null, certifications: [], packaging_options: [], selling_method: 'BY_GRADE',
  description: 'Cơm vàng', status: 'PUBLISHED', created_at: '',
};
const row = { id: lot.id, semanticRank: 1, lexicalRank: 1, eligibleCount: 1, truncated: false };
function repo(override: Partial<SearchRepository> = {}): SearchRepository {
  return {
    getBuyerRequest: async (_, user) => user === request.buyer_id ? request : null,
    getFarmerLot: async (_, user) => user === lot.farmer_id ? lot : null,
    lotCandidates: async () => [row], requestCandidates: async () => [{ ...row, id: request.id }],
    lots: async () => [lot], requests: async () => [request], ...override,
  };
}
const buyerInput = { direction: 'buyer-to-lots' as const, sourceId: request.id,
  text: 'Ri6', page: 1, pageSize: 12 };

describe('search orchestration', () => {
  it('requires ownership of the source before querying candidates', async () => {
    let called = false;
    await expect(searchMatches(buyerInput, 'other-buyer', repo({
      lotCandidates: async () => { called = true; return []; },
    }))).rejects.toBeInstanceOf(SearchAccessError);
    expect(called).toBe(false);
  });
  it('uses semantic ranks only with a valid embedding and returns relation path', async () => {
    const result = await searchMatches(buyerInput, 'buyer-1', repo(), {
      query: async () => Array(768).fill(0.01),
    });
    expect(result.meta.mode).toBe('hybrid');
    expect(result.items[0].relevance).toBe(1);
    expect(result.items[0].graphPaths[0]).toContain('giống');
  });
  it('degrades on inference failure and rechecks closed lots', async () => {
    const degraded = await searchMatches(buyerInput, 'buyer-1', repo(), {
      query: async () => { throw new Error('timeout'); },
    });
    expect(degraded.meta.mode).toBe('degraded');
    expect(degraded.items[0].score).toBe(75.5);
    const stale = await searchMatches(buyerInput, 'buyer-1', repo({
      lots: async () => [{ ...lot, status: 'CLOSED' }],
    }));
    expect(stale.items).toHaveLength(0);
  });
  it('retrieves open Buyer requests for the Farmer direction', async () => {
    const result = await searchMatches({ direction: 'farmer-to-requests', sourceId: lot.id,
      text: '', page: 1, pageSize: 12 }, 'farmer-1', repo());
    expect(result.items[0]).toHaveProperty('request.id', request.id);
    expect(result.meta.mode).toBe('degraded');
  });
});
