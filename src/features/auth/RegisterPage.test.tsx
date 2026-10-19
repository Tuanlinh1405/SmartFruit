import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';
import { registrationCredentials } from './registration';
const { signUp }=vi.hoisted(()=>({signUp:vi.fn()}));
vi.mock('./AuthProvider',()=>({useAuth:()=>({status:'signed-out',profile:null,signUp})}));
beforeEach(()=>{signUp.mockReset();});
function show(){render(<MemoryRouter initialEntries={['/register']}><Routes><Route path="/register" element={<RegisterPage/>}/><Route path="/role-home" element={<h1>Role home</h1>}/></Routes></MemoryRouter>);}
function fill(){fireEvent.change(screen.getByLabelText(/^Họ và tên/),{target:{value:' Nhà vườn Test '}});fireEvent.change(screen.getByLabelText(/^Email/),{target:{value:'User@Example.com'}});fireEvent.change(screen.getByLabelText(/^Mật khẩu/),{target:{value:'LongPassword123!'}});fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu/),{target:{value:'LongPassword123!'}});}
test('shows three ordinary roles and links to login',()=>{show();expect(screen.getAllByRole('option')).toHaveLength(3);expect(screen.queryByRole('option',{name:/Admin/i})).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Đăng nhập'})).toHaveAttribute('href','/login');});
test('normalizes identity, preserves password and rejects admin/prototype roles',()=>{
 const input={fullName:' Test ',email:' USER@example.com ',password:' Password123 ',confirmation:' Password123 ',role:'BUYER'};
 expect(registrationCredentials(input)).toEqual({email:'user@example.com',password:' Password123 ',options:{data:{full_name:'Test',registration_role:'BUYER'}}});
 for(const role of ['ADMIN','__proto__','toString',''])expect(()=>registrationCredentials({...input,role})).toThrow('Chọn vai trò');
});
test('invalid email, password and mismatched confirmation stop before API',()=>{
 show();fill();fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu/),{target:{value:'different'}});fireEvent.click(screen.getByRole('button',{name:'Tạo tài khoản'}));expect(screen.getByRole('alert')).toHaveTextContent('chưa khớp');expect(signUp).not.toHaveBeenCalled();
 const valid={fullName:'Test',email:'x@example.com',password:'Password123',confirmation:'Password123',role:'FARMER'};
 for(const patch of [{email:'invalid'},{fullName:' '},{password:'short',confirmation:'short'}])expect(()=>registrationCredentials({...valid,...patch})).toThrow();
});
test('confirmation response shows neutral email instructions and clears password fields',async()=>{signUp.mockResolvedValue({needsEmailConfirmation:true});show();fill();fireEvent.click(screen.getByRole('button',{name:'Tạo tài khoản'}));expect(await screen.findByRole('heading',{name:'Kiểm tra email để tiếp tục'})).toBeVisible();expect(screen.queryByLabelText(/^Mật khẩu/)).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Đến trang đăng nhập'})).toHaveAttribute('href','/login');});
test('immediate session navigates into authenticated role resolution',async()=>{signUp.mockResolvedValue({needsEmailConfirmation:false});show();fill();fireEvent.click(screen.getByRole('button',{name:'Tạo tài khoản'}));expect(await screen.findByRole('heading',{name:'Role home'})).toBeVisible();});
test('server rejection preserves form and allows retry',async()=>{signUp.mockRejectedValueOnce({code:'signup_disabled'}).mockResolvedValueOnce({needsEmailConfirmation:true});show();fill();fireEvent.click(screen.getByRole('button',{name:'Tạo tài khoản'}));expect(await screen.findByRole('alert')).toHaveTextContent('tạm đóng đăng ký');expect(screen.getByLabelText(/^Email/)).toHaveValue('User@Example.com');fireEvent.click(screen.getByRole('button',{name:'Tạo tài khoản'}));expect(await screen.findByRole('heading',{name:'Kiểm tra email để tiếp tục'})).toBeVisible();expect(signUp).toHaveBeenCalledTimes(2);});
test('double submit cannot create duplicate requests',async()=>{let resolve!:(value:{needsEmailConfirmation:boolean})=>void;signUp.mockImplementation(()=>new Promise(r=>{resolve=r;}));show();fill();const form=screen.getByRole('form',{name:'Đăng ký tài khoản'});fireEvent.submit(form);fireEvent.submit(form);expect(signUp).toHaveBeenCalledTimes(1);resolve({needsEmailConfirmation:true});await waitFor(()=>expect(screen.getByRole('heading',{name:'Kiểm tra email để tiếp tục'})).toBeVisible());});
