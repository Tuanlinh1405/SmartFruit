import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createChatHandler } from './handler.ts';

Deno.serve(createChatHandler({
  apiKey: Deno.env.get('OPENROUTER_API_KEY'), model: Deno.env.get('OPENROUTER_MODEL'),
  allowedOrigins: (Deno.env.get('FARMER_CHAT_ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean),
  async authenticate(jwt) {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(jwt);
    if (error || !data.user) return null;
    const profile = await client.from('profiles').select('role,is_suspended').eq('id', data.user.id).maybeSingle();
    if (profile.error) throw new Error('Profile unavailable');
    return { role: profile.data?.is_suspended ? null : profile.data?.role ?? null };
  },
  // Never log prompt, response, JWT, identity, key or provider errors.
  log: event => console.log(JSON.stringify(event)),
}));
