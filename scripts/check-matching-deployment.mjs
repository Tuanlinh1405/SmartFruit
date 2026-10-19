// Read-only rollout check: Auth sign-in + search. No fixtures, migrations or vector writes.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const required = name => {
  const value=process.env[name];
  if(!value) throw new Error(`Missing ${name}`);
  return value;
};
const url=required('VITE_SUPABASE_URL');
const key=required('VITE_SUPABASE_PUBLISHABLE_KEY');
if(url!=='https://yyslykqpamnlqkvutrlm.supabase.co') throw new Error('Rollout check is restricted to LogStar.');

let stage='configuration';
try {
  for(const [role,direction,sourceName] of [
    ['BUYER','buyer-to-lots','MATCHING_REQUEST_ID'],
    ['FARMER','farmer-to-requests','MATCHING_LOT_ID'],
  ]) {
    stage=`${role} authentication`;
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    try {
      const signed=await client.auth.signInWithPassword({email:required(`MATCHING_${role}_EMAIL`),password:required(`MATCHING_${role}_PASSWORD`)});
      assert.ok(!signed.error && signed.data.session,'Authentication failed');
      stage=`${role} matching`;
      const {data,error}=await client.functions.invoke('search-matches',{body:{
        direction,sourceId:required(sourceName),text:'',page:1,pageSize:20,
      }});
      assert.ok(!error && data?.meta,'Search failed');
      assert.equal(data.meta.mode,'hybrid');
      assert.equal(data.meta.rankingScope,'vector_top20');
      assert.equal(data.meta.modelVersion,'multilingual-e5-base-v1');
      assert.ok(data.meta.candidateCount<=20);
      assert.ok(data.items.length>0 && data.items.length<=20,'Seed an eligible vector-backed pair before rollout');
      assert.ok(data.items.every(item=>Number.isFinite(item.cosineSimilarity)));
      console.log(`PASS ${role}: hybrid/vector_top20; ${data.items.length} results`);
    } finally { await client.auth.signOut({scope:'local'}); }
  }
  console.log('PASS deployment acceptance; enable hybrid only in the target frontend environment.');
} catch {
  // Never print SDK exceptions, JWTs, credentials, payloads or account identifiers.
  console.error(`FAIL ${stage}; inspect host/Edge logs privately. Hybrid must remain disabled.`);
  process.exitCode=1;
}
