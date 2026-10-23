import type { DisplayStatus } from '../../types/ui';
export const statusLabels: Record<DisplayStatus, { label: string; tone: string }> = {
  CLOSED: { label: 'Đã đóng', tone: 'danger' }, CANCELLED: { label: 'Đã hủy', tone: 'warning' },
  DRAFT: { label: 'Nháp', tone: '' }, PUBLISHED: { label: 'Đã đăng', tone: 'success' }, OPEN: { label: 'Đang tìm mua', tone: 'success' }, NEGOTIATING: { label: 'Đang đàm phán', tone: 'warning' }, CONFIRMED_DEMO: { label: 'Đã chốt · Minh họa', tone: 'demo' }, DELIVERED_DEMO: { label: 'Đã giao · Minh họa', tone: 'demo' },
};
export function Badge({ status }: { status: DisplayStatus }) { const item = statusLabels[status]; return <span className={`badge badge-${item.tone}`}>{item.label}</span>; }
