// Network orchestration only: all model inference runs on the hosted Space.
// node --env-file=.env.admin.local --env-file=tmp/embedding-worker.env scripts/run-embedding-worker.mjs --drain
import {createClient} from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY;
if(url!=='https://yyslykqpamnlqkvutrlm.supabase.co' || !secret) throw new Error('LogStar backend configuration required');
const backend=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
async function status() {
  const {data,error}=await backend.rpc('embedding_worker_status');
  if(error)throw new Error('Queue status unavailable');return data;
}
try {
  if(!process.argv.includes('--status')) {
    const token=process.env.EMBEDDING_WORKER_TOKEN;
    if(!token || token.length<32)throw new Error('Worker credential required');
    const max=process.argv.includes('--drain')?10:1;
    for(let batch=1;batch<=max;batch++) {
      const response=await fetch(`${url}/functions/v1/process-embeddings`,{
        method:'POST',signal:AbortSignal.timeout(95000),redirect:'error',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({limit:16}),
      });
      if(!response.ok)throw new Error(`Worker HTTP ${response.status}`);
      const result=await response.json();console.log(JSON.stringify({batch,...result}));
      if(result.outcomes?.PENDING || result.outcomes?.FAILED) throw new Error('Inference unavailable; queue will retry later');
      if(!result.claimed)break;
    }
  }
  const report=await status();console.log(JSON.stringify(report));
  if(process.argv.includes('--drain') && report.missing) process.exitCode=2;
} catch(error) {
  console.error(error instanceof Error?error.message:'Worker unavailable');process.exitCode=1;
}
