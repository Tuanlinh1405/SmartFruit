import { describe, expect, it } from 'vitest';
import type { BuyRequest, Lot } from '../../lib/domain';
import { baselineScore, lexicalRank, rankMatches, scoreBusiness } from './core';

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
    expect(baselineScore(result)).toBe(75.5);
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
      { lot: { ...lot, id: 'b' }, semanticRank: 1, lexicalRank: 1 },
      { lot, semanticRank: 1, lexicalRank: 1 },
      { lot: { ...lot, id: 'closed', status: 'CLOSED' }, semanticRank: 1, lexicalRank: 1 },
    ], request, 'hybrid');
    expect(results.map(row => row.lot.id)).toEqual(['a', 'b']);
    expect(results[0].relevance).toBe(1);
  });
  it('handles price out of range and province mismatch as soft preferences', () => {
    const result = scoreBusiness({ ...lot, price_vnd_per_kg: 84000, province: 'Lâm Đồng' }, request);
    expect(result.eligible).toBe(true);
    expect(result.priceFit).toBe(0);
    expect(result.locationFit).toBe(0);
  });
  it('finds Vietnamese words with or without accent', () => {
    expect(lexicalRank([lot], 'sau rieng ri6').get('a')).toBe(1);
  });
});
