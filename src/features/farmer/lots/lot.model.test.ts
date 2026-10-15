import { expect, test } from 'vitest';
import { canChangeStatus, catalogErrors, formatQuantity, isCalendarDate, lotToForm, parseLotForm, parsePrice, parseQuantity, privateInput } from './lot.model';
import { testCatalog, testInput, testLot } from './lot.fixtures';

test.each([
  ['1.250125', 'tonne', 1250.125], ['0.000001', 'tonne', 0.001], ['0.001', 'kg', 0.001],
  ['0.1', 'tonne', 100], ['99999999999.999', 'kg', 99999999999.999], ['1.0000000', 'kg', 1],
] as const)('quantity %s %s maps exactly', (value, unit, expected) => {
  expect(parseQuantity(value, unit)).toBe(expected);
  expect(parseQuantity(formatQuantity(expected, unit), unit)).toBe(expected);
});
test.each(['NaN', 'Infinity', '-1', '0', '0.0001', '100000000000', '1e3', '1,25', '0x12', ''])('rejects kg %s', value => {
  expect(parseQuantity(value, 'kg')).toBeNull();
});
test('tonne conversion never rounds away sub-milligram input or changes bounds', () => {
  expect(parseQuantity('0.0000001', 'tonne')).toBeNull();
  expect(parseQuantity('99999999.999999', 'tonne')).toBe(99999999999.999);
  expect(parseQuantity('100000000', 'tonne')).toBeNull();
});
test.each(['0', '-1', '1.5', 'NaN', 'Infinity', '1e4', '9007199254740992'])('rejects price %s', value => expect(parsePrice(value)).toBeNull());
test('safe price maximum accepted', () => expect(parsePrice('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER));
test.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '0000-01-01', ''])('rejects invalid calendar date %s', value => expect(isCalendarDate(value)).toBe(false));
test('leap dates and same-day harvest are valid without timezone conversion', () => {
  expect(isCalendarDate('2028-02-29')).toBe(true);
  expect(parseLotForm({ ...lotToForm(testInput), harvest_end: testInput.harvest_start }).data?.harvest_end).toBe('2026-10-15');
});
test('roundtrip whitelists public inputs and normalizes optional blanks', () => {
  const row = { ...testLot(), price_floor_vnd_per_kg: 1234, internal_notes: 'SECRET', role: 'ADMIN' };
  expect(parseLotForm(lotToForm(row)).data).toEqual(testInput);
  expect(lotToForm(row)).not.toHaveProperty('farmer_id');
  expect(lotToForm(row)).not.toHaveProperty('internal_notes');
  expect(parseLotForm({ ...lotToForm(testInput), title: ' Trim ', grade: ' ', variety_id: '', description: ' ' }).data)
    .toMatchObject({ title: 'Trim', grade: null, variety_id: null, description: '' });
});
test('required, text, list, enum and date ordering constraints', () => {
  const result = parseLotForm({ ...lotToForm(), title: ' ', province: '', selling_method: 'DEMO', harvest_start: '2026-10-20', harvest_end: '2026-10-10' });
  expect(result.errors).toMatchObject({ title: expect.any(String), province: expect.any(String), fruit_type_id: expect.any(String), quantity: expect.any(String), price_vnd_per_kg: expect.any(String), selling_method: expect.any(String), harvest_end: expect.any(String) });
  for (const [field, limit] of [['title', 200], ['province', 120], ['district', 120], ['grade', 80], ['growing_area_code', 100], ['description', 5000]] as const) {
    expect(parseLotForm({ ...lotToForm(testInput), [field]: '🌱'.repeat(limit) }).data).toBeDefined();
    expect(parseLotForm({ ...lotToForm(testInput), [field]: 'x'.repeat(limit + 1) }).errors?.[field]).toBeDefined();
  }
  for (const field of ['certifications', 'packaging_options'] as const) {
    expect(parseLotForm({ ...lotToForm(testInput), [field]: Array(32).fill('a'.repeat(120)).join('\n') }).data).toBeDefined();
    expect(parseLotForm({ ...lotToForm(testInput), [field]: Array(33).fill('a').join('\n') }).errors?.[field]).toBeDefined();
    expect(parseLotForm({ ...lotToForm(testInput), [field]: 'x'.repeat(121) }).errors?.[field]).toBeDefined();
  }
});
test('catalog validates type/variety relationship and inactive selections', () => {
  expect(catalogErrors(testInput, testCatalog)).toEqual({});
  expect(catalogErrors({ ...testInput, variety_id: 'variety-2' }, testCatalog)).toHaveProperty('variety_id');
  const old = { ...testInput, fruit_type_id: 'inactive-fruit', variety_id: null };
  expect(catalogErrors(old, testCatalog)).toHaveProperty('fruit_type_id');
  expect(catalogErrors(old, testCatalog, old)).toEqual({});
  const oldVariety = { ...testInput, variety_id: 'inactive-variety' };
  expect(catalogErrors(oldVariety, testCatalog)).toHaveProperty('variety_id');
  expect(catalogErrors(oldVariety, testCatalog, oldVariety)).toEqual({});
});
test('private price is nullable, bounded by asking price; notes are private and length limited', () => {
  expect(privateInput('', 'Ghi chú riêng', 65000)).toEqual({ price_floor_vnd_per_kg: null, internal_notes: 'Ghi chú riêng' });
  expect(privateInput('65000', '', 65000).price_floor_vnd_per_kg).toBe(65000);
  for (const floor of ['65001', '-1', '0', '1.1', 'NaN']) expect(() => privateInput(floor, '', 65000)).toThrow();
  expect(() => privateInput('', 'x'.repeat(5001), 65000)).toThrow();
});
test('closed/cancelled lots cannot be reopened and demo statuses are never used', () => {
  expect(canChangeStatus('DRAFT', 'PUBLISHED')).toBe(true);
  expect(canChangeStatus('PUBLISHED', 'CLOSED')).toBe(true);
  expect(canChangeStatus('CLOSED', 'PUBLISHED')).toBe(false);
  expect(canChangeStatus('CANCELLED', 'PUBLISHED')).toBe(false);
  expect(canChangeStatus('PUBLISHED', 'DRAFT')).toBe(false);
});
