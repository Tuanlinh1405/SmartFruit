import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { explainError } from '../../lib/format';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { status, profile } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (status === 'ready' && profile?.role) return <Navigate to={profile.role === 'ADMIN' ? '/admin' : profile.role === 'BUYER' ? '/buyer' : '/role-home'} replace />;

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const normalized = phone.trim().replace(/[\s.()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) { setError('Nhập số điện thoại quốc tế, ví dụ +84901234567.'); return; }
    setBusy(true); setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ phone: normalized, password });
      if (signInError) throw signInError;
      navigate('/', { replace: true });
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }

  return <div className="login-shell">
    <div className="login-aside">
      <div className="brand"><span className="brand-icon">✳</span><span>LogStar<small>Kết nối nông sản Việt</small></span></div>
      <div className="login-aside-copy"><span className="eyebrow light">Nền tảng kết nối nông nghiệp</span><h1>Tìm đúng nguồn hàng, đúng thời điểm.</h1><p>Quản lý nhu cầu thu mua và kết nối với nhà vườn qua dữ liệu minh bạch.</p></div>
      <div className="login-aside-foot">LogStar · Nông sản Việt Nam</div>
    </div>
    <main className="login-main"><div className="login-card">
      <span className="eyebrow">Chào mừng trở lại</span><h2>Đăng nhập</h2>
      <p>Dùng tài khoản ứng dụng đã được cấp cho bạn.</p>
      <form onSubmit={signIn}>
        <label>Số điện thoại<input autoComplete="tel" inputMode="tel" placeholder="+84901234567" value={phone} onChange={e => setPhone(e.target.value)} required /></label>
        <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full" disabled={busy} type="submit">{busy ? 'Đang đăng nhập…' : 'Đăng nhập →'}</button>
      </form>
      <div className="login-note">Hồ sơ [DEMO] trong database là dữ liệu mẫu và chưa có mật khẩu đăng nhập.</div>
    </div></main>
  </div>;
}
