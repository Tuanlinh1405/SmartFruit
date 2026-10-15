import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { explainError } from '../../lib/format';
import { useAuth } from './AuthProvider';
import { AuthLayout } from '../../layouts/auth-layout';
import { Card } from '../../components/shared/content';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/fields';

export function LoginPage() {
  const { status, profile } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (status === 'suspended') return <Navigate to="/" replace />;
  if (status === 'ready' && profile?.role) return <Navigate to={profile.role === 'ADMIN' ? '/admin' : profile.role === 'BUYER' ? '/buyer' : '/role-home'} replace />;

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const email = identifier.includes('@') ? identifier.trim().toLowerCase() : null;
    const normalized = identifier.trim().replace(/[\s.()-]/g, '');
    if (email ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : !/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError('Nhập email hoặc số điện thoại quốc tế, ví dụ +84901234567.'); return;
    }
    setBusy(true); setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword(email
        ? { email, password } : { phone: normalized, password });
      if (signInError) throw signInError;
      navigate('/', { replace: true });
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  return <AuthLayout><Card>
      <span className="eyebrow">Chào mừng trở lại</span><h1>Đăng nhập</h1>
      <p>Dùng tài khoản ứng dụng đã được cấp cho bạn.</p>
      <form onSubmit={signIn}>
        <TextField label="Email hoặc số điện thoại" autoComplete="username" placeholder="Email hoặc +84901234567" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
        <TextField label="Mật khẩu" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button className="full" loading={busy} type="submit">{busy ? 'Đang đăng nhập…' : 'Đăng nhập →'}</Button>
      </form>
      <p className="muted small-text" style={{marginTop:24}}>Dùng tài khoản được quản trị viên cấp. Không cần OTP.</p>
    </Card></AuthLayout>;
}
