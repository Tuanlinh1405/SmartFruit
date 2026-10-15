import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { App } from './App';

const { auth }=vi.hoisted(()=>({auth:{status:'ready',profile:{role:'BUYER',full_name:'Tài khoản kiểm thử'}}}));
vi.mock('../features/auth/AuthProvider',()=>({useAuth:()=>auth,AuthProvider:({children}:{children:ReactNode})=>children}));
vi.mock('../lib/supabase',()=>({supabase:{auth:{signOut:vi.fn().mockResolvedValue({error:null})}}}));
vi.mock('../features/auth/LoginPage',()=>({LoginPage:()=> <h1>Đăng nhập</h1>}));
vi.mock('../features/buyer/BuyerDashboard',()=>({BuyerDashboard:()=> <h1>Dashboard Buyer thật</h1>}));
vi.mock('../features/admin/AdminPage',()=>({AdminPage:()=> <h1>Admin thật</h1>}));
vi.mock('../features/buyer-profile/BuyerProfilePage',()=>({BuyerProfilePage:()=> <h1>Hồ sơ thật</h1>}));
vi.mock('../features/buy-requests/RequestListPage',()=>({RequestListPage:()=> <h1>Nhu cầu thật</h1>}));
vi.mock('../features/buy-requests/RequestFormPage',()=>({RequestFormPage:()=> <h1>Form nhu cầu thật</h1>}));
vi.mock('../features/lots/LotsPage',()=>({LotsPage:()=> <h1>Matching thật</h1>}));
vi.mock('../features/trading/TradePage',()=>({TradePage:({view}:{view:string})=> <h1>Giao dịch {view}</h1>}));
// Keep the actual shared shell while avoiding business network calls in route/authorization tests.
vi.mock('../features/workspace/RoleWorkspace',async()=>{
  const {AppShell}=await import('../layouts/app-shell');
  return {RoleShell:()=> <AppShell role={auth.profile.role==='FARMER'?'FARMER':'CARRIER'} />,
    RoleWorkspace:({view='dashboard'}:{view?:string})=> <h1>Workspace {view}</h1>,RoleProfilePage:()=> <h1>Hồ sơ role thật</h1>};
});
beforeEach(()=>{auth.status='ready';auth.profile.role='BUYER';});
function show(path:string){window.history.replaceState({},'',path);render(<App/>);}

describe('Dev A shell connected to authenticated features',()=>{
  it('redirects the old Buyer root into the new dashboard without a role picker',async()=>{
    show('/buyer');expect(await screen.findByRole('heading',{name:'Dashboard Buyer thật'})).toBeVisible();
    expect(window.location.pathname).toBe('/buyer/dashboard');
    const nav=screen.getByRole('navigation',{name:'Điều hướng Thương lái'});
    expect(within(nav).getByRole('link',{name:'Tìm lô hàng'})).toHaveAttribute('href','/buyer/lots');
    expect(screen.queryByText(/Đổi khu vực skeleton/)).not.toBeInTheDocument();
  });
  it.each([['/buyer/chat?connectionId=c1','Giao dịch negotiations'],['/buyer/negotiations?connectionId=c1','Giao dịch negotiations'],
    ['/buyer/requests/new','Form nhu cầu thật'],['/buyer/lots','Matching thật']])('preserves feature and legacy route %s',async(path,title)=>{
    show(path);expect(await screen.findByRole('heading',{name:title})).toBeVisible();
    if(path.includes('connectionId'))expect(window.location.search).toBe('?connectionId=c1');
  });
  it.each([['FARMER','/farmer/matches','Workspace matches','Nhà vườn'],['CARRIER','/carrier/vehicles','Workspace vehicles','Nhà xe'],
    ['ADMIN','/admin/users','Admin thật','Quản trị']])('uses the same protected shell for %s',async(role,path,title,label)=>{
    auth.profile.role=role;show(path);expect(await screen.findByRole('heading',{name:title})).toBeVisible();
    expect(screen.getByRole('navigation',{name:`Điều hướng ${label}`})).toBeVisible();
  });
  it('does not grant another role by entering its UI path',async()=>{
    show('/admin/users');expect(await screen.findByRole('heading',{name:'Không có quyền truy cập'})).toBeVisible();
    expect(screen.queryByRole('heading',{name:'Admin thật'})).not.toBeInTheDocument();
  });
  it('requires login before showing the shell',async()=>{
    auth.status='signed-out';show('/buyer/lots');expect(await screen.findByRole('heading',{name:'Đăng nhập'})).toBeVisible();
    expect(screen.queryByRole('navigation',{name:'Điều hướng Thương lái'})).not.toBeInTheDocument();
  });
  it('keeps map work deferred and registration/OTP disabled',async()=>{
    show('/buyer/map');expect(await screen.findByText(/Bản đồ, tọa độ và khoảng cách được hoãn/)).toBeVisible();
    expect(screen.queryByText(/OTP minh họa/)).not.toBeInTheDocument();
  });
});
