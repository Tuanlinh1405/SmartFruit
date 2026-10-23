// Disposable, unreferenced test image only; never changes a business profile.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const url=process.env.VITE_SUPABASE_URL;assert.equal(url,'https://yyslykqpamnlqkvutrlm.supabase.co');
const accounts=JSON.parse(await readFile('tmp/handover-accounts.json','utf8'));
const make=()=>createClient(url,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=make(),other=make(),anonymous=make();let path;
try{
 for(const[client,name]of[[owner,'buyer3'],[other,'farmer3']]){const a=accounts.find(a=>a.name===name);const r=await client.auth.signInWithPassword({email:a.email,password:a.password});assert.ok(!r.error,`Login ${name} failed`);}
 const user=(await owner.auth.getUser()).data.user;assert.ok(user);
 path=`${user.id}/feedback23-disposable-probe-${randomUUID()}.png`;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVYkAAAAASUVORK5CYII=','base64');
 assert.ok(!(await owner.storage.from('buyer-evidence').upload(path,png,{contentType:'image/png',upsert:false})).error,'Owner upload failed');
 const signed=await owner.storage.from('buyer-evidence').createSignedUrl(path,60);assert.ok(!signed.error,'Owner cannot sign image');assert.equal((await fetch(signed.data.signedUrl)).status,200);
 assert.ok((await other.storage.from('buyer-evidence').createSignedUrl(path,60)).error,'Another user can access private evidence');
 assert.ok((await anonymous.storage.from('buyer-evidence').download(path)).error,'Anonymous can access private evidence');
 const denied=await owner.rpc('save_buyer_business_profile',{details:{},evidence:[],attested:false});assert.equal(denied.error?.code,'23514');
 console.log(JSON.stringify({upload:true,ownerDownload:true,otherUserBlocked:true,anonymousBlocked:true,unattestedRpcBlocked:true}));
}finally{
 if(path){const cleanup=await owner.storage.from('buyer-evidence').remove([path]);assert.ok(!cleanup.error,'Disposable image cleanup failed');console.log(JSON.stringify({disposableImageRemoved:true}));}
 await Promise.all([owner.auth.signOut({scope:'local'}),other.auth.signOut({scope:'local'})]);
}
