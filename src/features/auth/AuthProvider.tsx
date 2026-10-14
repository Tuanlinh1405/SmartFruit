import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/domain';
import { explainError } from '../../lib/format';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  status: 'loading' | 'signed-out' | 'ready' | 'error';
  error: string | null;
  retry: () => void;
};

const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!alive) return;
      if (authError) { setError(explainError(authError)); setStatus('error'); return; }
      setSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!session) {
      setProfile(null);
      setStatus('signed-out');
      setError(null);
      return () => { alive = false; };
    }
    setStatus('loading');
    setProfile(null);
    supabase.from('profiles').select('id,role,full_name,phone_display').eq('id', session.user.id).maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!alive) return;
        if (loadError) { setError(explainError(loadError)); setStatus('error'); return; }
        if (!data) { setError('Chưa có hồ sơ ứng dụng cho tài khoản này.'); setStatus('error'); return; }
        setProfile(data as Profile);
        setError(null);
        setStatus('ready');
      });
    return () => { alive = false; };
  }, [session?.user.id, attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const value = useMemo(() => ({ session, profile, status, error, retry }), [session, profile, status, error, retry]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const state = useContext(Context);
  if (!state) throw new Error('AuthProvider is missing');
  return state;
}
