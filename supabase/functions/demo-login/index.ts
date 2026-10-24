// Public demo access was explicitly enabled by the project owner for these four seeded accounts.
// Set PUBLIC_DEMO_ENABLED=false in Edge Function secrets to disable all demo sign-ins.
export const demoAccounts = {
  FARMER: {id:'a940ffe3-26fd-4fb7-bacc-8adc80f3d261',email:'farmer1@logstar.test'},
  BUYER: {id:'99d27521-7c5c-436a-b34b-d92551fce935',email:'buyer1@logstar.test'},
  CARRIER: {id:'d8521b8f-c5f6-419b-a313-e5cb7868ca8f',email:'carrier1@logstar.test'},
  ADMIN: {id:'61b87c74-23bb-479d-a32b-7c69f164ad04',email:'admin1@logstar.test'},
} as const;
type DemoRole = keyof typeof demoAccounts;
type Account = {id:string;email:string};
type DemoSession = {access_token:string;refresh_token:string;user:{id:string}};
type Dependencies = {
  enabled:boolean;
  profile:(account:Account)=>Promise<{id:string;role:string|null;is_suspended:boolean}>;
  mint:(account:Account)=>Promise<DemoSession>;
};
const origins = new Set(['https://onlmallfruit.vercel.app', 'https://tuanlinh1405.github.io',
  ...['localhost','127.0.0.1'].flatMap(host=>[5173,4173,4175,4181].map(port=>`http://${host}:${port}`))]);

export function createDemoLoginHandler(deps:Dependencies) {
  return async (request:Request):Promise<Response> => {
    const origin=request.headers.get('origin');
    const headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin'};
    if(origin && origins.has(origin)) headers['Access-Control-Allow-Origin']=origin;
    const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
    if(origin && !origins.has(origin))return json({error:'Origin not allowed'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'}});
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(!deps.enabled)return json({error:'Đăng nhập demo đang tắt.'},503);
    if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required'},415);
    let role:DemoRole;
    try {
      const raw=await request.text();if(raw.length>128)throw new Error('Too large');
      const input=JSON.parse(raw);
      if(!input || Object.keys(input).length!==1 || typeof input.role!=='string' || !Object.hasOwn(demoAccounts,input.role))throw new Error('Invalid role');
      role=input.role as DemoRole;
    } catch {return json({error:'Vai trò demo không hợp lệ.'},400);}
    try {
      const account=demoAccounts[role];
      const profile=await deps.profile(account);
      if(profile.id!==account.id || profile.role!==role || profile.is_suspended)return json({error:'Tài khoản demo chưa sẵn sàng.'},403);
      const session=await deps.mint(account);
      if(session.user.id!==account.id || !session.access_token || !session.refresh_token)throw new Error('Session mismatch');
      return json({access_token:session.access_token,refresh_token:session.refresh_token,role});
    } catch {return json({error:'Chưa thể vào tài khoản demo. Vui lòng thử lại.'},503);}
  };
}

if(typeof Deno!=='undefined') {
  const {createClient}=await import('npm:@supabase/supabase-js@2.117.3');
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const server=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
  Deno.serve(createDemoLoginHandler({
    enabled:Deno.env.get('PUBLIC_DEMO_ENABLED')!=='false',
    profile:async account=>{
      const [profile,user]=await Promise.all([
        server.from('profiles').select('id,role,is_suspended').eq('id',account.id).single(),
        server.auth.admin.getUserById(account.id)]);
      if(profile.error || user.error || user.data.user.email!==account.email)throw new Error('Account unavailable');
      return profile.data;
    },
    mint:async account=>{
      const link=await server.auth.admin.generateLink({type:'magiclink',email:account.email});
      if(link.error || link.data.user.id!==account.id)throw new Error('Link unavailable');
      // A fresh client per invocation avoids sharing a demo user's auth state across requests.
      const auth=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,options);
      const verified=await auth.auth.verifyOtp({type:'magiclink',token_hash:link.data.properties.hashed_token});
      if(verified.error || !verified.data.session)throw new Error('Session unavailable');
      return verified.data.session;
    },
  }));
}
