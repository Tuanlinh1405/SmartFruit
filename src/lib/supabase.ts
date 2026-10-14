import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !publishableKey) {
  throw new Error('Thiếu cấu hình Supabase. Chạy npm run setup:supabase rồi khởi động lại Vite.');
}

if (!publishableKey.startsWith('sb_publishable_')) {
  throw new Error('Frontend LogStar chỉ dùng publishable key lấy từ cấu hình project.');
}

// Import this shared instance in both Farmer/Carrier and Buyer/Admin features.
// The authenticated user and database RLS determine which records can be accessed.
export const supabase = createClient(supabaseUrl, publishableKey, {
  db: { schema: 'public' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Both import styles use the same authenticated client instance.
export function getSupabaseClient() {
  return supabase;
}
