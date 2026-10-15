import { expect, test } from 'vitest';
import { formatDate, formatNumber, formatVnd, formatWeight } from './formatters';
test('formats VND, decimal weight and invalid numbers',()=>{
  expect(formatVnd(65000)).toBe('65.000 đ'); expect(formatNumber(1.5)).toBe('1,5');
  expect(formatWeight(999)).toBe('999 kg'); expect(formatWeight(1500)).toBe('1,5 tấn'); expect(formatNumber(NaN)).toBe('—');
});
test('keeps date-only value and formats timestamps in Vietnam',()=>{
  expect(formatDate('2026-10-20')).toBe('20/10/2026'); expect(formatDate('2026-10-20T18:00:00Z')).toBe('21/10/2026'); expect(formatDate('invalid')).toBe('—');
});
