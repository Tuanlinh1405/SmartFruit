import { describe, expect, test } from 'vitest';
import { parseProfileForm, profileToForm } from './farmer-profile.model';

const validForm = () => ({ ...profileToForm(), farm_name: ' Vườn Ri6 ', province: ' Tiền Giang ' });

test('trims required text; blank optional numbers/text become null and lists become empty', () => {
  expect(parseProfileForm(validForm())).toEqual({ data: {
    farm_name: 'Vườn Ri6', province: 'Tiền Giang', district: null, address: null,
    growing_area_code: null, area_m2: null, tree_count: null, orchard_age_years: null,
    annual_yield_kg: null, latitude: null, longitude: null, cultivated_varieties: [], certifications: [],
  } });
});

test('required and text length constraints match database, including Unicode codepoints', () => {
  expect(parseProfileForm({ ...validForm(), farm_name: ' ', province: '' }).errors).toMatchObject({
    farm_name: expect.any(String), province: expect.any(String),
  });
  for (const [name, length] of [['farm_name', 160], ['province', 120], ['district', 120], ['address', 500], ['growing_area_code', 100]] as const) {
    expect(parseProfileForm({ ...validForm(), [name]: '🌱'.repeat(length) }).data).toBeDefined();
    expect(parseProfileForm({ ...validForm(), [name]: 'x'.repeat(length + 1) }).errors?.[name]).toBeDefined();
  }
});

describe('numeric constraints', () => {
  test.each([
    ['area_m2', '0'], ['area_m2', '-1'], ['area_m2', '1000000000000'], ['area_m2', '1.001'],
    ['tree_count', '-1'], ['tree_count', '1.5'], ['tree_count', '2147483648'],
    ['orchard_age_years', '-1'], ['orchard_age_years', '10000'], ['orchard_age_years', '1.11'],
    ['annual_yield_kg', '-1'], ['annual_yield_kg', '100000000000'], ['annual_yield_kg', '1.0001'],
    ['latitude', '90.000001'], ['latitude', '-91'], ['latitude', '1.1234567'],
    ['longitude', '181'], ['longitude', '-181'],
    ['area_m2', 'NaN'], ['area_m2', 'Infinity'], ['tree_count', '1e1000'],
    ['area_m2', '0x10'], ['area_m2', '1,5'],
  ] as const)('rejects %s=%s', (name, value) => {
    const values = { ...validForm(), latitude: '0', longitude: '0', [name]: value };
    expect(parseProfileForm(values).errors?.[name]).toBeDefined();
  });

  test('accepts boundaries, optional zeroes and precise decimal values', () => {
    const result = parseProfileForm({ ...validForm(), area_m2: '999999999999.99', tree_count: '2147483647',
      orchard_age_years: '9999.9', annual_yield_kg: '99999999999.999', latitude: '-90', longitude: '180' });
    expect(result.data).toMatchObject({ area_m2: 999999999999.99, tree_count: 2147483647, latitude: -90, longitude: 180 });
    expect(parseProfileForm({ ...validForm(), tree_count: '0', orchard_age_years: '0', annual_yield_kg: '0' }).data)
      .toMatchObject({ tree_count: 0, orchard_age_years: 0, annual_yield_kg: 0 });
  });
});

test('coordinates must be provided together; blank coordinates stay null', () => {
  expect(parseProfileForm({ ...validForm(), latitude: '0' }).errors?.longitude).toBeDefined();
  expect(parseProfileForm({ ...validForm(), longitude: '0' }).errors?.latitude).toBeDefined();
  expect(parseProfileForm({ ...validForm(), latitude: '0', longitude: '0' }).data).toMatchObject({ latitude: 0, longitude: 0 });
});

test('list fields preserve comma-containing labels; enforce 32 items and 120 characters', () => {
  expect(parseProfileForm({ ...validForm(), cultivated_varieties: ' Ri6\r\n\n Mít, giống địa phương ', certifications: ' VietGAP ' }).data)
    .toMatchObject({ cultivated_varieties: ['Ri6', 'Mít, giống địa phương'], certifications: ['VietGAP'] });
  for (const name of ['cultivated_varieties', 'certifications'] as const) {
    expect(parseProfileForm({ ...validForm(), [name]: Array(32).fill('a'.repeat(120)).join('\n') }).data).toBeDefined();
    expect(parseProfileForm({ ...validForm(), [name]: Array(33).fill('a').join('\n') }).errors?.[name]).toBeDefined();
    expect(parseProfileForm({ ...validForm(), [name]: 'a'.repeat(121) }).errors?.[name]).toBeDefined();
  }
});

test('form roundtrip preserves values and does not expose generated or ownership columns', () => {
  const data = parseProfileForm({ ...validForm(), tree_count: '0', area_m2: '1200.25', certifications: 'VietGAP' }).data!;
  const row = { ...data, user_id: 'farmer-1', role: 'ADMIN', profile_role: 'FARMER', created_at: 'server', updated_at: 'server' };
  expect(parseProfileForm(profileToForm(row)).data).toEqual(data);
  expect(profileToForm(row)).not.toHaveProperty('user_id');
  expect(profileToForm(row)).not.toHaveProperty('role');
});
