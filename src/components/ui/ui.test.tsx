import { useState } from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Button } from './button';
import { TextField, Select, TextArea, NumberWithUnit, DateInput, RadioChips, FileUpload, validateFile } from './fields';
import { Badge } from './badge';
import { Tabs } from './tabs';
import { Modal, Drawer, ConfirmDialog } from './dialog';
import { ToastProvider, useToast } from './toast';
test('loading button blocks duplicate clicks',async()=>{
  const click=vi.fn(); render(<Button loading onClick={click}>Lưu</Button>); const button=screen.getByRole('button');
  expect(button).toBeDisabled(); expect(button).toHaveAttribute('aria-busy','true'); await userEvent.click(button); expect(click).not.toHaveBeenCalled();
});
test('controls have labels, descriptions and error associations',()=>{
  render(<><TextField label="Tên" required error="Nhập tên" hint="Gợi ý" /><Select label="Chọn"><option>A</option></Select><TextArea label="Ghi chú" /><NumberWithUnit label="Lượng" unit="kg" /><DateInput label="Ngày" /></>);
  expect(screen.getByLabelText(/Tên/)).toBeRequired(); expect(screen.getByLabelText(/Tên/)).toHaveAttribute('aria-invalid','true');
  expect(screen.getByLabelText(/Tên/)).toHaveAccessibleDescription('Gợi ý Nhập tên'); expect(screen.getByLabelText('Lượng')).toHaveAccessibleDescription('kg');
  expect(screen.getByLabelText('Chọn')).toBeVisible(); expect(screen.getByLabelText('Ghi chú')).toBeVisible(); expect(screen.getByLabelText('Ngày')).toHaveAttribute('type','date');
});
test('radio chips change controlled value',async()=>{
  function Example(){const[value,setValue]=useState('a');return <RadioChips label="Gói" value={value} onChange={setValue} options={[{value:'a',label:'Thùng'},{value:'b',label:'Bao'}]} />;}
  render(<Example/>); await userEvent.click(screen.getByLabelText('Bao')); expect(screen.getByLabelText('Bao')).toBeChecked(); expect(screen.getByLabelText('Thùng')).not.toBeChecked();
});
test('file validation covers MIME and size boundaries',()=>{
  const file=new File(['1234'],'a.png',{type:'image/png'});
  expect(validateFile(file,['image/png'],4)).toBeUndefined(); expect(validateFile(file,['image/png'],3)).toMatch('vượt quá'); expect(validateFile(file,['image/jpeg'],4)).toMatch('Định dạng');
});
test('file selector forwards valid file and clears invalid choice',()=>{
  const callback=vi.fn();render(<FileUpload label="Ảnh" onFile={callback}/>);const input=screen.getByLabelText('Ảnh');const file=new File(['image'],'a.png',{type:'image/png'});
  fireEvent.change(input,{target:{files:[file]}});expect(callback).toHaveBeenLastCalledWith(file);
  fireEvent.change(input,{target:{files:[new File(['x'],'x.txt',{type:'text/plain'})]}});expect(callback).toHaveBeenLastCalledWith(null);expect(screen.getByRole('alert')).toHaveTextContent('Định dạng');
});
test('demo statuses remain explicit',()=>{render(<><Badge status="CONFIRMED_DEMO"/><Badge status="DELIVERED_DEMO"/></>);expect(screen.getAllByText(/Minh họa/)).toHaveLength(2);});
test('tabs support arrows, Home and End',async()=>{
  function Example(){const[value,setValue]=useState('a');return <Tabs label="Mẫu" value={value} onChange={setValue} items={[{value:'a',label:'Một',content:'Nội dung một'},{value:'b',label:'Hai',content:'Nội dung hai'}]}/>;}
  render(<Example/>);screen.getByRole('tab',{name:'Một'}).focus();await userEvent.keyboard('{ArrowRight}');expect(screen.getByRole('tab',{name:'Hai'})).toHaveFocus();expect(screen.getByRole('tabpanel')).toHaveTextContent('Nội dung hai');await userEvent.keyboard('{Home}');expect(screen.getByRole('tab',{name:'Một'})).toHaveFocus();await userEvent.keyboard('{End}');expect(screen.getByRole('tab',{name:'Hai'})).toHaveFocus();
});
test('modal traps focus and restores trigger on Escape',async()=>{
  render(<Modal title="Mẫu" description="Mô tả" trigger={<Button>Mở</Button>}><TextField label="Trong modal"/></Modal>);
  await userEvent.click(screen.getByRole('button',{name:'Mở'}));const dialog=screen.getByRole('dialog');expect(dialog).toHaveAccessibleName('Mẫu');expect(dialog).toContainElement(document.activeElement as HTMLElement);
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}');expect(dialog).toContainElement(document.activeElement as HTMLElement);await userEvent.keyboard('{Escape}');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Mở'})).toHaveFocus();
});
test('drawer closes through close button',async()=>{
  render(<Drawer title="Menu" description="Điều hướng" trigger={<Button>Mở menu</Button>}>Nội dung</Drawer>);await userEvent.click(screen.getByRole('button',{name:'Mở menu'}));await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Đóng'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('confirm invokes callback only when confirmed',async()=>{
  const confirm=vi.fn();render(<ConfirmDialog title="Chốt mẫu" description="Local" trigger={<Button>Mở xác nhận</Button>} onConfirm={confirm}/>);await userEvent.click(screen.getByRole('button',{name:'Mở xác nhận'}));await userEvent.click(screen.getByRole('button',{name:'Hủy'}));expect(confirm).not.toHaveBeenCalled();await userEvent.click(screen.getByRole('button',{name:'Mở xác nhận'}));await userEvent.click(screen.getByRole('button',{name:'Xác nhận minh họa'}));expect(confirm).toHaveBeenCalledOnce();
});
test('toast is announced and dismissible',async()=>{
  function Example(){const toast=useToast();return <Button onClick={()=>toast('Thành công mẫu')}>Thông báo</Button>;}
  render(<ToastProvider><Example/></ToastProvider>);await userEvent.click(screen.getByRole('button',{name:'Thông báo'}));expect(screen.getByRole('status')).toHaveTextContent('Thành công mẫu');await userEvent.click(screen.getByRole('button',{name:'Đóng thông báo'}));await waitFor(()=>expect(screen.queryByRole('status')).not.toBeInTheDocument());
});
