import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { roleHome, SessionState } from './auth-routing';
import { explainError } from '../../lib/format';
import { Card, PageHeader, LoadingState } from '../../components/shared';
import { Button, TextField } from '../../components/ui';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/shared/brand';
export function LoginPage() {
  const { status, profile, signIn } = useAuth(); const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  if (status === 'loading') return <LoadingState />;
  if (status === 'error' || (status === 'ready' && !profile?.role)) return <SessionState />;
  if (status === 'ready' && profile?.role) return <Navigate to={roleHome(profile.role)} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await signIn(identifier, password); navigate('/role-home', { replace: true }); }
    catch (cause) { setError(explainError(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="landing stack login-page"><Link to="/" className="brand public-brand"><Brand /></Link><PageHeader eyebrow="Kết nối nông sản Việt" title="Đăng nhập" description="Quản lý nhà vườn, thu mua hoặc vận tải bằng tài khoản của bạn." />
    <Card><form className="stack" onSubmit={submit} noValidate>
      <TextField label="Email hoặc số điện thoại" required autoComplete="username" placeholder="ban@example.com hoặc +84901234567" value={identifier} onChange={e => setIdentifier(e.target.value)} />
      <TextField label="Mật khẩu" required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p role="alert">{error}</p>}<Button type="submit" loading={busy}>Đăng nhập</Button>
    </form></Card><p>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></p>
  </main>;
}
