import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
export type DemoRole = 'FARMER' | 'BUYER' | 'CARRIER' | 'ADMIN';
export async function signInDemo(role:DemoRole,client:SupabaseClient=supabase) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const {data,error}=await client.functions.invoke('demo-login',{body:{role},signal:controller.signal});
    if(error || data?.role!==role || typeof data?.access_token!=='string' || typeof data?.refresh_token!=='string')
      throw new Error('Chưa thể vào tài khoản demo. Vui lòng thử lại.');
    const result=await client.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
    if(result.error)throw new Error('Phiên demo chưa sẵn sàng. Vui lòng thử lại.');
  } finally {clearTimeout(timer);}
}
