import { supabase } from '../../lib/supabase';
import type { Lot, MarketplaceProfile } from '../../lib/domain';

const fields = 'id,farmer_id,fruit_type_id,variety_id,title,grade,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,district,certifications,packaging_options,selling_method,description,status,created_at';

export async function loadPublishedLots(fruitTypeId?: string): Promise<{ lots: Lot[]; tooMany: boolean }> {
  let query = supabase.from('lots').select(fields, { count: 'exact' }).eq('status', 'PUBLISHED');
  if (fruitTypeId) query = query.eq('fruit_type_id', fruitTypeId);
  const { data, count, error } = await query.order('id').range(0, 999);
  if (error) throw error;
  return { lots: data as unknown as Lot[], tooMany: (count ?? 0) > 1000 };
}

export async function getPublishedLot(id: string): Promise<Lot | null> {
  const { data, error } = await supabase.from('lots').select(fields)
    .eq('id', id).eq('status', 'PUBLISHED').maybeSingle();
  if (error) throw error;
  return data as unknown as Lot | null;
}

export async function loadFarmerCards(farmerIds: string[]): Promise<Record<string, MarketplaceProfile>> {
  if (!farmerIds.length) return {};
  const { data, error } = await supabase.from('marketplace_profiles')
    .select('user_id,display_name,province,role').in('user_id', [...new Set(farmerIds)]);
  if (error) throw error;
  return Object.fromEntries((data as MarketplaceProfile[]).map(row => [row.user_id, row]));
}

export interface LotPhoto { url: string; is_ai_generated: boolean; }
export async function loadLotPhotos(lotIds: string[]): Promise<Record<string, LotPhoto[]>> {
  if (!lotIds.length) return {};
  const { data, error } = await supabase.from('lot_images').select('lot_id,storage_path,is_ai_generated')
    .in('lot_id', [...new Set(lotIds)]).order('sort_order');
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return {};
  const signed = await supabase.storage.from('lot-images').createSignedUrls(rows.map(row => row.storage_path), 120);
  if (signed.error) throw signed.error;
  const urls = new Map((signed.data ?? []).map(item => [item.path, item.signedUrl]));
  const result: Record<string, LotPhoto[]> = {};
  for (const row of rows) {
    const url = urls.get(row.storage_path);
    if (!url) throw new Error('Chưa tải được ảnh sản phẩm. Vui lòng thử lại.');
    (result[row.lot_id] ??= []).push({url, is_ai_generated: !!row.is_ai_generated});
  }
  return result;
}
