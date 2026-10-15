import { LayoutDashboard, UserRound, Package, Handshake, Truck, MessageCircle, Star, ChartNoAxesCombined, CloudSun, MapPin, Bell, ClipboardList, UsersRound, Settings, Search, Sprout, ShieldCheck } from 'lucide-react';
import type { Role, UiEntry, FeatureLevel } from '../types/ui';
export const roleMeta = {
  FARMER: { label: 'Nhà vườn', description: 'Hồ sơ vườn, lô hàng và tìm người mua.', prefix: '/farmer', icon: Sprout },
  BUYER: { label: 'Thương lái', description: 'Nhu cầu thu mua và tìm lô hàng.', prefix: '/buyer', icon: Handshake },
  CARRIER: { label: 'Nhà xe', description: 'Hồ sơ xe và giao diện vận chuyển.', prefix: '/carrier', icon: Truck },
  ADMIN: { label: 'Quản trị', description: 'Quản lý hồ sơ và tin trên hệ thống.', prefix: '/admin', icon: ShieldCheck },
} as const;
type Definition = [string, string, string, FeatureLevel, UiEntry['icon']?];
function pages(role: Role, owner: 'A' | 'B', definitions: Definition[]): UiEntry[] { return definitions.map(([id, title, slug, level, icon]) => ({ id, title, path: `${roleMeta[role].prefix}/${slug}`, kind: 'page', role, owner, level, icon, status: level === 'U' ? 'deferred' : ['FUI-03', 'CUI-02'].includes(id) ? 'partial' : 'live' })); }
function modal(id: string, title: string, path: string, role: Role | undefined, owner: 'A' | 'B'): UiEntry { return { id, title, path, kind: 'modal', role, owner, level: id === 'BUI-09' || id === 'CUI-04' ? 'U' : 'F', status: id === 'BUI-09' || id === 'CUI-04' ? 'deferred' : 'live' }; }
export const uiInventory: UiEntry[] = [
  ...pages('FARMER', 'A', [
    ['FUI-01','Tổng quan','dashboard','F',LayoutDashboard], ['FUI-02','Hồ sơ nhà vườn','profile','F',UserRound],
    ['FUI-03','Danh sách lô hàng','lots','F',Package], ['FUI-04','Tạo / sửa lô hàng','lots/new','U',ClipboardList],
    ['FUI-05','Người mua phù hợp','matches','F',Handshake], ['FUI-06','Tìm xe','transport','U',Truck],
    ['FUI-14','Lời mời kết nối','invitations','F',Bell],
    ['FUI-07','Đàm phán','chat','F',MessageCircle], ['FUI-09','Đánh giá & tín nhiệm','reviews','F',Star],
    ['FUI-10','Giá tham khảo','prices','U',ChartNoAxesCombined], ['FUI-11','Thời tiết & khuyến nghị','weather','U',CloudSun],
    ['FUI-12','Bản đồ thương lái','map','U',MapPin], ['FUI-13','Thông báo / chính sách','notifications','U',Bell],
  ]),
  modal('FUI-08','Xác nhận đàm phán','/farmer/chat','FARMER','A'),
  ...pages('BUYER', 'B', [
    ['BUI-01','Tổng quan','dashboard','F',LayoutDashboard], ['BUI-02','Tạo yêu cầu thu mua','requests/new','F',ClipboardList],
    ['BUI-03','Nhu cầu thu mua','requests','F',Package], ['BUI-04','Tìm lô hàng','lots','F',Search],
    ['BUI-14','Lời mời kết nối','invitations','F',Bell], ['BUI-15','Hồ sơ thương lái','profile','F',UserRound],
    ['BUI-07','Đàm phán','chat','F',MessageCircle], ['BUI-10','Tìm xe','transport','U',Truck],
    ['BUI-11','Đánh giá & tín nhiệm','reviews','F',Star], ['BUI-12','Bản đồ nhà vườn','map','U',MapPin],
    ['BUI-13','Thông báo / chính sách','notifications','U',Bell],
  ]),
  { ...modal('BUI-05','Chi tiết lô hàng','/buyer/lots','BUYER','B'), level: 'F' }, modal('BUI-06','Lời mời từ nhà vườn','/buyer/chat','BUYER','B'),
  modal('BUI-08','Xác nhận đơn hàng','/buyer/chat','BUYER','B'), modal('BUI-09','Hẹn khảo sát vườn','/buyer/chat','BUYER','B'),
  ...pages('CARRIER','A', [
    ['CUI-01','Tổng quan','dashboard','F',LayoutDashboard], ['CUI-02','Danh sách xe','vehicles','F',Truck],
    ['CUI-07','Hồ sơ nhà xe','profile','F',UserRound],
    ['CUI-03','Yêu cầu vận chuyển','requests','U',ClipboardList], ['CUI-05','Theo dõi chuyến','tracking','U',MapPin],
    ['CUI-06','Đánh giá tài xế','reviews','U',Star],
  ]), modal('CUI-04','Chi tiết / báo giá nhận chuyến','/carrier/requests','CARRIER','A'),
  ...pages('ADMIN','B', [
    ['AUI-01','Tổng quan vận hành','dashboard','F',LayoutDashboard], ['AUI-02','Quản lý người dùng','users','F',UsersRound],
    ['AUI-03','Quản lý lô hàng','lots','F',Package], ['AUI-04','Nhu cầu thu mua','requests','F',ClipboardList],
    ['AUI-07','Kết nối & thỏa thuận','connections','F',Handshake],
    ['AUI-05','Yêu cầu xe','transports','U',Truck], ['AUI-06','Giá / chính sách / cấu hình','settings','U',Settings],
  ]),
  { id:'AUTH-01',title:'Đăng nhập',path:'/auth/login',kind:'page',owner:'B',level:'F' },
  { id:'AUTH-04',title:'Không có quyền / không tìm thấy',path:'/403',kind:'page',owner:'B',level:'U' },
];
export const pageInventory = uiInventory.filter(entry => entry.kind === 'page');
export function navigationFor(role: Role) { return pageInventory.filter(entry => entry.role === role && !entry.path.endsWith('/new')); }
