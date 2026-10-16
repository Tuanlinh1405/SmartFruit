import { supabase } from '../../../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { carrierProfile, validateVehicle, type CarrierProfileInput, type CarrierRepository, type Vehicle } from './vehicle.model';
import { escapeLike } from '../../farmer/lots/lot.api';
const profileColumns = 'company_name,province,address,service_provinces';
const vehicleColumns = 'id,carrier_id,license_plate,vehicle_type,capacity_kg,provinces,min_temperature_c,max_temperature_c,active';
export function createCarrierRepository(client: SupabaseClient): CarrierRepository {
  async function owner(userId: string) { const result = await client.auth.getUser(); if (result.error || !userId || result.data.user?.id !== userId) throw new Error('Phiên đăng nhập không hợp lệ.'); }
  return {
    async profile(userId) {
      await owner(userId); const result = await client.from('carrier_profiles').select(profileColumns).eq('user_id', userId).maybeSingle<CarrierProfileInput>();
      if (result.error) throw new Error('Không thể tải hồ sơ nhà xe.'); return result.data;
    },
    async saveProfile(userId, input) {
      await owner(userId); const result = await client.from('carrier_profiles').upsert({ ...carrierProfile(input), user_id: userId }, { onConflict: 'user_id' }).select(profileColumns).single<CarrierProfileInput>();
      if (result.error || !result.data) throw new Error('Chưa lưu được hồ sơ nhà xe.'); return result.data;
    },
    async list(userId, filters) {
      await owner(userId); let query = client.from('vehicles').select(vehicleColumns, { count: 'exact' }).eq('carrier_id', userId);
      if (filters.search.trim()) query = query.ilike('license_plate', `%${escapeLike(filters.search.trim())}%`);
      if (filters.province.trim()) query = query.contains('provinces', [filters.province.trim()]);
      if (filters.active) query = query.eq('active', filters.active === 'true');
      query = filters.sort === 'capacity' ? query.order('capacity_kg', { ascending: false }) : query.order('created_at', { ascending: false });
      const page = Math.max(1, Math.trunc(filters.page) || 1); const result = await query.order('id', { ascending: true }).range((page - 1) * 20, page * 20 - 1);
      if (result.error || !result.data || result.count === null) throw new Error('Không thể tải danh sách xe.');
      return { rows: result.data as Vehicle[], count: result.count };
    },
    async saveVehicle(userId, input, id) {
      await owner(userId); const clean = validateVehicle(input);
      const mutation = id ? client.from('vehicles').update(clean).eq('id', id).eq('carrier_id', userId) : client.from('vehicles').insert(clean);
      const result = await mutation.select(vehicleColumns).single<Vehicle>();
      if (result.error?.code === '23505') throw new Error('Biển số đã có trong đội xe của bạn.');
      if (result.error || !result.data) throw new Error('Chưa lưu được xe; kiểm tra hồ sơ nhà xe và quyền truy cập.'); return result.data;
    },
    async remove(userId, id) {
      await owner(userId); const result = await client.from('vehicles').delete().eq('id', id).eq('carrier_id', userId).select('id').single();
      if (result.error || !result.data) throw new Error('Chưa xóa được xe hoặc bạn không có quyền.');
    },
  };
}
async function configured() { return createCarrierRepository(supabase); }
export const carrierRepository: CarrierRepository = {
  profile: async u => (await configured()).profile(u), saveProfile: async (u, p) => (await configured()).saveProfile(u, p),
  list: async (u, f) => (await configured()).list(u, f), saveVehicle: async (u, v, id) => (await configured()).saveVehicle(u, v, id), remove: async (u, id) => (await configured()).remove(u, id),
};
