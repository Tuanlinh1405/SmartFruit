import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AppShell } from '../layouts/app-shell';
import { pageInventory, uiInventory } from './ui-inventory';
test('inventory covers all 42 IDs and modal parents are pages',()=>{expect(uiInventory).toHaveLength(42);expect(new Set(uiInventory.map(entry=>entry.id)).size).toBe(42);expect(new Set(pageInventory.map(entry=>entry.path)).size).toBe(pageInventory.length);for(const entry of uiInventory.filter(entry=>entry.kind==='modal'))expect(pageInventory.some(parent=>parent.path===entry.path)).toBe(true);});
test('active navigation matches exact page and breadcrumbs',()=>{render(<MemoryRouter initialEntries={['/farmer/lots/new']}><Routes><Route path="/farmer" element={<AppShell role="FARMER"/>}><Route path="lots/new" element={<p>Nội dung</p>}/></Route></Routes></MemoryRouter>);expect(screen.getByRole('link',{name:'Tạo / sửa lô hàng'})).toHaveAttribute('aria-current','page');expect(screen.getByRole('link',{name:'Danh sách lô hàng'})).not.toHaveAttribute('aria-current');expect(screen.getByRole('navigation',{name:'Đường dẫn'})).toHaveTextContent('Tạo / sửa lô hàng');});
