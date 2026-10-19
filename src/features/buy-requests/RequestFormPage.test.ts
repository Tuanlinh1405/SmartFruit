import { describe, expect, it, vi } from 'vitest';
import { validateDraft } from './RequestFormPage';
import type { BuyRequest } from '../../lib/domain';
import type { RequestCatalog } from './product-name';

export const catalog: RequestCatalog = {
  types: [{id:'durian',name:'Sầu riêng',code:'DURIAN',active:true}, {id:'jackfruit',name:'Mít',code:'JACKFRUIT',active:true}],
  varieties: [{id:'ri6',fruit_type_id:'durian',name:'Ri6',code:'RI6',active:true}],
};

// Validation tests do not initialize Auth or connect to a Supabase project.
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

const draft = {
  title: '  Mua Ri6  ', grade: 'A',
  tonnes: '12.345', minLotTonnes: '1.234', allow_partial: true,
  minPrice: '60000', maxPrice: '70000', start: '2026-10-20', end: '2026-10-30',
  provinces: 'Đồng Nai, Lâm Đồng, Đồng Nai', districts: '', quality: 'VietGAP',
  packaging: 'CARTON', buying_method: 'BY_GRADE' as const,
  transport_by: 'BUYER' as const, notes: '',
};

describe('Buyer request form validation', () => {
  it('converts tonnes to kg and deduplicates preference labels', () => {
    const result = validateDraft(draft, 'OPEN', catalog);
    expect(result.target_quantity_kg).toBe(12345);
    expect(result.min_lot_quantity_kg).toBe(1234);
    expect(result.preferred_provinces).toEqual(['Đồng Nai', 'Lâm Đồng']);
    expect(result.title).toBe('Mua Ri6');
  });
  it('rejects amounts that cannot be represented at the form precision', () => {
    expect(() => validateDraft({ ...draft, tonnes: '1.0001' }, 'OPEN', catalog)).toThrow(/1 kg/);
    expect(() => validateDraft({ ...draft, minLotTonnes: '12.346' }, 'OPEN', catalog)).toThrow(/Lượng tối thiểu/);
  });
  it('rejects an inverted price range and date range', () => {
    expect(() => validateDraft({ ...draft, minPrice: '71000' }, 'OPEN', catalog)).toThrow(/giá/);
    expect(() => validateDraft({ ...draft, end: '2026-10-19' }, 'OPEN', catalog)).toThrow(/ngày/);
  });
  it('saves the full free-text name and resolves the required type without cultivar guessing', () => {
    const result = validateDraft({...draft,title:'sau rieng giong moi RD6'}, 'OPEN', catalog);
    expect(result).toMatchObject({title:'sau rieng giong moi RD6',fruit_type_id:'durian',variety_id:null,grade:null});
    expect(validateDraft({...draft,title:'Ri 6'}, 'DRAFT', catalog).fruit_type_id).toBe('durian');
  });
  it('does not silently assign the first catalog type for missing or ambiguous names', () => {
    expect(() => validateDraft({...draft,title:''},'OPEN',catalog)).toThrow(/Nhập tên/);
    expect(() => validateDraft({...draft,title:'Nông sản mới'},'OPEN',catalog)).toThrow(/Chưa nhận ra/);
    expect(() => validateDraft({...draft,title:'Sầu riêng và mít'},'OPEN',catalog)).toThrow(/một nông sản/);
  });
  it('keeps legacy metadata only for the unchanged name and clears it after a product change', () => {
    const original = {...validateDraft(draft,'OPEN',catalog),title:'Mua Ri6',variety_id:'ri6',grade:'A'} as BuyRequest;
    expect(validateDraft(draft,'OPEN',catalog,original)).toMatchObject({variety_id:'ri6',grade:'A'});
    expect(validateDraft({...draft,title:'Mít Thái'},'OPEN',catalog,original))
      .toMatchObject({fruit_type_id:'jackfruit',variety_id:null,grade:null});
  });
});
