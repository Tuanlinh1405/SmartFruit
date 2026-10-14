export const formatMoney = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} đ/kg`;
export const formatTonnes = (kg: number) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(kg / 1000)} tấn`;
export const formatDate = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
};

export function explainError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/JWT|session|refresh token/i.test(message)) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (/permission denied|row-level security|42501/i.test(message)) return 'Tài khoản hiện tại không có quyền thực hiện thao tác này.';
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) return 'Không kết nối được tới Supabase. Kiểm tra mạng rồi thử lại.';
  return message || 'Có lỗi xảy ra. Vui lòng thử lại.';
}
