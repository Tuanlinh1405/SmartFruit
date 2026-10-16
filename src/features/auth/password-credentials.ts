export function passwordCredentials(identifier: string, password: string): { email: string; password: string } | { phone: string; password: string } {
  const value = identifier.trim();
  if (!password) throw new Error('Nhập mật khẩu của tài khoản đã được cấp.');
  if (value.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Nhập email hợp lệ.');
    return { email: value, password };
  }
  const phone = value.replace(/[\s.()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Nhập email hoặc số điện thoại quốc tế, ví dụ +84901234567.');
  return { phone, password };
}
