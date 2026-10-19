import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { gradioBatchEncoder } from '../../../src/features/matching/embedding-gradio.ts';
import { processEmbeddingBatch } from '../../../src/features/matching/embedding-worker.ts';

const server=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {auth:{persistSession:false,autoRefreshToken:false}});
async function authorized(actual: string) {
  const expected=Deno.env.get('EMBEDDING_WORKER_TOKEN') ?? '';
  if (expected.length<32 || actual.length>256) return false;
  const hash=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [a,b]=await Promise.all([hash(actual),hash(`Bearer ${expected}`)]);
  let diff=0;for(let i=0;i<a.length;i++) diff|=a[i]^b[i];return diff===0;
}
Deno.serve(async request=>{
  const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST') return json({error:'Method not allowed'},405);
  if(!await authorized(request.headers.get('authorization') ?? '')) return json({error:'Unauthorized'},401);
  try {
    const input=await request.json();
    const limit=input.limit ?? 16;
    if(!Number.isInteger(limit) || limit<1 || limit>16) return json({error:'Invalid batch size'},400);
    const encode=gradioBatchEncoder(Deno.env.get('EMBEDDING_SERVICE_URL')!,Deno.env.get('EMBEDDING_SERVICE_TOKEN')!,60000);
    const rpc=async(name:string,args:Record<string,unknown>={})=>{
      const {data,error}=await server.rpc(name,args);if(error)throw new Error('Queue unavailable');return data;
    };
    const result=await processEmbeddingBatch({
      claim:limit=>rpc('embedding_worker_claim',{batch_size:limit}),
      finish:(job,vector)=>rpc('embedding_worker_finish',{job_id:job.job_id,lease_attempt:job.attempts,
        encoded:vector?JSON.stringify(vector):null}),
    },encode,limit);
    return json(result);
  } catch { return json({error:'Embedding worker temporarily unavailable'},503); }
});
