// Read-only HTTP checks. Supply test credentials through the server-side environment.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(url!=='https://yyslykqpamnlqkvutrlm.supabase.co' || !key)throw new Error('LogStar test configuration required');
const input={direction:'buyer-to-lots',sourceId:process.env.MATCHING_REQUEST_ID,text:'',page:1,pageSize:20};
const sessions=[];
let stage='unauthenticated access';
async function invoke(name,body,token=''){
  return fetch(`${url}/functions/v1/${name}`,{method:'POST',signal:AbortSignal.timeout(65000),
    headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
}
try {
  assert.equal((await invoke('search-matches',input)).status,401);
  assert.equal((await invoke('process-embeddings',{limit:1})).status,401);
  assert.equal((await invoke('process-embeddings',{limit:1},'wrong-key')).status,401);
  console.log('PASS unauthenticated search and worker requests rejected');
  for(const role of ['BUYER','FARMER','CARRIER','ADMIN']) {
    stage=`${role} access isolation`;
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});sessions.push(client);
    const signed=await client.auth.signInWithPassword({email:process.env[`MATCHING_${role}_EMAIL`],password:process.env[`MATCHING_${role}_PASSWORD`]});
    assert.ok(!signed.error && signed.data.session);
    const token=signed.data.session.access_token;
    for(const [name,args] of [['embedding_worker_claim',{batch_size:1}],['embedding_worker_status',{}],
      ['embedding_worker_finish',{job_id:1,lease_attempt:1,encoded:null}],['embedding_query_cache',{text_hash:'a'.repeat(64)}]]) {
      assert.ok((await client.rpc(name,args)).error,`${role} must not access ${name}`);
    }
    assert.equal((await invoke('process-embeddings',{limit:1},token)).status,401);
    assert.equal((await invoke('search-matches',role==='BUYER'?{...input,sourceId:process.env.MATCHING_OTHER_REQUEST_ID}:input,token)).status,403);
    assert.equal((await invoke('search-matches',null,token)).status,400);
    console.log(`PASS ${role}: no queue/cache access, no cross-owner search, malformed payload rejected`);
  }
} catch {
  console.error(`FAIL ${stage}; inspect privately without logging credentials`);process.exitCode=1;
} finally {await Promise.allSettled(sessions.map(client=>client.auth.signOut({scope:'local'})));}
