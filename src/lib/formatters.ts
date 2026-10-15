const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
export function formatNumber(value: number) { return Number.isFinite(value) ? numberFormat.format(value) : '—'; }
export function formatVnd(value: number) { return `${formatNumber(value)} đ`; }
export function formatWeight(kg: number) { return kg >= 1000 ? `${formatNumber(kg / 1000)} tấn` : `${formatNumber(kg)} kg`; }
export function formatDate(value: string | Date) {
  // Date-only values retain their calendar date rather than shifting by timezone.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}
