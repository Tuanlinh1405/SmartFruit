import type { SupabaseClient } from '@supabase/supabase-js';
import { parseProfileForm, profileToForm, type FarmerProfile, type FarmerProfileRepository } from './farmer-profile.model';

const columns = 'user_id,farm_name,province,district,address,latitude,longitude,area_m2,tree_count,orchard_age_years,annual_yield_kg,cultivated_varieties,certifications,growing_area_code';

export function createFarmerProfileRepository(client: SupabaseClient): FarmerProfileRepository {
  async function requireOwner(userId: string) {
    const { data, error } = await client.auth.getUser();
    if (error || !userId || data.user?.id !== userId) {
      throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
    }
    // RLS remains responsible for checking FARMER role and record ownership.
  }
  return {
    async load(userId) {
      await requireOwner(userId);
      const { data, error } = await client.from('farmer_profiles').select(columns)
        .eq('user_id', userId).maybeSingle<FarmerProfile>();
      if (error) throw new Error('Không thể tải hồ sơ nhà vườn. Vui lòng thử lại.');
      return data;
    },
    async save(userId, input) {
      await requireOwner(userId);
      // Rebuild from known fields; never spread an untrusted row into an upsert.
      const parsed = parseProfileForm(profileToForm(input));
      if (!parsed.data) throw new Error('Thông tin hồ sơ chưa hợp lệ. Vui lòng kiểm tra lại.');
      const { data, error } = await client.from('farmer_profiles')
        .upsert({ ...parsed.data, user_id: userId }, { onConflict: 'user_id' })
        .select(columns).single<FarmerProfile>();
      if (error || !data) throw new Error('Không thể lưu hồ sơ nhà vườn. Vui lòng thử lại.');
      return data;
    },
  };
}

// No import-time Supabase/env dependency for isolated component tests.
async function configuredRepository() {
  const { supabase } = await import('../../../lib/supabase');
  return createFarmerProfileRepository(supabase);
}
export const farmerProfileRepository: FarmerProfileRepository = {
  load: async userId => (await configuredRepository()).load(userId),
  save: async (userId, input) => (await configuredRepository()).save(userId, input),
};
