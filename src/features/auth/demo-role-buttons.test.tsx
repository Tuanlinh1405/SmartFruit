import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {expect,test,vi} from 'vitest';
import {DemoRoleButtons} from './demo-role-buttons';
function show(login=vi.fn(async()=>{})) {render(<MemoryRouter><Routes><Route path="/" element={<DemoRoleButtons login={login}/>}/><Route path="/role-home" element={<p>Role home</p>}/></Routes></MemoryRouter>);return login;}
test('provides four demo roles and routes only after sign-in succeeds',async()=>{
 const login=show();expect(screen.getAllByRole('button')).toHaveLength(4);
 fireEvent.click(screen.getByRole('button',{name:'Demo Admin'}));
 await screen.findByText('Role home');expect(login).toHaveBeenCalledWith('ADMIN');
});
test('blocks concurrent role requests while authentication is pending',async()=>{
 let resolve!:()=>void;const login=vi.fn(()=>new Promise<void>(r=>{resolve=r;}));show(login);
 fireEvent.click(screen.getByRole('button',{name:'Demo Nhà vườn'}));
 expect(screen.getByRole('button',{name:'Demo Thu mua'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Demo Thu mua'}));expect(login).toHaveBeenCalledTimes(1);
 resolve();await screen.findByText('Role home');
});
test('keeps the user on the page and permits retry after a failed sign-in',async()=>{
 show(vi.fn(async()=>{throw Error('backend unavailable');}));fireEvent.click(screen.getByRole('button',{name:'Demo Vận tải'}));
 await screen.findByRole('alert');await waitFor(()=>expect(screen.getByRole('button',{name:'Demo Vận tải'})).toBeEnabled());
 expect(screen.queryByText('Role home')).not.toBeInTheDocument();
});
