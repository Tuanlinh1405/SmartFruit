// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { matchProductName, productSearchText } from './name-match';

describe('product word matching', () => {
  it.each([
    ['  SẦU RIÊNG Ri-6 ', 'sau rieng ri6'],
    ['Xoài cát Chu', 'Cát Chu xoài loại A'],
    ['Thanh long ruột đỏ', 'thanh long ruot do'],
    ['Bơ Booth 7', 'bo booth7'],
    ['Bơ 034', 'bo034'],
    ['Cần thu mua sầu riêng Ri6 10 tấn giá 70.000 VND/kg', 'Sầu riêng Ri6'],
  ])('normalizes full word matches: %s', (query, candidate) => {
    expect(matchProductName(query, candidate).kind).toBe('exact');
  });
  it.each(['Monthon', 'Monthnog', 'Mongthong'])(
    'handles small edits/transpositions in %s', query => {
      const result = matchProductName(query, 'Monthong');
      expect(result.kind).toBe('fuzzy');
      expect(result.score).toBeGreaterThanOrEqual(0.75);
    });
  it.each([
    ['Ri6', 'Ri7'], ['RD6', 'Ri6'], ['Ri6', 'Ri60'], ['Bơ 034', 'Bơ 036'],
    ['Bơ Booth7', 'Bơ Booth8'], ['cát', 'cam'],
  ])('never fuzzily equates short words or codes: %s / %s', (query, candidate) => {
    expect(['exact', 'fuzzy']).not.toContain(matchProductName(query, candidate).kind);
  });
  it('does not use substrings as exact words', () => {
    expect(matchProductName('cat', 'catalog').kind).toBe('none');
  });
  it('separates a partial fruit match from the requested cultivar', () => {
    const result = matchProductName('Xoài cát Chu', 'Xoài cát Hòa Lộc');
    expect(result.kind).toBe('partial');
    expect(result.unmatchedTokens).toEqual(['chu']);
  });
  it.each(['không lấy', 'không phải', 'ngoại trừ', 'trừ'])(
    'honors an explicit exclusion: %s', negative => {
      expect(matchProductName(`Xoài cát Chu ${negative} cát Hòa Lộc`, 'Xoài cát Hòa Lộc').kind).toBe('excluded');
      expect(matchProductName(`Xoài cát Chu ${negative} cát Hòa Lộc`, 'Xoài cát Chu').kind).toBe('exact');
    });
  it('does not interpret a price ceiling as a product exclusion', () => {
    expect(matchProductName('Ri6 giá không quá 70000', 'Ri6').kind).toBe('exact');
  });
  it('does not count a negated mention in the candidate as its product', () => {
    expect(matchProductName('Monthong', 'Sầu riêng Ri6, không phải Monthong').kind).toBe('none');
  });
  it('treats an empty/name-free query as unspecified', () => {
    expect(matchProductName('', 'Ri6').kind).toBe('unspecified');
    expect(matchProductName('10 tấn, giá 70000 VND', 'Ri6').kind).toBe('unspecified');
  });
  it('preserves generic fruit and compact cultivar codes from separate catalog fields', () => {
    const text = productSearchText({ title: 'Lô mới', fruit_type_id: 'avocado', variety_id: '034' }, {
      types: [{ id: 'avocado', name: 'Bơ' }], varieties: [{ id: '034', name: '034' }],
    });
    expect(matchProductName('Bơ', text).kind).toBe('exact');
    expect(matchProductName('Bơ034', text).kind).toBe('exact');
    expect(matchProductName('Bơ036', text).kind).not.toBe('exact');
  });
});
