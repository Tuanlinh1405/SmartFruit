import { supabase } from '../../lib/supabase';
import type { BuyerProfile, Profile } from '../../lib/domain';

export async function getBuyerProfile(userId: string): Promise<BuyerProfile | null> {
  const { data, error } = await supabase.from('buyer_profiles')
    .select('user_id,organization_name,province,address').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as BuyerProfile | null;
}

export async function saveBuyerProfile(userId: string, input: Omit<BuyerProfile, 'user_id'>) {
  const { data, error } = await supabase.from('buyer_profiles')
    .upsert({ user_id: userId, ...input }, { onConflict: 'user_id' })
    .select('user_id,organization_name,province,address').single();
  if (error) throw error;
  return data as BuyerProfile;
}

export async function saveDisplayName(userId: string, fullName: string) {
  const { data, error } = await supabase.from('profiles')
    .update({ full_name: fullName }).eq('id', userId)
    .select('id,role,full_name,phone_display').single();
  if (error) throw error;
  return data as Profile;
}
