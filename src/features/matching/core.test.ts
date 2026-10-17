// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { BuyRequest, Lot } from '../../lib/domain';
import { baselineScore, lexicalRank, rankMatches, rankRequestMatches, scoreBusiness } from './core';

const request: BuyRequest = {
  id: 'r', buyer_id: 'b', fruit_type_id: 'durian', variety_id: 'ri6',
  title: 'Sầu riêng Ri6', grade: 'A', target_quantity_kg: 50000,
  min_lot_quantity_kg: 5000, allow_partial: true, min_price_vnd_per_kg: 60000,
  max_price_vnd_per_kg: 70000, required_start: '2026-10-20', required_end: '2026-10-30',
  preferred_provinces: ['Đồng Nai'], preferred_districts: [], quality_requirements: [],
  packaging_options: [], buying_method: 'BY_GRADE', transport_by: 'BUYER', notes: '',
  status: 'OPEN', created_at: '', updated_at: '',
};
const lot: Lot = {
  id: 'a', farmer_id: 'f', fruit_type_id: 'durian', variety_id: 'ri6',
  title: 'Sầu riêng Ri6 loại A', grade: 'A', quantity_kg: 15000,
  price_vnd_per_kg: 65000, harvest_start: '2026-10-20', harvest_end: '2026-10-28',
  province: 'Đồng Nai', district: null, certifications: [], packaging_options: [],
  selling_method: 'BY_GRADE', description: 'Cơm vàng', status: 'PUBLISHED', created_at: '',
};

describe('matching', () => {
  it('scores seeded Ri6 pair and keeps partial quantity explicit', () => {
    const result = scoreBusiness(lot, request);
    expect(result.eligible).toBe(true);
    expect(result.remainingKg).toBe(35000);
    expect(baselineScore(result)).toBeCloseTo(67.333333);
  });
  it('rejects wrong variety, closed lot, no date overlap and insufficient minimum', () => {
    expect(scoreBusiness({ ...lot, variety_id: 'monthong' }, request).eligible).toBe(false);
    expect(scoreBusiness({ ...lot, status: 'CLOSED' }, request).eligible).toBe(false);
    expect(scoreBusiness({ ...lot, harvest_start: '2026-11-01' }, request).eligible).toBe(false);
    expect(scoreBusiness({ ...lot, quantity_kg: 1000 }, request).eligible).toBe(false);
  });
  it('treats a shared boundary day as overlapping and handles no-partial', () => {
    expect(scoreBusiness({ ...lot, harvest_start: request.required_end }, request).eligible).toBe(true);
    expect(scoreBusiness(lot, { ...request, allow_partial: false }).eligible).toBe(false);
  });
  it('ranks by raw score then stable ID and never revives an ineligible lot', () => {
    const results = rankMatches([
      { lot: { ...lot, id: 'b' }, cosineSimilarity: 1 },
      { lot, cosineSimilarity: 1 },
      { lot: { ...lot, id: 'closed', status: 'CLOSED' }, cosineSimilarity: 1 },
    ], request, 'hybrid');
    expect(results.map(row => row.lot.id)).toEqual(['a', 'b']);
    expect(results[0].relevance).toBe(1);
  });
  it('handles price out of range as a soft preference', () => {
    const result = scoreBusiness({ ...lot, price_vnd_per_kg: 84000, province: 'Lâm Đồng' }, request);
    expect(result.eligible).toBe(true);
    expect(result.priceFit).toBe(0);
    expect(baselineScore(result)).toBeCloseTo(14);
  });
  it.each(['rule-only', 'degraded', 'hybrid'] as const)(
    'ignores stored geography in Buyer results in %s mode', mode => {
      const candidates = [
        { lot: { ...lot, id: 'b', province: 'Lâm Đồng', district: 'Đức Trọng' }, cosineSimilarity: 1 },
        { lot, cosineSimilarity: 1 },
      ];
      const before = rankMatches(candidates, request, mode);
      const after = rankMatches(candidates.map(candidate => ({ ...candidate,
        lot: { ...candidate.lot, province: '', district: null },
      })), { ...request, preferred_provinces: [], preferred_districts: ['Khác huyện'] }, mode);
      const scores = (rows: typeof before) => rows.map(row => ({ id: row.lot.id,
        score: row.score, rawScore: row.rawScore, business: row.business }));
      expect(before.map(row => row.lot.id)).toEqual(['a', 'b']);
      expect(scores(after)).toEqual(scores(before));
      expect(before[0].business.reasons.join(' ')).not.toMatch(/tỉnh|khu vực|khoảng cách/);
    });
  it.each(['rule-only', 'degraded', 'hybrid'] as const)(
    'ignores stored geography in Farmer results in %s mode', mode => {
      const candidates = [
        { request: { ...request, id: 'b', preferred_provinces: ['Lâm Đồng'], preferred_districts: ['Đức Trọng'] }, cosineSimilarity: 1 },
        { request: { ...request, id: 'a' }, cosineSimilarity: 1 },
      ];
      const before = rankRequestMatches(candidates, lot, mode);
      const after = rankRequestMatches(candidates.map(candidate => ({ ...candidate,
        request: { ...candidate.request, preferred_provinces: [], preferred_districts: [] },
      })), { ...lot, province: 'Khác tỉnh', district: 'Khác huyện' }, mode);
      const scores = (rows: typeof before) => rows.map(row => ({ id: row.request.id,
        score: row.score, rawScore: row.rawScore, business: row.business }));
      expect(before.map(row => row.request.id)).toEqual(['a', 'b']);
      expect(scores(after)).toEqual(scores(before));
    });
  it('ranks eligible lots by price and quantity and gives a full fit 100 points', () => {
    const results = rankMatches([
      { lot: { ...lot, id: 'expensive', quantity_kg: 50000, price_vnd_per_kg: 84000 } },
      { lot: { ...lot, id: 'wrong-product', variety_id: 'monthong', quantity_kg: 50000 } },
      { lot: { ...lot, id: 'partial' } },
      { lot: { ...lot, id: 'full', quantity_kg: 50000 } },
    ], request, 'rule-only');
    expect(results.map(row => row.lot.id)).toEqual(['full', 'partial', 'expensive']);
    expect(results[0].score).toBe(100);
    expect(rankMatches([{ lot: { ...lot, quantity_kg: 50000 }, cosineSimilarity: 1 }],
      request, 'hybrid')[0].score).toBe(100);
  });
  it('finds Vietnamese words with or without accent', () => {
    expect(lexicalRank([lot], 'sau rieng ri6').get('a')).toBe(1);
  });
  it('reranks exact cultivar words above a higher cosine and better commercial fit', () => {
    const results = rankMatches([
      { lot: { ...lot, id: 'wrong', title: 'Sầu riêng Monthong', variety_id: 'monthong', quantity_kg: 50000 }, cosineSimilarity: 0.99 },
      { lot: { ...lot, id: 'right', title: 'Sầu riêng Ri6' }, cosineSimilarity: 0.82 },
    ], { ...request, variety_id: null }, 'hybrid');
    expect(results.map(row => row.lot.id)).toEqual(['right', 'wrong']);
    expect(results[0].nameMatch.kind).toBe('exact');
    expect(results[0].cosineSimilarity).toBe(0.82);
    expect(results[0].score).toBeLessThan(results[1].score);
  });
  it('uses catalog names even when the listing title is generic', () => {
    const results = rankMatches([{ lot: { ...lot, title: 'Lô vừa thu hoạch' } }], request, 'rule-only', {
      text: 'Sầu riêng Ri6', catalog: { types: [{ id: 'durian', name: 'Sầu riêng' }],
        varieties: [{ id: 'ri6', name: 'Ri6' }] },
    });
    expect(results[0].nameMatch.kind).toBe('exact');
  });
  it('filters negated cultivars without overriding structured variety eligibility', () => {
    const candidates = [
      { lot, cosineSimilarity: 0.8 },
      { lot: { ...lot, id: 'monthong', title: 'Sầu riêng Monthong', variety_id: 'monthong' }, cosineSimilarity: 0.99 },
    ];
    expect(rankMatches(candidates, { ...request, variety_id: null }, 'hybrid', {
      text: 'Sầu riêng Ri6 không lấy Monthong',
    }).map(row => row.lot.id)).toEqual(['a']);
    expect(rankMatches(candidates, request, 'hybrid', { text: 'Monthong' })
      .some(row => row.lot.id === 'monthong')).toBe(false);
  });
  it('respects the Buyer exclusion when the Farmer searches in reverse', () => {
    const results = rankRequestMatches([{ request: { ...request, variety_id: null,
      title: 'Sầu riêng không lấy Monthong' } }],
    { ...lot, title: 'Sầu riêng Monthong', variety_id: 'monthong' }, 'rule-only');
    expect(results).toHaveLength(0);
  });
});
