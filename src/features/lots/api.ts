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

export async function loadLotImageUrls(lotId: string): Promise<string[]> {
  const { data, error } = await supabase.from('lot_images').select('storage_path')
    .eq('lot_id', lotId).order('sort_order');
  if (error) throw error;
  const paths = (data ?? []).map(row => row.storage_path as string);
  if (!paths.length) return [];
  const signed = await supabase.storage.from('lot-images').createSignedUrls(paths, 60);
  if (signed.error) throw signed.error;
  return (signed.data ?? []).flatMap(item => item.signedUrl ? [item.signedUrl] : []);
}
