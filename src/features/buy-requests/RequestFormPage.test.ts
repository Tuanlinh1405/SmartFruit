import { describe, expect, it } from 'vitest';
import { validateDraft } from './RequestFormPage';

const draft = {
  fruit_type_id: 'fruit', variety_id: 'variety', title: '  Mua Ri6  ', grade: 'A',
  tonnes: '12.345', minLotTonnes: '1.234', allow_partial: true,
  minPrice: '60000', maxPrice: '70000', start: '2026-10-20', end: '2026-10-30',
  provinces: 'Đồng Nai, Lâm Đồng, Đồng Nai', districts: '', quality: 'VietGAP',
  packaging: 'CARTON', buying_method: 'BY_GRADE' as const,
  transport_by: 'BUYER' as const, notes: '',
};

describe('Buyer request form validation', () => {
  it('converts tonnes to kg and deduplicates preference labels', () => {
    const result = validateDraft(draft, 'OPEN');
    expect(result.target_quantity_kg).toBe(12345);
    expect(result.min_lot_quantity_kg).toBe(1234);
    expect(result.preferred_provinces).toEqual(['Đồng Nai', 'Lâm Đồng']);
    expect(result.title).toBe('Mua Ri6');
  });
  it('rejects amounts that cannot be represented at the form precision', () => {
    expect(() => validateDraft({ ...draft, tonnes: '1.0001' }, 'OPEN')).toThrow(/1 kg/);
    expect(() => validateDraft({ ...draft, minLotTonnes: '12.346' }, 'OPEN')).toThrow(/Lượng tối thiểu/);
  });
  it('rejects an inverted price range and date range', () => {
    expect(() => validateDraft({ ...draft, minPrice: '71000' }, 'OPEN')).toThrow(/giá/);
    expect(() => validateDraft({ ...draft, end: '2026-10-19' }, 'OPEN')).toThrow(/ngày/);
  });
});
