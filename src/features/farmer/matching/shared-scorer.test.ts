import { expect, test } from 'vitest';
import { scoreFarmerRequests } from './shared-scorer';
import { RULE_VERSION } from '../../matching/core';
import { testLot } from '../lots/lot.fixtures';
import type { BuyCandidate } from './farmer-matching';
const request: BuyCandidate = { id: 'r', status: 'OPEN', buyer_id: 'b', title: 'Mua Ri6', fruit_type_id: 'fruit-1', variety_id: null, target_quantity_kg: 5000, min_lot_quantity_kg: null, allow_partial: true, min_price_vnd_per_kg: 60000, max_price_vnd_per_kg: 70000, required_start: '2026-10-15', required_end: '2026-10-20', preferred_provinces: [] };
test('shared scorer maps quantities and the shared price/quantity weights and rule version', () => {
  const lot = testLot({ status: 'PUBLISHED', quantity_kg: 2500 });
  const partial = scoreFarmerRequests(lot, [request]); expect(partial).toEqual([expect.objectContaining({ lotId: lot.id, requestId: 'r', score: 76.67, suggestedQuantityKg: 2500, ruleVersion: RULE_VERSION, missingInformation: [] })]);
  expect(scoreFarmerRequests({ ...lot, quantity_kg: 5000 }, [request])).toEqual([expect.objectContaining({ score: 100, suggestedQuantityKg: 5000 })]);
  expect(scoreFarmerRequests(lot, [{ ...request, allow_partial: false }])).toEqual([]);
});
test('filters non-public lots, non-open requests, wrong fruit/variety and dates', () => {
  const lot = testLot({ status: 'PUBLISHED' });
  expect(scoreFarmerRequests(testLot(), [request])).toEqual([]);
  for (const invalid of [{ ...request, status: 'CLOSED' as const }, { ...request, fruit_type_id: 'other' }, { ...request, variety_id: 'other' }, { ...request, required_start: '2027-01-01' }]) expect(scoreFarmerRequests(lot, [invalid])).toEqual([]);
});
test('equal scores have stable request ID order regardless of candidate order', () => {
  const lot = testLot({ status: 'PUBLISHED' }); const rows = [{ ...request, id: 'z' }, { ...request, id: 'a' }];
  expect(scoreFarmerRequests(lot, rows).map(r => r.requestId)).toEqual(['a', 'z']);
  expect(scoreFarmerRequests(lot, [...rows].reverse())).toEqual(scoreFarmerRequests(lot, rows));
});
