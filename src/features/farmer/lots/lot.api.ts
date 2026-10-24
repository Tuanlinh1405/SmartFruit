import { supabase } from '../../../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canChangeStatus, catalogErrors, lotPageSize, lotToForm, parseLotForm, parseQuantity, privateInput,
  type Lot, type LotCatalog, type LotInput, type LotListFilters, type LotPrivateInput,
  type LotsRepository, type LotPrivateRepository } from './lot.model';

export const lotColumns = 'id,farmer_id,title,fruit_type_id,variety_id,grade,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,district,growing_area_code,certifications,packaging_options,selling_method,description,status,created_at,updated_at';
const unavailable = () => new Error('Không tìm thấy lô hàng hoặc bạn không có quyền truy cập.');
export function escapeLike(value: string) { return value.replace(/[\\%_]/g, '\\$&'); }

export function createLotRepositories(client: SupabaseClient): { lots: LotsRepository; privateDetails: LotPrivateRepository } {
  async function requireUser(userId: string) {
    const { data, error } = await client.auth.getUser();
    if (error || !userId || data.user?.id !== userId) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  }
  async function ownLot(userId: string, id: string): Promise<Lot> {
    const { data, error } = await client.from('lots').select(lotColumns).eq('id', id).eq('farmer_id', userId).maybeSingle<Lot>();
    if (error || !data) throw unavailable();
    return data;
  }
  async function readCatalog(): Promise<LotCatalog> {
    const [fruits, varieties] = await Promise.all([
      client.from('fruit_types').select('id,name,active').order('name'),
      client.from('fruit_varieties').select('id,name,active,fruit_type_id').order('name'),
    ]);
    if (fruits.error || varieties.error || !fruits.data || !varieties.data) throw new Error('Không thể tải danh mục trái cây.');
    return { fruits: fruits.data, varieties: varieties.data };
  }
  async function sanitizedInput(input: LotInput, previous?: Lot): Promise<LotInput> {
    if (!Number.isFinite(input.quantity_kg) || parseQuantity(String(input.quantity_kg), 'kg') !== input.quantity_kg) {
      throw new Error('Khối lượng không hợp lệ; không được làm tròn khi lưu.');
    }
    const parsed = parseLotForm(lotToForm(input));
    if (!parsed.data || Object.keys(catalogErrors(parsed.data, await readCatalog(), previous)).length) throw new Error('Thông tin lô hàng chưa hợp lệ. Vui lòng kiểm tra lại.');
    return parsed.data;
  }
  async function readPrivate(id: string): Promise<LotPrivateInput | null> {
    const { data, error } = await client.from('lot_private_details')
      .select('price_floor_vnd_per_kg,internal_notes').eq('lot_id', id).maybeSingle<LotPrivateInput>();
    if (error) throw new Error('Không thể tải thông tin riêng. Chưa thể xác nhận giá sàn.');
    return data;
  }
  async function updateOwned(userId: string, id: string, input: LotInput, previous: Lot): Promise<Lot> {
    const clean = await sanitizedInput(input, previous);
    const details = await readPrivate(id);
    if (details?.price_floor_vnd_per_kg != null && clean.price_vnd_per_kg < details.price_floor_vnd_per_kg) {
      throw new Error('Hãy lưu giá sàn thấp hơn hoặc bỏ giá sàn trước khi giảm giá chào.');
    }
    const { data, error } = await client.from('lots').update(clean).eq('id', id).eq('farmer_id', userId).select(lotColumns).single<Lot>();
    if (error || !data) throw new Error('Chưa lưu được nội dung lô. Vui lòng tải lại dữ liệu giá sàn và thử lại.');
    return data;
  }
  const lots: LotsRepository = {
    async hasFarmerProfile(userId) {
      await requireUser(userId);
      const { data, error } = await client.from('farmer_profiles').select('user_id').eq('user_id', userId).maybeSingle();
      if (error) throw new Error('Không thể kiểm tra hồ sơ nhà vườn.');
      return !!data;
    },
    async catalog(userId) { await requireUser(userId); return readCatalog(); },
    async list(userId, filters: LotListFilters) {
      await requireUser(userId);
      const page = Math.max(1, Math.trunc(filters.page) || 1);
      let query = client.from('lots').select(lotColumns, { count: 'exact' }).eq('farmer_id', userId);
      if (filters.search.trim()) query = query.ilike('title', `%${escapeLike(filters.search.trim())}%`);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.fruitTypeId) query = query.eq('fruit_type_id', filters.fruitTypeId);
      if (filters.province.trim()) query = query.eq('province', filters.province.trim());
      query = filters.sort === 'newest' ? query.order('created_at', { ascending: false })
        : query.order('price_vnd_per_kg', { ascending: filters.sort === 'price_asc' });
      const { data, error, count } = await query.order('id', { ascending: true }).range((page - 1) * lotPageSize, page * lotPageSize - 1);
      if (error || !data || count === null) throw new Error('Không thể tải danh sách lô hàng.');
      return { rows: data as Lot[], count };
    },
    async detail(userId, id) { await requireUser(userId); return ownLot(userId, id); },
    async createDraft(userId, input, draftId) {
      await requireUser(userId);
      if (!await lots.hasFarmerProfile(userId)) throw new Error('Vui lòng hoàn thiện hồ sơ nhà vườn trước.');
      const clean = await sanitizedInput(input);
      const { data, error } = await client.from('lots').insert({ ...clean, id: draftId, status: 'DRAFT' }).select(lotColumns).single<Lot>();
      // Stable client-generated ID also prevents duplicates after an ambiguous network failure.
      if (error?.code === '23505') {
        const existing = await ownLot(userId, draftId);
        if (existing.status !== 'DRAFT') throw new Error('Lô đã đổi trạng thái. Vui lòng tải lại.');
        return updateOwned(userId, draftId, clean, existing);
      }
      if (error || !data) throw new Error('Chưa tạo được lô nháp. Vui lòng thử lại.');
      return data;
    },
    async update(userId, id, input) {
      await requireUser(userId); return updateOwned(userId, id, input, await ownLot(userId, id));
    },
    async changeStatus(userId, id, status) {
      await requireUser(userId);
      const current = await ownLot(userId, id);
      if (!canChangeStatus(current.status, status)) throw new Error('Không thể chuyển trạng thái này. Vui lòng tải lại lô.');
      const { data, error } = await client.from('lots').update({ status }).eq('id', id).eq('farmer_id', userId)
        .eq('status', current.status).select(lotColumns).single<Lot>();
      if (error?.code === '23514' && /photo|published_lot_requires_image/i.test(error.message)) throw new Error('Cần ít nhất một ảnh sản phẩm trước khi công bố lô.');
      if (error || !data) throw new Error('Chưa đổi được trạng thái. Nội dung đã lưu được giữ nguyên; vui lòng tải lại.');
      return data;
    },
    async remove(userId, id) {
      await requireUser(userId); await ownLot(userId, id);
      const { data: images, error: imageError } = await client.from('lot_images').select('id').eq('lot_id', id).limit(1);
      if (imageError || !images) throw new Error('Không thể kiểm tra ảnh. Chưa xóa lô.');
      if (images.length) throw new Error('Lô có ảnh. Cần xử lý ảnh trước khi xóa; tính năng này chưa hỗ trợ.');
      const { data, error } = await client.from('lots').delete().eq('id', id).eq('farmer_id', userId).select('id').single();
      if (error || !data) throw new Error('Chưa xóa được lô hoặc bạn không có quyền truy cập.');
    },
  };
  const privateDetails: LotPrivateRepository = {
    async load(userId, id) { await requireUser(userId); await ownLot(userId, id); return readPrivate(id); },
    async save(userId, id, input) {
      await requireUser(userId);
      const lot = await ownLot(userId, id);
      const clean = privateInput(input.price_floor_vnd_per_kg === null ? '' : String(input.price_floor_vnd_per_kg), input.internal_notes, lot.price_vnd_per_kg);
      const existing = await readPrivate(id);
      // Upsert would try to UPDATE lot_id, which is intentionally not granted.
      const mutation = existing
        ? client.from('lot_private_details').update(clean).eq('lot_id', id)
        : client.from('lot_private_details').insert({ ...clean, lot_id: id });
      const { data, error } = await mutation.select('price_floor_vnd_per_kg,internal_notes').single<LotPrivateInput>();
      if (error || !data) throw new Error('Chưa lưu được thông tin riêng. Vui lòng tải lại giá chào và thử lại.');
      return data;
    },
  };
  return { lots, privateDetails };
}

async function configured() {
  return createLotRepositories(supabase);
}
export const lotsRepository: LotsRepository = {
  hasFarmerProfile: async id => (await configured()).lots.hasFarmerProfile(id),
  catalog: async id => (await configured()).lots.catalog(id),
  list: async (id, filters) => (await configured()).lots.list(id, filters),
  detail: async (id, lotId) => (await configured()).lots.detail(id, lotId),
  createDraft: async (id, input, draftId) => (await configured()).lots.createDraft(id, input, draftId),
  update: async (id, lotId, input) => (await configured()).lots.update(id, lotId, input),
  changeStatus: async (id, lotId, status) => (await configured()).lots.changeStatus(id, lotId, status),
  remove: async (id, lotId) => (await configured()).lots.remove(id, lotId),
};
export const lotPrivateRepository: LotPrivateRepository = {
  load: async (id, lotId) => (await configured()).privateDetails.load(id, lotId),
  save: async (id, lotId, input) => (await configured()).privateDetails.save(id, lotId, input),
};
