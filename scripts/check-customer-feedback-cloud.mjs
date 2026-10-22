// Read-only readiness check. Never prints keys, tokens or full SDK errors.
import {createClient} from '@supabase/supabase-js';
import {readFile} from 'node:fs/promises';
try{process.loadEnvFile('.env.local');}catch{}
const url=process.env.VITE_SUPABASE_URL;
if(url!=='https://yyslykqpamnlqkvutrlm.supabase.co')throw Error('Unexpected project');
const key=process.env.SUPABASE_SECRET_KEY;
if(key){
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  for(const table of ['notifications','transport_requests']){
    const r=await admin.from(table).select('id').limit(1);console.log(JSON.stringify({table,ready:r.status>=200&&r.status<300,code:r.error?.code??null,status:r.status}));
  }
}
const accounts=JSON.parse(await readFile('tmp/handover-accounts.json','utf8'));
for(const name of ['farmer3','buyer3','carrier3']){
  const a=accounts.find(a=>a.name===name);if(!a){console.log(`${name}: missing local credential`);continue;}
  const client=createClient(url,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const r=await client.auth.signInWithPassword({email:a.email,password:a.password});console.log(JSON.stringify({account:name,login:!r.error,code:r.error?.code??null}));
    if(!r.error){const s=await client.rpc('my_review_summary');if(name!=='carrier3')console.log(JSON.stringify({account:name,summaryReady:!s.error,code:s.error?.code??null}));}
  }finally{await client.auth.signOut({scope:'local'});}
}
