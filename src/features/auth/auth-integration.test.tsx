import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from './AuthProvider';
import { RoleGuard } from './auth-routing';
import { SessionWorkspace } from '../../app/session-workspace';
import { useADemo } from '../a-demo/demo-context';
const session = (id: string) => ({ user: { id }, access_token: `token-${id}` } as Session);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function sdk(options: { initial?: Session | null; loading?: Promise<unknown>; read?: (id: string) => Promise<unknown> } = {}) {
  let callback: (event: AuthChangeEvent, session: Session | null) => void = () => {};
  const read = vi.fn(options.read ?? (async (id: string) => ({ data: { id, role: 'FARMER', full_name: id }, error: null })));
  const client = { auth: {
    getSession: vi.fn(() => options.loading ?? Promise.resolve({ data: { session: options.initial ?? null }, error: null })),
    onAuthStateChange: vi.fn((cb: typeof callback) => { callback = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    signOut: vi.fn(async () => { callback('SIGNED_OUT', null); return { error: null }; }),
    signInWithPassword: vi.fn(),
  }, from: () => ({ select: () => ({ eq: (_key: string, id: string) => ({ maybeSingle: () => read(id) }) }) }) };
  return { client: client as unknown as SupabaseClient, read, emit: (s: Session | null, e: AuthChangeEvent = 'SIGNED_IN') => act(() => { callback(e, s); }) };
}
function Probe() { const a = useAuth(); return <><p data-testid="auth">{a.status}:{a.profile?.id}:{a.profile?.role}</p><button onClick={a.retry}>retry</button><button onClick={() => { void a.signOut(); }}>logout</button></>; }
test('initial session waits for getSession, then role; no signed-out flash', async () => {
  const pending = deferred<unknown>(); const api = sdk({ loading: pending.promise });
  render(<AuthProvider client={api.client}><Probe /></AuthProvider>);
  expect(screen.getByTestId('auth')).toHaveTextContent('loading');
  expect(api.read).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ data: { session: session('one') }, error: null }));
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('ready:one:FARMER'));
});
test('stale getSession and profile response cannot revive a logged-out session', async () => {
  const initial = deferred<unknown>(); const profile = deferred<unknown>(); const api = sdk({ loading: initial.promise, read: () => profile.promise });
  render(<AuthProvider client={api.client}><Probe /></AuthProvider>);
  api.emit(session('one')); await waitFor(() => expect(api.read).toHaveBeenCalled()); api.emit(null, 'SIGNED_OUT');
  await act(async () => { initial.resolve({ data: { session: session('one') }, error: null }); profile.resolve({ data: { id: 'one', role: 'FARMER' }, error: null }); });
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('signed-out'));
});
test('profile load errors retry; pending role and wrong role never render protected content', async () => {
  let fail = true; const api = sdk({ initial: session('one'), read: async id => fail ? { data: null, error: new Error('offline') } : { data: { id, role: null }, error: null } });
  render(<MemoryRouter initialEntries={['/secure']}><AuthProvider client={api.client}><Routes><Route element={<RoleGuard role="FARMER" />}><Route path="/secure" element={<p>SECRET</p>} /></Route><Route path="/login" element={<p>LOGIN</p>} /></Routes></AuthProvider></MemoryRouter>);
  expect(await screen.findByText('Chưa tải được hồ sơ')).toBeVisible(); expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
  fail = false; fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); expect(await screen.findByText('Chờ cấp quyền')).toBeVisible();
});
test('wrong role redirects to 403', async () => {
  const api = sdk({ initial: session('one'), read: async id => ({ data: { id, role: 'BUYER' }, error: null }) });
  render(<MemoryRouter initialEntries={['/secure']}><AuthProvider client={api.client}><Routes><Route element={<RoleGuard role="FARMER" />}><Route path="/secure" element={<p>SECRET</p>} /></Route><Route path="/403" element={<p>FORBIDDEN</p>} /></Routes></AuthProvider></MemoryRouter>);
  expect(await screen.findByText('FORBIDDEN')).toBeVisible(); expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
});
function WorkspaceProbe() {
  const { session: s, status } = useAuth(); const client = useQueryClient(); const { state, update } = useADemo(); const [text, setText] = useState('');
  return <><p>{status}:{s?.user.id}</p><input aria-label="draft" value={text} onChange={e => setText(e.target.value)} />
    <button onClick={() => { client.setQueryData(['private'], 'old secret'); update(v => ({ ...v, confirmations: ['secret'] })); setText('draft secret'); }}>dirty</button>
    <p data-testid="cache">{String(client.getQueryData(['private']))}:{state.confirmations.join(',')}</p></>;
}
test('token refresh preserves input; user switch/logout isolates cache, demo and draft', async () => {
  const api = sdk({ initial: session('one') });
  render(<AuthProvider client={api.client}><SessionWorkspace><WorkspaceProbe /></SessionWorkspace></AuthProvider>);
  await screen.findByText('ready:one'); fireEvent.click(screen.getByText('dirty'));
  api.emit(session('one'), 'TOKEN_REFRESHED'); await waitFor(() => expect(screen.getByLabelText('draft')).toHaveValue('draft secret')); expect(api.read).toHaveBeenCalledTimes(1);
  api.emit(session('two')); await screen.findByText('ready:two'); expect(screen.getByLabelText('draft')).toHaveValue(''); expect(screen.getByTestId('cache')).not.toHaveTextContent('secret');
  api.emit(null, 'SIGNED_OUT'); await screen.findByText('signed-out:'); expect(screen.getByTestId('cache')).not.toHaveTextContent('secret');
});

function LateDataProbe({ old, started }: { old: Promise<string>; started: () => void }) {
  const { session: s, status } = useAuth();
  const query = useQuery({ queryKey: ['owned-data'], enabled: status === 'ready', queryFn: () => { started(); return s?.user.id === 'one' ? old : Promise.resolve('new-user-data'); } });
  return <p>{query.data ?? 'waiting'}</p>;
}
test('an in-flight query from the previous account cannot populate the new workspace', async () => {
  const api = sdk({ initial: session('one') }); const old = deferred<string>(); const started = vi.fn();
  render(<AuthProvider client={api.client}><SessionWorkspace><LateDataProbe old={old.promise} started={started} /></SessionWorkspace></AuthProvider>);
  await waitFor(() => expect(started).toHaveBeenCalled()); api.emit(session('two')); await screen.findByText('new-user-data');
  await act(async () => old.resolve('old-user-secret')); expect(screen.getByText('new-user-data')).toBeVisible(); expect(screen.queryByText('old-user-secret')).not.toBeInTheDocument();
});
test('getSession failure is visible and retry can restore the session', async () => {
  const initial = deferred<unknown>(); const api = sdk({ loading: initial.promise });
  render(<AuthProvider client={api.client}><Probe /></AuthProvider>);
  await act(async () => initial.resolve({ data: { session: null }, error: new Error('offline') }));
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('error'));
  vi.mocked(api.client.auth.getSession).mockResolvedValue({ data: { session: session('one') }, error: null });
  fireEvent.click(screen.getByText('retry')); await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('ready:one:FARMER'));
});
