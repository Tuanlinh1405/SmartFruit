// Uses the two authorized demo identities and normal participant RPCs only.
// Dry run by default. No password reset, no existing trade completion.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const apply=process.argv.includes('--apply');
const file='tmp/customer-reviews-manifest.json';
const comments=[
  ['Đánh giá mẫu: Nhà vườn chuẩn bị hàng đúng lịch, trao đổi rõ ràng.','Đánh giá mẫu: Bên thu mua phản hồi nhanh, thống nhất lịch nhận hàng rõ ràng.'],
  ['Đánh giá mẫu: Phân loại hàng cẩn thận, phối hợp cân và giao hàng thuận tiện.','Đánh giá mẫu: Kiểm tra và xác nhận khối lượng rõ ràng, hợp tác tốt.'],
  ['Đánh giá mẫu: Thông tin lô hàng đầy đủ, cần xác nhận giờ lấy sớm hơn.','Đánh giá mẫu: Trao đổi lịch nhận hàng chủ động, phối hợp thuận tiện.'],
];
if(!apply){console.log(JSON.stringify({mode:'DRY_RUN',writes:false,accounts:['farmer3@logstar.test','buyer3@logstar.test'],sampleTrades:3,reviewsPerAccount:3,comments},null,2));process.exit(0);}
try{process.loadEnvFile('.env.local');}catch{}
assert.equal(process.env.VITE_SUPABASE_URL,'https://yyslykqpamnlqkvutrlm.supabase.co');
const credentials=JSON.parse(await readFile('tmp/handover-accounts.json','utf8'));
const clients={},users={};let manifest;
try{manifest=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const check=(r)=>{if(r.error)throw new Error(`Demo operation failed (${r.error.code??r.error.status??'request'}).`);return r.data;};
const save=()=>writeFile(file,JSON.stringify(manifest,null,2)+'\n');
let stage='authentication';
try{
  for(const name of ['farmer3','buyer3']){
    const credential=credentials.find(a=>a.name===name);assert.equal(credential?.email,`${name}@logstar.test`);assert.ok(credential.password);
    const client=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});clients[name]=client;
    const auth=check(await client.auth.signInWithPassword({email:credential.email,password:credential.password}));users[name]=auth.user.id;
    const profile=check(await client.from('profiles').select('role,is_suspended').eq('id',auth.user.id).single());assert.equal(profile.role,name==='farmer3'?'FARMER':'BUYER');assert.equal(profile.is_suspended,false);
  }
  if(!manifest){manifest={version:1,project:process.env.VITE_SUPABASE_URL,users,anchor:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),trades:comments.map(()=>({lot:randomUUID(),request:randomUUID()}))};await save();}
  assert.equal(manifest.project,process.env.VITE_SUPABASE_URL);assert.deepEqual(manifest.users,users);
  const farmer=clients.farmer3,buyer=clients.buyer3;
  const fruit=check(await farmer.from('fruit_types').select('id').eq('code','durian').single());
  const variety=check(await farmer.from('fruit_varieties').select('id').eq('fruit_type_id',fruit.id).eq('code','ri6').single());
  const finish=new Date(Date.parse(manifest.anchor+'T00:00:00Z')+30*86400000).toISOString().slice(0,10);
  for(let i=0;i<manifest.trades.length;i++){
    stage=`sample trade ${i+1}`;const t=manifest.trades[i];
    const lot=check(await farmer.from('lots').select('id,farmer_id').eq('id',t.lot).maybeSingle());
    if(lot)assert.equal(lot.farmer_id,users.farmer3);else check(await farmer.from('lots').insert({id:t.lot,farmer_id:users.farmer3,fruit_type_id:fruit.id,variety_id:variety.id,title:`[MẪU ĐÁNH GIÁ ${i+1}] Sầu riêng Ri6`,quantity_kg:1000,price_vnd_per_kg:65000,harvest_start:manifest.anchor,harvest_end:finish,province:'Đồng Nai',selling_method:'PARTIAL',status:'PUBLISHED',description:'Giao dịch mô phỏng phục vụ trình diễn đánh giá; không phải mua bán thực.'}));
    const req=check(await buyer.from('buy_requests').select('id,buyer_id').eq('id',t.request).maybeSingle());
    if(req)assert.equal(req.buyer_id,users.buyer3);else check(await buyer.from('buy_requests').insert({id:t.request,buyer_id:users.buyer3,fruit_type_id:fruit.id,variety_id:variety.id,title:`[MẪU ĐÁNH GIÁ ${i+1}] Thu mua Ri6`,target_quantity_kg:1000,min_price_vnd_per_kg:60000,max_price_vnd_per_kg:70000,required_start:manifest.anchor,required_end:finish,allow_partial:true,status:'OPEN'}));
    const rpc=async(client,name,args)=>check(await client.rpc(name,args));
    if(!t.connection){t.connection=await rpc(buyer,'open_trade_connection',{target_lot_id:t.lot,target_request_id:t.request});await save();}
    const c=check(await farmer.from('trade_connections').select('status').eq('id',t.connection).single());
    if(c.status==='PENDING')await rpc(farmer,'respond_trade_connection',{target_id:t.connection,decision:'ACCEPTED'});else assert.equal(c.status,'ACCEPTED');
    let agreement=check(await buyer.from('trade_agreements').select('*').eq('connection_id',t.connection).maybeSingle());
    if(!agreement){
      const offers=check(await buyer.from('trade_offers').select('id').eq('connection_id',t.connection).eq('status','PENDING'));
      const offer=offers[0]?.id??await rpc(buyer,'propose_trade_offer',{target_connection_id:t.connection,price:65000,quantity:1000,delivery:manifest.anchor});
      t.agreement=await rpc(farmer,'respond_trade_offer',{target_id:offer,decision:'ACCEPTED'});await save();
      agreement=check(await buyer.from('trade_agreements').select('*').eq('id',t.agreement).single());
    }else{t.agreement=agreement.id;await save();}
    if(!agreement.buyer_completed_at)await rpc(buyer,'complete_trade_agreement',{target_id:t.agreement});
    if(!agreement.farmer_completed_at)await rpc(farmer,'complete_trade_agreement',{target_id:t.agreement});
    for(const [name,stars,comment] of [['buyer3',i===2?4:5,comments[i][0]],['farmer3',5,comments[i][1]]]){
      const existing=check(await clients[name].from('trade_reviews').select('id').eq('agreement_id',t.agreement).eq('reviewer_id',users[name]).maybeSingle());
      if(!existing)await rpc(clients[name],'submit_trade_review',{target_agreement_id:t.agreement,stars,review_comment:comment});
    }
    check(await farmer.from('lots').update({status:'CLOSED'}).eq('id',t.lot));
    check(await buyer.from('buy_requests').update({status:'CLOSED'}).eq('id',t.request));
    console.log(`PASS sample ${i+1}: completed and reviewed in both directions`);
  }
  for(const name of ['farmer3','buyer3']){
    const received=check(await clients[name].from('trade_reviews').select('rating').eq('target_id',users[name]));assert.ok(received.length>=3);
    const average=received.reduce((s,r)=>s+Number(r.rating),0)/received.length;
    console.log(`PASS ${name}: ${received.length} received reviews, average ${average.toFixed(1)}`);
  }
  console.log('PASS demo review seed; reruns preserve the same trades and reviews.');
}catch{console.error(`FAIL ${stage}; no credentials or server payloads are printed.`);process.exitCode=1;}
finally{for(const c of Object.values(clients))await c.auth.signOut({scope:'local'});}
