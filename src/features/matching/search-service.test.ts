// @vitest-environment node
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
const row = { id: lot.id, cosineSimilarity: 0.9, eligibleCount: 1, truncated: false };
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
  it('uses E5 cosine only with a valid embedding and returns relation path', async () => {
    const result = await searchMatches(buyerInput, 'buyer-1', repo(), {
      query: async () => Array(768).fill(0.01),
    });
    expect(result.meta.mode).toBe('hybrid');
    expect(result.items[0].relevance).toBe(0.9);
    expect(result.items[0].cosineSimilarity).toBe(0.9);
    expect(result.meta.modelVersion).toBe('multilingual-e5-base-v1');
    expect(result.meta.rankingScope).toBe('vector_top20');
    expect(result.items[0].graphPaths[0]).toContain('giống');
  });
  it('degrades on inference failure and rechecks closed lots', async () => {
    const degraded = await searchMatches(buyerInput, 'buyer-1', repo(), {
      query: async () => { throw new Error('timeout'); },
    });
    expect(degraded.meta.mode).toBe('degraded');
    expect(degraded.items[0].score).toBe(67.33);
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
  it('caps by vector cosine before text reranking and never admits candidate 21', async () => {
    const candidates = Array.from({ length: 21 }, (_, index) => ({ ...row,
      id: `lot-${String(index + 1).padStart(2, '0')}`, cosineSimilarity: 0.99 - index / 100,
      eligibleCount: 21, truncated: true,
    }));
    let loaded: string[] = [];
    const result = await searchMatches({ ...buyerInput, text: 'Monthong', pageSize: 50 }, 'buyer-1', repo({
      lotCandidates: async () => [...candidates].reverse(),
      lots: async ids => { loaded = ids; return candidates.map((candidate, index) => ({ ...lot,
        id: candidate.id, title: index === 20 ? 'Monthong' : 'Ri6',
      })); }, // Deliberately returns an extra row: the service still refuses it.
    }), { query: async () => Array(768).fill(0.01) });
    expect(loaded).toHaveLength(20);
    expect(loaded).not.toContain('lot-21');
    expect(result.items).toHaveLength(20);
    expect(result.items.some(item => 'lot' in item && item.lot.id === 'lot-21')).toBe(false);
    expect(result.meta.candidateCount).toBe(20);
    expect(result.meta.eligibleCount).toBe(21);
  });
  it('reranks the vector pool before pagination and does not backfill after exclusions', async () => {
    const candidates = Array.from({ length: 21 }, (_, index) => ({ ...row,
      id: `lot-${String(index + 1).padStart(2, '0')}`, cosineSimilarity: 0.99 - index / 100,
      eligibleCount: 21, truncated: true,
    }));
    const source = { ...request, variety_id: null };
    const repository = repo({ getBuyerRequest: async () => source, lotCandidates: async () => candidates,
      lots: async ids => ids.map((id, index) => ({ ...lot, id,
        title: index === 19 ? 'Sầu riêng Ri6' : 'Sầu riêng Monthong', variety_id: index === 19 ? 'ri6' : 'monthong',
      })) });
    const provider = { query: async () => Array(768).fill(0.01) };
    const first = await searchMatches({ ...buyerInput, text: 'Ri6', pageSize: 1 }, 'buyer-1', repository, provider);
    expect(first.items[0]).toHaveProperty('lot.id', 'lot-20');
    const excluded = await searchMatches({ ...buyerInput, text: 'Ri6 không lấy Monthong' }, 'buyer-1', repository, provider);
    expect(excluded.items.map(item => 'lot' in item ? item.lot.id : null)).toEqual(['lot-20']);
    expect(excluded.meta.candidateCount).toBe(20);
    expect(excluded.meta.resultCount).toBe(1);
  });
  it('caps Farmer vector candidates before reranking too', async () => {
    let loaded: string[] = [];
    const result = await searchMatches({ direction: 'farmer-to-requests', sourceId: lot.id,
      text: 'Ri6', page: 1, pageSize: 50 }, 'farmer-1', repo({
      requestCandidates: async () => Array.from({ length: 23 }, (_, index) => ({ ...row,
        id: `request-${index}`, cosineSimilarity: 0.99 - index / 100, eligibleCount: 23 })),
      requests: async ids => { loaded = ids; return ids.map(id => ({ ...request, id })); },
    }), { query: async () => Array(768).fill(0.01) });
    expect(loaded).toHaveLength(20);
    expect(result.items).toHaveLength(20);
  });
  it.each([Array(384).fill(0.01), Array(768).fill(0), Array(768).fill(NaN)].map(vector => ({ vector })))(
    'marks invalid embeddings as degraded instead of pretending to run vector search', async ({ vector }) => {
      let received: number[] | null | undefined;
      const result = await searchMatches(buyerInput, 'buyer-1', repo({
        lotCandidates: async (_, embedding) => { received = embedding; return [row]; },
      }), { query: async () => vector });
      expect(received).toBeNull();
      expect(result.meta.mode).toBe('degraded');
      expect(result.meta.modelVersion).toBeNull();
    });
  it('keeps an empty vector pool empty, without lexical/graph expansion', async () => {
    const result = await searchMatches(buyerInput, 'buyer-1', repo({ lotCandidates: async () => [] }),
      { query: async () => Array(768).fill(0.01) });
    expect(result.items).toHaveLength(0);
    expect(result.meta.mode).toBe('hybrid');
    expect(result.meta.candidateCount).toBe(0);
  });
});
