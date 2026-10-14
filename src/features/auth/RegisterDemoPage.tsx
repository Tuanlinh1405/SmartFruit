import { useState } from 'react';
import { Link } from 'react-router-dom';

export function RegisterDemoPage() {
  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState<'form' | 'otp' | 'done'>('form');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  function next() {
    const normalized = phone.trim().replace(/[\s.()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError('Nhập số điện thoại quốc tế, ví dụ +84901234567.'); return;
    }
    setError(''); setStage('otp');
  }
  return <div className="login-shell"><div className="login-aside"><div className="brand"><span className="brand-icon">✳</span>
    <span>LogStar<small>Kết nối nông sản Việt</small></span></div><div className="login-aside-copy"><span className="eyebrow light">Bản minh họa</span>
      <h1>Tham gia mạng lưới nông sản.</h1><p>Luồng đăng ký đang được chuẩn bị theo thiết kế sản phẩm.</p></div></div>
    <main className="login-main"><div className="login-card"><span className="demo-badge">Minh họa · không gửi SMS</span>
      <h2>Đăng ký tài khoản</h2><p>Luồng này chỉ mô phỏng màn hình. Để có tài khoản thật, liên hệ quản trị viên LogStar.</p>
      {stage === 'form' && <form onSubmit={event => { event.preventDefault(); next(); }}>
        <label>Số điện thoại<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="+84901234567" inputMode="tel" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full">Xem bước OTP demo →</button></form>}
      {stage === 'otp' && <form onSubmit={event => { event.preventDefault(); setStage('done'); }}>
        <p>OTP minh họa cho {phone}; không có mã nào được gửi và không có xác thực thật.</p>
        <label>Mã OTP demo<input value={otp} onChange={event => setOtp(event.target.value)} inputMode="numeric" maxLength={6} placeholder="Nhập 6 chữ số bất kỳ" required /></label>
        <button className="button primary full" disabled={!/^\d{6}$/.test(otp)}>Hoàn tất mô phỏng</button></form>}
      {stage === 'done' && <div className="notice">Đã hoàn tất luồng minh họa. Tài khoản chưa được tạo trên hệ thống.</div>}
      <Link className="text-link" to="/login">← Quay lại đăng nhập</Link></div></main></div>;
}
