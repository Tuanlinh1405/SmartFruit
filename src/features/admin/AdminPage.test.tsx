import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminPage } from './AdminPage';
import { getDirectory, getMarketplace, getConnections, updateMember } from './api';
vi.mock('./api',()=>({getDirectory:vi.fn(),getMarketplace:vi.fn(),getConnections:vi.fn(),updateMember:vi.fn(),closeListing:vi.fn()}));
const member={id:'member-1',role:'BUYER',full_name:'Người kiểm thử',display_name:'Thu mua kiểm thử',province:'Đồng Nai',is_suspended:false,created_at:'2026-10-15'};
beforeEach(()=>{vi.mocked(getDirectory).mockResolvedValue([{...member,role:'BUYER'}]);vi.mocked(getMarketplace).mockResolvedValue([]);vi.mocked(getConnections).mockResolvedValue([]);vi.mocked(updateMember).mockReset();});
function show(){render(<MemoryRouter initialEntries={['/admin/buyers']}><Routes><Route path="/admin/:section" element={<AdminPage/>}/></Routes></MemoryRouter>);}
describe('Admin persistent member controls',()=>{
  it('waits for the backend save and refreshes directory',async()=>{
    vi.mocked(updateMember).mockImplementation(async row=>{vi.mocked(getDirectory).mockResolvedValue([row]);return null;});
    show();fireEvent.click(await screen.findByRole('button',{name:'Chỉnh sửa'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Họ tên'}),{target:{value:'Tên đã sửa'}});
    fireEvent.click(screen.getByRole('button',{name:'Lưu thay đổi'}));
    await waitFor(()=>expect(updateMember).toHaveBeenCalledWith(expect.objectContaining({id:'member-1',full_name:'Tên đã sửa'})));
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu hồ sơ tài khoản.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('does not report success when backend denies the mutation',async()=>{
    vi.mocked(updateMember).mockRejectedValue({code:'42501',message:'Admin required'});
    show();fireEvent.click(await screen.findByRole('button',{name:'Chỉnh sửa'}));fireEvent.click(screen.getByRole('button',{name:'Lưu thay đổi'}));
    await screen.findByRole('alert');expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
