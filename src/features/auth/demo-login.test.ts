import {expect,test,vi} from 'vitest';
import {createDemoLoginHandler,demoAccounts} from '../../../supabase/functions/demo-login/index';
import {signInDemo} from './demo-login';
import type {SupabaseClient} from '@supabase/supabase-js';
const request=(body:unknown,origin='https://onlmallfruit.vercel.app')=>new Request('https://example.test/demo-login',{
  method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
function setup(overrides:Record<string,unknown>={}) {
 const profile=vi.fn(async(a:{id:string})=>({id:a.id,role:'BUYER',is_suspended:false}));
 const mint=vi.fn(async(a:{id:string})=>({access_token:'access',refresh_token:'refresh',user:{id:a.id}}));
 return {profile,mint,handle:createDemoLoginHandler({enabled:true,profile,mint,...overrides})};
}
test.each(Object.keys(demoAccounts))('mints a session for exactly the allowlisted %s identity',async role=>{
 const s=setup({profile:async(a:{id:string})=>({id:a.id,role,is_suspended:false})});
 const response=await s.handle(request({role}));expect(response.status).toBe(200);
 expect(await response.json()).toEqual({access_token:'access',refresh_token:'refresh',role});
 expect(s.mint).toHaveBeenCalledWith(demoAccounts[role as keyof typeof demoAccounts]);
 expect(response.headers.get('Cache-Control')).toBe('no-store');
});
test.each([{role:'ADMIN',email:'someone@example.com'},{role:'__proto__'},{role:'OWNER'},null])('rejects arbitrary identity or role input: %j',async body=>{
 const s=setup();expect((await s.handle(request(body))).status).toBe(400);expect(s.mint).not.toHaveBeenCalled();
});
test('rejects suspended and mismatched profiles without issuing sessions',async()=>{
 for(const profile of [async()=>({id:demoAccounts.BUYER.id,role:'ADMIN',is_suspended:false}),async()=>({id:demoAccounts.BUYER.id,role:'BUYER',is_suspended:true})]) {
  const s=setup({profile});expect((await s.handle(request({role:'BUYER'}))).status).toBe(403);expect(s.mint).not.toHaveBeenCalled();
 }
});
test('can disable demo and rejects foreign origins before touching auth',async()=>{
 const off=setup({enabled:false});expect((await off.handle(request({role:'BUYER'}))).status).toBe(503);expect(off.profile).not.toHaveBeenCalled();
 const s=setup();expect((await s.handle(request({role:'BUYER'},'https://foreign.example'))).status).toBe(403);expect(s.profile).not.toHaveBeenCalled();
});
test('preflight permits browser headers; errors never expose auth details',async()=>{
 const s=setup({mint:async()=>{throw Error('private credential');}});
 const pre=await s.handle(new Request('https://example.test',{method:'OPTIONS',headers:{origin:'https://onlmallfruit.vercel.app'}}));
 expect(pre.status).toBe(204);expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('apikey');
 const failed=await s.handle(request({role:'BUYER'}));expect(failed.status).toBe(503);expect(await failed.text()).not.toContain('private credential');
});
test('rejects a session for a different account',async()=>{
 const s=setup({mint:async()=>({access_token:'wrong',refresh_token:'wrong',user:{id:'other'}})});
 expect((await s.handle(request({role:'BUYER'}))).status).toBe(503);
});
test('browser sends only a role and applies tokens through the normal SDK session flow',async()=>{
 const invoke=vi.fn(async()=>({data:{role:'BUYER',access_token:'access',refresh_token:'refresh'},error:null}));
 const setSession=vi.fn(async()=>({error:null}));
 await signInDemo('BUYER',{functions:{invoke},auth:{setSession}} as unknown as SupabaseClient);
 expect(invoke).toHaveBeenCalledWith('demo-login',expect.objectContaining({body:{role:'BUYER'}}));
 expect(setSession).toHaveBeenCalledWith({access_token:'access',refresh_token:'refresh'});
});
test('failed backend responses cannot replace the current browser session',async()=>{
 const setSession=vi.fn();const invoke=vi.fn(async()=>({data:{role:'ADMIN'},error:null}));
 await expect(signInDemo('BUYER',{functions:{invoke},auth:{setSession}} as unknown as SupabaseClient)).rejects.toThrow();
 expect(setSession).not.toHaveBeenCalled();
});
