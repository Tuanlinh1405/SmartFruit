import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/domain';
import { explainError } from '../../lib/format';
import { passwordCredentials } from './password-credentials';
import { registrationCredentials, registrationRoles, type RegistrationInput } from './registration';

type Snapshot = { session: Session | null; profile: Profile | null; status: 'loading' | 'signed-out' | 'ready' | 'error' | 'suspended'; error: string | null };
export type AuthState = Snapshot & { retry: () => void; signOut: () => Promise<void>; signIn: (identifier: string, password: string) => Promise<void>; signUp: (input: RegistrationInput) => Promise<{ needsEmailConfirmation: boolean }> };
const initial: Snapshot = { session: null, profile: null, status: 'loading', error: null };
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children, client = supabase }: { children: ReactNode; client?: SupabaseClient }) {
  const [state, setState] = useState<Snapshot>(initial);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(state); const generation = useRef(0);
  const publish = useCallback((snapshot: Snapshot) => { latest.current = snapshot; setState(snapshot); }, []);
  useEffect(() => {
    let alive = true; let receivedEvent = false;
    async function accept(session: Session | null) {
      const ticket = ++generation.current;
      if (!alive) return;
      if (!session) { publish({ ...initial, status: 'signed-out' }); return; }
      if (latest.current.status === 'ready' && latest.current.session?.user.id === session.user.id) {
        publish({ ...latest.current, session }); return;
      }
      publish({ ...initial, session });
      try {
        const readProfile = () => client.from('profiles').select('id,role,full_name,phone_display,is_suspended').eq('id', session.user.id).maybeSingle<Profile>();
        let result = await readProfile();
        if (!alive || ticket !== generation.current) return;
        if (result.error) throw result.error;
        if (!result.data || result.data.id !== session.user.id) throw new Error('Chưa có hồ sơ ứng dụng cho tài khoản này.');
        if (!result.data.role && !result.data.is_suspended && Object.hasOwn(registrationRoles, session.user.user_metadata?.registration_role ?? '')) {
          const enrolled = await client.rpc('complete_registration');
          if (!alive || ticket !== generation.current) return;
          if (enrolled.error) throw new Error(enrolled.error.code === 'PGRST202'
            ? 'Tài khoản đã được tạo nhưng máy chủ chưa cập nhật chức năng cấp vai trò đăng ký. Liên hệ quản trị viên.'
            : 'Chưa hoàn tất vai trò đăng ký. Hãy xác nhận email rồi thử tải lại.');
          result = await readProfile();
          if (!alive || ticket !== generation.current) return;
          if (result.error || !result.data?.role) throw new Error('Chưa tải được vai trò đăng ký. Vui lòng thử lại.');
        }
        const roles = ['FARMER', 'BUYER', 'CARRIER', 'ADMIN'];
        if (result.data.role !== null && !roles.includes(result.data.role)) throw new Error('Vai trò ứng dụng không hợp lệ.');
        publish({ session, profile: result.data, status: result.data.is_suspended ? 'suspended' : 'ready', error: null });
      } catch (cause) {
        if (alive && ticket === generation.current) publish({ session, profile: null, status: 'error', error: explainError(cause) });
      }
    }
    let unsubscribe: (() => void) | undefined;
    try {
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        receivedEvent = true;
        const eventTicket = ++generation.current;
        if (!session) publish({ ...initial, status: 'signed-out' });
        else if (latest.current.status !== 'ready' || latest.current.session?.user.id !== session.user.id) publish({ ...initial, session });
        // Supabase callback returns synchronously; defer SDK calls until its lock releases.
        setTimeout(() => { if (alive && eventTicket === generation.current) void accept(session); }, 0);
      });
      unsubscribe = () => subscription.unsubscribe();
      void client.auth.getSession().then(({ data, error }) => {
        if (!alive || receivedEvent) return;
        if (error) throw error;
        void accept(data.session);
      }).catch(cause => { if (alive && !receivedEvent) publish({ ...initial, status: 'error', error: explainError(cause) }); });
    } catch (cause) { publish({ ...initial, status: 'error', error: explainError(cause) }); }
    return () => { alive = false; generation.current++; unsubscribe?.(); };
  }, [client, attempt, publish]);
  const retry = useCallback(() => { generation.current++; publish(initial); setAttempt(n => n + 1); }, [publish]);
  const signOut = useCallback(async () => {
    const { error } = await client.auth.signOut(); if (error) throw error;
    generation.current++; publish({ ...initial, status: 'signed-out' });
  }, [client, publish]);
  const signIn = useCallback(async (identifier: string, password: string) => {
    const { error } = await client.auth.signInWithPassword(passwordCredentials(identifier, password)); if (error) throw error;
  }, [client]);
  const signUp = useCallback(async (input: RegistrationInput) => {
    const credentials = registrationCredentials(input);
    const { data, error } = await client.auth.signUp({ ...credentials, options: { ...credentials.options, emailRedirectTo: `${window.location.origin}/role-home` } });
    if (error) throw error;
    if (!data.user) throw new Error('Registration returned no user');
    return { needsEmailConfirmation: !data.session };
  }, [client]);
  return <Context.Provider value={{ ...state, retry, signOut, signIn, signUp }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider is missing'); return value; }
