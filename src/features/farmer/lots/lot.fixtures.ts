// Test fixtures only; production panels never import this module.
import type { Lot, LotCatalog, LotInput, LotPrivateRepository, LotsRepository } from './lot.model';
export const testCatalog: LotCatalog = {
  fruits: [{ id: 'fruit-1', name: 'Sầu riêng', active: true }, { id: 'fruit-2', name: 'Mít', active: true }, { id: 'inactive-fruit', name: 'Quả cũ', active: false }],
  varieties: [{ id: 'variety-1', fruit_type_id: 'fruit-1', name: 'Ri6', active: true }, { id: 'variety-2', fruit_type_id: 'fruit-2', name: 'Mít Thái', active: true }, { id: 'inactive-variety', fruit_type_id: 'fruit-1', name: 'Giống cũ', active: false }],
};
export const testInput: LotInput = {
  title: 'Lô Ri6', fruit_type_id: 'fruit-1', variety_id: 'variety-1', grade: 'A', quantity_kg: 1250.125,
  price_vnd_per_kg: 65000, harvest_start: '2026-10-15', harvest_end: '2026-10-20', province: 'Tiền Giang', district: null,
  growing_area_code: null, certifications: ['VietGAP'], packaging_options: ['CARTON'], selling_method: 'PARTIAL', description: 'Thu hoạch tại vườn',
};
export function testLot(patch: Partial<Lot> = {}): Lot {
  return { ...testInput, id: 'lot-1', farmer_id: 'farmer-1', status: 'DRAFT', created_at: '2026-10-15T00:00:00Z', updated_at: '2026-10-15T00:00:00Z', ...patch };
}
export function testRepositories(): { lots: LotsRepository; privateDetails: LotPrivateRepository } {
  return {
    lots: {
      hasFarmerProfile: async () => true, catalog: async () => testCatalog,
      list: async () => ({ rows: [testLot()], count: 1 }), detail: async () => testLot(),
      createDraft: async (userId, input, id) => testLot({ ...input, id, farmer_id: userId }),
      update: async (userId, id, input) => testLot({ ...input, id, farmer_id: userId }),
      changeStatus: async (userId, id, status) => testLot({ id, farmer_id: userId, status }),
      remove: async () => undefined,
    },
    privateDetails: { load: async () => null, save: async (_userId, _id, input) => input },
  };
}
