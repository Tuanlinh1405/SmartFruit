import { Handshake, LayoutDashboard, Mail, Package, Search, ShieldCheck, Star, Truck } from 'lucide-react';
import { navigationFor } from './ui-inventory';
import type { Role, UiEntry } from '../types/ui';

// Reachable menu destinations are independent of the page/modal inventory.
export type NavigationItem = Pick<UiEntry, 'path' | 'title' | 'icon'> & { end?: boolean };
const buyer: NavigationItem[] = [
  { path: '/buyer/dashboard', title: 'Tổng quan', icon: LayoutDashboard, end: true },
  { path: '/buyer/requests', title: 'Yêu cầu thu mua', icon: Package },
  { path: '/buyer/lots', title: 'Tìm kiếm lô hàng', icon: Search },
  { path: '/buyer/invitations', title: 'Lời mời kết nối', icon: Mail },
  { path: '/buyer/negotiations', title: 'Đàm phán', icon: Handshake },
  { path: '/buyer/transport', title: 'Vận chuyển', icon: Truck },
  { path: '/buyer/reviews', title: 'Đánh giá', icon: Star },
  { path: '/buyer/policy', title: 'Chính sách', icon: ShieldCheck },
];
export function workspaceNavigation(role: Role): NavigationItem[] {
  if (role === 'BUYER') return buyer;
  if (role === 'FARMER') return navigationFor(role)
    .filter(item => item.id !== 'FUI-02' && item.id !== 'FUI-04')
    .flatMap<NavigationItem>(item => item.id === 'FUI-07' ? [
      { path: '/farmer/invitations', title: 'Lời mời kết nối', icon: Mail },
      { path: '/farmer/negotiations', title: 'Đàm phán', icon: Handshake },
    ] : [{ path: item.path, title: item.title, icon: item.icon, end: item.path.endsWith('/dashboard') }]);
  return navigationFor(role)
    .filter(item => item.id !== 'FUI-02' && item.id !== 'FUI-04')
    .map(item => ({ path: item.path, title: item.title, icon: item.icon, end: item.path.endsWith('/dashboard') }));
}
