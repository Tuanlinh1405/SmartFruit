import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/shared/brand';
import { Card, LoadingState, PageHeader } from '../../components/shared';
import { Button, Select, TextField } from '../../components/ui';
import { useAuth } from './AuthProvider';
import { roleHome, SessionState } from './auth-routing';
import { registrationCredentials, registrationError, registrationRoles } from './registration';

export function RegisterPage() {
  const { status, profile, signUp } = useAuth(); const navigate = useNavigate();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [role, setRole] = useState('FARMER');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [confirmEmail, setConfirmEmail] = useState(false); const locked = useRef(false);
  if (status === 'loading') return <LoadingState />;
  if (status === 'ready' && profile?.role) return <Navigate to={roleHome(profile.role)} replace />;
  if (status === 'error' || status === 'suspended' || (status === 'ready' && !profile?.role)) return <SessionState />;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (locked.current) return;
    setError(''); const input = { fullName, email, password, confirmation, role };
    try { registrationCredentials(input); } catch (cause) { setError((cause as Error).message); return; }
    locked.current = true; setBusy(true);
    try {
      const result = await signUp(input); setPassword(''); setConfirmation('');
      if (result.needsEmailConfirmation) setConfirmEmail(true); else navigate('/role-home', { replace: true });
    } catch (cause) { setError(registrationError(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <main className="landing stack login-page"><Link to="/" className="brand public-brand"><Brand /></Link>
    <PageHeader eyebrow="Kết nối nông sản Việt" title="Đăng ký tài khoản" description="Tạo tài khoản để quản lý nhà vườn, thu mua hoặc vận tải." />
    <Card>{confirmEmail ? <div className="stack" role="status"><h2>Kiểm tra email để tiếp tục</h2><p>Nếu email hợp lệ và chưa được sử dụng, bạn sẽ nhận được liên kết xác nhận. Kiểm tra cả thư mục Spam, xác nhận rồi đăng nhập.</p><Link className="button button-primary" to="/login">Đến trang đăng nhập</Link></div> :
      <form className="stack" onSubmit={submit} noValidate aria-label="Đăng ký tài khoản">
        <TextField label="Họ và tên" required maxLength={160} autoComplete="name" value={fullName} disabled={busy} onChange={e => setFullName(e.target.value)} />
        <TextField label="Email" type="email" required autoComplete="email" value={email} disabled={busy} onChange={e => setEmail(e.target.value)} />
        <Select label="Bạn tham gia với vai trò" required value={role} disabled={busy} onChange={e => setRole(e.target.value)}>{Object.entries(registrationRoles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <TextField label="Mật khẩu" type="password" required autoComplete="new-password" hint="Từ 8 đến 128 ký tự." value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
        <TextField label="Xác nhận mật khẩu" type="password" required autoComplete="new-password" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} />
        {error && <p role="alert">{error}</p>}<Button type="submit" loading={busy}>Tạo tài khoản</Button>
      </form>}</Card><p>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p><p>Khi đăng ký, bạn đồng ý với <Link to="/policy">Chính sách &amp; bảo mật</Link>.</p>
  </main>;
}
