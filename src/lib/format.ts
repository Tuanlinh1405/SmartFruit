export const formatMoney = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} đ/kg`;
export const formatTonnes = (kg: number) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(kg / 1000)} tấn`;
export const formatDate = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
};

export function explainError(error: unknown): string {
  const details = error && typeof error === 'object' ? error as { message?: string; code?: string } : null;
  const message = details?.message || (error instanceof Error ? error.message : String(error));
  const translations: Record<string, string> = {
    'Connection unavailable': 'Kết nối không tồn tại hoặc bạn không có quyền truy cập.',
    'Invitation already answered': 'Lời mời đã được xử lý. Hãy tải lại danh sách.',
    'Accept connection before messaging': 'Hai bên cần đồng ý kết nối trước khi gửi tin nhắn.',
    'Only recipient may accept/reject offer': 'Chỉ bên nhận được quyền đồng ý hoặc từ chối đề nghị.',
    'Offer already answered': 'Đề nghị đã được xử lý. Hãy tải lại hội thoại.',
    'Invalid price, quantity or harvest date': 'Giá, lượng hoặc ngày lấy hàng chưa hợp lệ với lô đang bán.',
    'Offer exceeds request quantity or date': 'Đề nghị không đáp ứng loại, giống, khối lượng hoặc thời gian của nhu cầu.',
    'Both participants must confirm completion first': 'Cả hai bên cần xác nhận hoàn tất trước khi đánh giá.',
    'Open request required': 'Cần công bố nhu cầu trước khi gửi lời mời.',
    'Connection is not available for offers': 'Chưa thể gửi đề nghị: kết nối chưa được chấp nhận, lô đã đóng hoặc đã có thỏa thuận.',
    'Lot changed; propose a new offer': 'Lô hàng đã thay đổi. Hãy kiểm tra lại và gửi đề nghị mới.',
    'Request changed; propose a new offer': 'Nhu cầu đã thay đổi. Hãy kiểm tra lại và gửi đề nghị mới.',
    'Invalid login credentials': 'Email/số điện thoại hoặc mật khẩu chưa đúng.',
  };
  if (translations[message]) return translations[message];
  if (details?.code === '23505') return 'Bản ghi đã tồn tại. Hãy tải lại để kiểm tra trước khi thử lại.';
  if (details?.code === '42501') return 'Tài khoản hiện tại không có quyền thực hiện thao tác này.';
  if (/JWT|session|refresh token/i.test(message)) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (/permission denied|row-level security|42501/i.test(message)) return 'Tài khoản hiện tại không có quyền thực hiện thao tác này.';
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) return 'Không kết nối được tới Supabase. Kiểm tra mạng rồi thử lại.';
  return message || 'Có lỗi xảy ra. Vui lòng thử lại.';
}
