import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { RequestFormPage } from './RequestFormPage';

vi.mock('../auth/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'buyer'}}})}));
vi.mock('../catalog/api',()=>({loadCatalog:async()=>({types:[{id:'durian',name:'Sầu riêng',active:true}],varieties:[]})}));
vi.mock('./api',()=>({createRequest:vi.fn(async()=>({})),getMyRequest:vi.fn(),updateRequest:vi.fn()}));
import { createRequest } from './api';

test('one product name field submits to the real request adapter without choosing type or variety',async()=>{
  render(<MemoryRouter><RequestFormPage/></MemoryRouter>);
  const name=await screen.findByRole('textbox',{name:'Tên nông sản'});
  expect(screen.queryByRole('combobox',{name:'Loại nông sản'})).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox',{name:'Giống'})).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox',{name:'Tên nhu cầu'})).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox',{name:'Phân loại'})).not.toBeInTheDocument();
  await userEvent.type(name,'Sầu riêng Ri6');
  await userEvent.type(screen.getByRole('spinbutton',{name:'Khối lượng tổng'}),'10');
  await userEvent.type(screen.getByRole('spinbutton',{name:'Giá tối thiểu'}),'60000');
  await userEvent.type(screen.getByRole('spinbutton',{name:'Giá tối đa'}),'70000');
  // Native date inputs do not implement typing consistently in jsdom.
  fireEvent.change(screen.getByLabelText(/^Từ ngày/),{target:{value:'2026-10-20'}});
  fireEvent.change(screen.getByLabelText(/^Đến ngày/),{target:{value:'2026-10-30'}});
  await userEvent.click(screen.getByRole('button',{name:'Lưu nháp'}));
  await waitFor(()=>expect(createRequest).toHaveBeenCalledWith(expect.any(String),'buyer',expect.objectContaining({
    title:'Sầu riêng Ri6',fruit_type_id:'durian',variety_id:null,target_quantity_kg:10000,status:'DRAFT',
  })));
});
