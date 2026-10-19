export const registrationRoles = { FARMER: 'Nhà vườn', BUYER: 'Thương lái / Thu mua', CARRIER: 'Đơn vị vận tải' } as const;
export type RegistrationRole = keyof typeof registrationRoles;
export interface RegistrationInput { fullName: string; email: string; password: string; confirmation: string; role: string; }
export function registrationCredentials(input: RegistrationInput) {
  const fullName = input.fullName.trim(); const email = input.email.trim().toLowerCase();
  if (!fullName || fullName.length > 160) throw new Error('Nhập họ tên từ 1 đến 160 ký tự.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email chưa hợp lệ.');
  if (input.password.length < 8 || input.password.length > 128) throw new Error('Mật khẩu cần từ 8 đến 128 ký tự.');
  if (input.password !== input.confirmation) throw new Error('Mật khẩu xác nhận chưa khớp.');
  if (!Object.hasOwn(registrationRoles, input.role)) throw new Error('Chọn vai trò Nhà vườn, Thu mua hoặc Vận tải.');
  return { email, password: input.password, options: { data: { full_name: fullName, registration_role: input.role as RegistrationRole } } };
}
export function registrationError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === 'user_already_exists' || code === 'email_exists') return 'Email này đã có tài khoản. Vui lòng đăng nhập.';
  if (code === 'signup_disabled') return 'Hệ thống đang tạm đóng đăng ký. Vui lòng liên hệ quản trị viên.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Đã đạt giới hạn yêu cầu. Vui lòng chờ rồi thử lại.';
  if (code === 'email_address_invalid' || code === 'email_address_not_authorized') return 'Chưa gửi được email xác nhận tới địa chỉ này. Kiểm tra email hoặc liên hệ quản trị viên.';
  if (code === 'weak_password') return 'Mật khẩu chưa đáp ứng yêu cầu của hệ thống. Hãy chọn mật khẩu mạnh hơn.';
  return 'Chưa đăng ký được tài khoản. Vui lòng kiểm tra kết nối và thử lại.';
}
