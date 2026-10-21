import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
vi.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { full_name: 'Farmer test' }, signOut: vi.fn() }) }));
import { AppShell } from '../layouts/app-shell';
import { roleMeta, pageInventory, uiInventory } from './ui-inventory';
test('inventory covers all 42 IDs and modal parents are pages',()=>{expect(uiInventory).toHaveLength(42);expect(new Set(uiInventory.map(entry=>entry.id)).size).toBe(42);expect(new Set(pageInventory.map(entry=>entry.path)).size).toBe(pageInventory.length);for(const entry of uiInventory.filter(entry=>entry.kind==='modal'))expect(pageInventory.some(parent=>parent.path===entry.path)).toBe(true);});
test.each(['/farmer/lots/new', '/farmer/lots/lot-1', '/farmer/lots/lot-1/edit'])('lot navigation stays active at %s', path=>{render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/farmer" element={<AppShell role="FARMER"/>}><Route path="lots/*" element={<p>Nội dung</p>}/></Route></Routes></MemoryRouter>);expect(within(screen.getByRole('navigation',{name:'Điều hướng Nhà vườn'})).getByRole('link',{name:'Danh sách lô hàng'})).toHaveAttribute('aria-current','page');expect(within(screen.getByRole('navigation',{name:'Điều hướng Nhà vườn'})).getByRole('link',{name:'Tổng quan'})).not.toHaveAttribute('aria-current');expect(screen.queryByRole('link',{name:'Tạo / sửa lô hàng'})).not.toBeInTheDocument();expect(screen.getByRole('navigation',{name:'Đường dẫn'})).toHaveTextContent(path.endsWith('/new') ? 'Tạo / sửa lô hàng' : path.endsWith('/edit') ? 'Chỉnh sửa' : 'Danh sách lô hàng');});

test('buyer menu uses live destinations and account profile',()=>{render(<MemoryRouter initialEntries={['/buyer/requests/new']}><Routes><Route path="/buyer" element={<AppShell role="BUYER"/>}><Route path="requests/new" element={<p>Nội dung</p>}/></Route></Routes></MemoryRouter>);expect(within(screen.getByRole('navigation',{name:`Điều hướng ${roleMeta.BUYER.label}`})).getByRole('link',{name:'Yêu cầu thu mua'})).toHaveAttribute('aria-current','page');expect(within(screen.getByRole('navigation',{name:`Điều hướng ${roleMeta.BUYER.label}`})).getByRole('link',{name:'Tổng quan'})).toHaveAttribute('href','/buyer/dashboard');expect(within(screen.getByRole('navigation',{name:`Điều hướng ${roleMeta.BUYER.label}`})).getByRole('link',{name:'Đàm phán'})).toHaveAttribute('href','/buyer/negotiations');expect(screen.getByRole('link',{name:/Xem hồ sơ/})).toHaveAttribute('href','/buyer/profile');});

test.each(['FARMER','BUYER','CARRIER','ADMIN'] as const)('mobile menu keeps every %s destination reachable',async role=>{
  render(<MemoryRouter initialEntries={[roleMeta[role].prefix+'/dashboard']}><AppShell role={role}/></MemoryRouter>);
  const quick=screen.getByRole('navigation',{name:`Điều hướng nhanh ${roleMeta[role].label}`});
  expect(within(quick).getAllByRole('link').length).toBeLessThanOrEqual(4);
  await userEvent.click(within(quick).getByRole('button',{name:'Mở tất cả chức năng'}));
  const dialog=screen.getByRole('dialog',{name:`Menu ${roleMeta[role].label}`});
  expect(within(dialog).getByRole('navigation',{name:`Điều hướng ${roleMeta[role].label}`})).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('mobile Farmer navigation marks nested lot routes active',()=>{
 render(<MemoryRouter initialEntries={['/farmer/lots/lot-1/edit']}><AppShell role="FARMER"/></MemoryRouter>);
 const quick=screen.getByRole('navigation',{name:'Điều hướng nhanh Nhà vườn'});
 expect(within(quick).getByRole('link',{name:'Danh sách lô hàng'})).toHaveAttribute('aria-current','page');
 expect(within(quick).getByRole('link',{name:'Tổng quan'})).not.toHaveAttribute('aria-current');
});
