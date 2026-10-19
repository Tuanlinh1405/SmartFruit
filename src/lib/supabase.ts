import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | undefined;
function configuredClient(): SupabaseClient {
  if (instance) return instance;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error('Thiếu cấu hình Supabase. Chạy npm run setup:supabase rồi khởi động lại Vite.');
  if (!key.startsWith('sb_publishable_')) throw new Error('Frontend SmartFruit chỉ dùng publishable key.');
  instance = createClient(url, key, { db: { schema: 'public' }, auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return instance;
}
// Defer configuration until first use, so public pages and test harness can boot
// without credentials. Every consumer still shares one actual SDK client.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = configuredClient();
    const value: unknown = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
export function getSupabaseClient() { return supabase; }
