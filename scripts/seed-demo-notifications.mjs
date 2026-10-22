// Backfill a few clearly labeled demo notices for farmer3 only.
// Each notice points to verified demo data; reruns preserve read state.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {scoreBusiness} from '../src/features/matching/core.ts';

const apply=process.argv.includes('--apply');
try{process.loadEnvFile('.env.local');}catch{}
const url=process.env.VITE_SUPABASE_URL;
assert.equal(url,'https://yyslykqpamnlqkvutrlm.supabase.co');
assert.ok(process.env.SUPABASE_SECRET_KEY,'Backend key required');
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const check=r=>{if(r.error)throw Error(`Request failed (${r.error.code||r.status||'network'}).`);return r.data;};
let stage='demo identity';
try{
  const accounts=JSON.parse(await readFile('tmp/handover-accounts.json','utf8'));
  const handover=JSON.parse(await readFile('tmp/handover-data-manifest.json','utf8'));
  const trades=JSON.parse(await readFile('tmp/customer-reviews-manifest.json','utf8'));
  assert.equal(trades.project,url);assert.equal(handover.project,url);
  const users={};
  for(const [name,role] of [['farmer3','FARMER'],['buyer3','BUYER']]){
    const account=accounts.find(a=>a.name===name);assert.equal(account?.email,`${name}@logstar.test`);
    const id=account.id??handover.users[name];assert.ok(id);
    const identity=check(await admin.auth.admin.getUserById(id));assert.equal(identity.user.email,account.email);
    const p=check(await admin.from('profiles').select('id,role,is_suspended').eq('id',id).single());
    assert.equal(p.role,role);assert.equal(p.is_suspended,false);assert.equal(trades.users[name],id);assert.equal(handover.users[name],id);users[name]=id;
  }
  const rows=[];
  const add=(event_key,kind,title,path)=>rows.push({recipient_id:users.farmer3,event_key,kind,title,path});
  stage='review demo sources';
  for(const trade of trades.trades){
    const c=check(await admin.from('trade_connections').select('id,lot_id,buyer_id,farmer_id,status').eq('id',trade.connection).single());
    assert.equal(c.farmer_id,users.farmer3);assert.equal(c.buyer_id,users.buyer3);assert.equal(c.lot_id,trade.lot);
    const lot=check(await admin.from('lots').select('title').eq('id',trade.lot).single());assert.ok(lot.title.startsWith('[MẪU ĐÁNH GIÁ '));
    const review=check(await admin.from('trade_reviews').select('id,rating').eq('agreement_id',trade.agreement).eq('reviewer_id',users.buyer3).eq('target_id',users.farmer3).single());
    add(`demo-review:${review.id}`,'trade_reviews',`[Mẫu] Buyer3 đã đánh giá bạn ${review.rating}/5 sao`,'/farmer/reviews');
  }
  const completed=trades.trades[0];
  const agreement=check(await admin.from('trade_agreements').select('status,connection_id').eq('id',completed.agreement).single());
  assert.equal(agreement.status,'COMPLETED');assert.equal(agreement.connection_id,completed.connection);
  add(`demo-completed:${completed.agreement}`,'trade_agreements','[Mẫu] Giao dịch Ri6 với Buyer3 đã hoàn tất',`/farmer/negotiations?connectionId=${completed.connection}`);
  stage='matching demo sources';
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  for(const ids of Object.values(handover.ids)){
    const lot=check(await admin.from('lots').select('*').eq('id',ids.lot).single());
    const request=check(await admin.from('buy_requests').select('*').eq('id',ids.request).single());
    assert.equal(lot.farmer_id,users.farmer3);assert.equal(request.buyer_id,users.buyer3);
    if(lot.status!=='PUBLISHED'||request.status!=='OPEN'||lot.harvest_end<today||request.required_end<today)continue;
    const fit=scoreBusiness(lot,request);if(!fit.eligible||fit.priceFit!==1)continue;
    add(`demo-matching:${request.id}`,'matching',`[Mẫu] Buyer3 đang có nhu cầu phù hợp: ${request.title}`,`/farmer/matches?lotId=${lot.id}`);
  }
  stage='notification schema';
  const ready=await admin.from('notifications').select('id').limit(1);
  if(!apply){
    console.log(JSON.stringify({mode:'DRY_RUN',writes:false,account:'farmer3@logstar.test',notifications:rows.map(({title,path})=>({title,path})),schemaReady:ready.status>=200&&ready.status<300,blocker:ready.error?.code??null},null,2));
  }else{
    check(ready);
    stage='demo notification insert';
    check(await admin.from('notifications').upsert(rows,{onConflict:'recipient_id,event_key',ignoreDuplicates:true}));
    const saved=check(await admin.from('notifications').select('event_key,read_at').eq('recipient_id',users.farmer3).in('event_key',rows.map(r=>r.event_key)));
    assert.equal(saved.length,rows.length);
    console.log(JSON.stringify({mode:'APPLIED',account:'farmer3@logstar.test',sampleNotifications:saved.length,unread:saved.filter(n=>!n.read_at).length,rerun:'Existing notices and their read state are preserved'}));
  }
}catch{console.error(`FAIL ${stage}; inspect configuration privately. No credentials or server payloads printed.`);process.exitCode=1;}
