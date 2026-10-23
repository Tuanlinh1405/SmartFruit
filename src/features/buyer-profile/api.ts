import { businessFields,emptyBusinessProfile } from './business-profile';
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

export async function loadBusinessProfile(userId:string,fullName:string) {
  const [profile,evidence]=await Promise.all([supabase.from('buyer_profiles').select('*').eq('user_id',userId).maybeSingle(),supabase.from('buyer_evidence').select('path,label').eq('user_id',userId).order('position')]);
  if(profile.error)throw profile.error;if(evidence.error)throw new Error('Chưa tải được minh chứng hồ sơ. Kiểm tra migration hồ sơ doanh nghiệp.');
  const values={...emptyBusinessProfile};for(const k of businessFields)values[k]=k==='full_name'?fullName:String(profile.data?.[k]??'');
  const images=await Promise.all((evidence.data??[]).map(async e=>{const r=await supabase.storage.from('buyer-evidence').createSignedUrl(e.path,3600);if(r.error)throw r.error;return {...e,url:r.data.signedUrl};}));
  return {values,images};
}
export async function saveBusinessProfile(userId:string,details:import('./business-profile').BusinessProfile,images:import('./business-profile').Evidence[]) {
  const uploaded:string[]=[];
  try {
    const evidence=[];
    for(const image of images){let path=image.path;if(image.file){path=`${userId}/${crypto.randomUUID()}.${image.file.type==='image/png'?'png':'jpg'}`;const r=await supabase.storage.from('buyer-evidence').upload(path,image.file,{contentType:image.file.type,upsert:false});if(r.error)throw r.error;uploaded.push(path);}evidence.push({path,label:image.label});}
    const r=await supabase.rpc('save_buyer_business_profile',{details,evidence,attested:true});if(r.error)throw r.error;
  } catch(e){if(uploaded.length)await supabase.storage.from('buyer-evidence').remove(uploaded);throw e;}
}
export async function cleanupBusinessImages(paths:string[]) {
  if(!paths.length)return;const r=await supabase.storage.from('buyer-evidence').remove(paths);if(r.error)throw r.error;
}
