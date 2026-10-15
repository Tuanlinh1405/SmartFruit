import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const url=process.env.VITE_SUPABASE_URL;
if(url!=='https://yyslykqpamnlqkvutrlm.supabase.co') throw new Error('HTTP test is restricted to LogStar.');
const accounts=JSON.parse(await readFile('tmp/test-accounts.json','utf8'));
const clients={};let passed=0;const results=[];const runId=randomUUID();
const unwrap=result=>{if(result.error)throw new Error(`${result.error.code||''} ${result.error.message}`);return result.data;};
async function check(name,fn){await fn();passed++;results.push(name);console.log('PASS',name);}
async function denied(result){assert.ok(result.error,'Expected server denial');}
try{
  for(const account of accounts){const client=createClient(url,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    unwrap(await client.auth.signInWithPassword({email:account.email,password:account.password}));clients[account.name]=client;
    await check(`real Auth login and profile role: ${account.name}`,async()=>{const profile=unwrap(await client.from('profiles').select('id,role,is_suspended').eq('id',account.id).single());assert.equal(profile.role,account.role);assert.equal(profile.is_suspended,false);});}
  const {buyer1,buyer2,farmer1,farmer2,carrier1,carrier2,admin1}=clients;
  const user=name=>accounts.find(row=>row.name===name).id;
  const catalog=unwrap(await buyer1.from('fruit_types').select('id,code'));
  const fruit=catalog.find(row=>row.code==='durian');
  const varieties=unwrap(await buyer1.from('fruit_varieties').select('id,fruit_type_id,code'));
  const variety=varieties.find(row=>row.code==='ri6'&&row.fruit_type_id===fruit.id);
  const lot=randomUUID(),request=randomUUID(),message=randomUUID();
  await check('Farmer publishes a real test lot through Data API',async()=>{unwrap(await farmer1.from('lots').insert({id:lot,farmer_id:user('farmer1'),fruit_type_id:fruit.id,variety_id:variety.id,
    title:`[TEST HTTP] Ri6 ${runId.slice(0,8)}`,quantity_kg:15000,price_vnd_per_kg:65000,harvest_start:'2026-10-20',harvest_end:'2026-11-05',province:'Đồng Nai',status:'PUBLISHED'}).select('id').single());});
  await check('Buyer creates and reads a real procurement request',async()=>{const data=unwrap(await buyer1.from('buy_requests').insert({id:request,buyer_id:user('buyer1'),fruit_type_id:fruit.id,variety_id:variety.id,
    title:`[TEST HTTP] Thu mua Ri6 ${runId.slice(0,8)}`,target_quantity_kg:30000,min_lot_quantity_kg:5000,min_price_vnd_per_kg:60000,max_price_vnd_per_kg:70000,
    required_start:'2026-10-20',required_end:'2026-11-05',status:'OPEN',allow_partial:true}).select('*').single());assert.equal(Number(data.target_quantity_kg),30000);});
  await check('other Buyer cannot read or update that request',async()=>{assert.equal(unwrap(await buyer2.from('buy_requests').select('id').eq('id',request)).length,0);
    assert.equal(unwrap(await buyer2.from('buy_requests').update({title:'attack'}).eq('id',request).select('id')).length,0);});
  await check('Buyer profile persists and private profiles stay owner-only',async()=>{
    const original=unwrap(await buyer1.from('buyer_profiles').select('*').eq('user_id',user('buyer1')).single());
    unwrap(await buyer1.from('buyer_profiles').update({address:'[TEST HTTP] Kho kiểm thử'}).eq('user_id',user('buyer1')));
    assert.equal(unwrap(await buyer1.from('buyer_profiles').select('address').single()).address,'[TEST HTTP] Kho kiểm thử');
    assert.equal(unwrap(await buyer2.from('buyer_profiles').select('user_id').eq('user_id',user('buyer1'))).length,0);
    unwrap(await buyer1.from('buyer_profiles').update({address:original.address}).eq('user_id',user('buyer1')));
  });
  await check('Farmer and Carrier data remain owner-scoped',async()=>{
    assert.equal(unwrap(await farmer2.from('lots').select('id').eq('id',lot)).length,0);
    const own=unwrap(await carrier1.from('vehicles').select('carrier_id'));assert.ok(own.length>0);assert.ok(own.every(row=>row.carrier_id===user('carrier1')));
    assert.equal(unwrap(await carrier2.from('vehicles').select('id').eq('carrier_id',user('carrier1'))).length,0);
    assert.equal(unwrap(await carrier1.from('buy_requests').select('id')).length,0);
  });
  await check('real Storage upload, image link and Buyer signed download',async()=>{
    const imagePath=`${user('farmer1')}/${lot}/http-test.png`;
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=','base64');
    unwrap(await farmer1.storage.from('lot-images').upload(imagePath,bytes,{contentType:'image/png'}));
    unwrap(await farmer1.from('lot_images').insert({lot_id:lot,storage_path:imagePath,sort_order:0}));
    const signed=unwrap(await buyer1.storage.from('lot-images').createSignedUrl(imagePath,60));
    const response=await fetch(signed.signedUrl);assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,bytes.length);
    await denied(await buyer2.from('lots').insert({id:randomUUID(),farmer_id:user('farmer1')}));
  });
  let connection,offer,agreement;
  await check('invitation persists; source ownership enforced',async()=>{
    await denied(await buyer2.rpc('open_trade_connection',{target_lot_id:lot,target_request_id:request}));
    connection=unwrap(await buyer1.rpc('open_trade_connection',{target_lot_id:lot,target_request_id:request}));
    assert.equal(unwrap(await buyer1.rpc('open_trade_connection',{target_lot_id:lot,target_request_id:request})),connection);
    assert.equal(unwrap(await farmer1.from('trade_connections').select('status').eq('id',connection).single()).status,'PENDING');
  });
  await check('only invitation recipient accepts; messaging requires acceptance',async()=>{
    await denied(await buyer1.rpc('respond_trade_connection',{target_id:connection,decision:'ACCEPTED'}));
    await denied(await buyer1.rpc('send_trade_message',{target_connection_id:connection,message_id:message,message_body:'before acceptance'}));
    unwrap(await farmer1.rpc('respond_trade_connection',{target_id:connection,decision:'ACCEPTED'}));
  });
  await check('chat persists across independent clients with idempotent send',async()=>{
    const args={target_connection_id:connection,message_id:message,message_body:'[TEST HTTP] Chào nhà vườn'};
    unwrap(await buyer1.rpc('send_trade_message',args));unwrap(await buyer1.rpc('send_trade_message',args));
    const rows=unwrap(await farmer1.from('trade_messages').select('*').eq('connection_id',connection));assert.equal(rows.length,1);assert.equal(rows[0].body,args.message_body);
  });
  await check('other accounts and Admin cannot read private chat',async()=>{
    for(const client of [buyer2,farmer2,carrier1,admin1]) assert.equal(unwrap(await client.from('trade_messages').select('id').eq('connection_id',connection)).length,0);
    await denied(await buyer2.rpc('send_trade_message',{target_connection_id:connection,message_id:randomUUID(),message_body:'attack'}));
  });
  await check('offer validation and recipient-only acceptance work over HTTP',async()=>{
    await denied(await buyer1.rpc('propose_trade_offer',{target_connection_id:connection,price:65000,quantity:16000,delivery:'2026-10-25'}));
    offer=unwrap(await buyer1.rpc('propose_trade_offer',{target_connection_id:connection,price:65000,quantity:10000,delivery:'2026-10-25'}));
    await denied(await buyer1.rpc('respond_trade_offer',{target_id:offer,decision:'ACCEPTED'}));
    agreement=unwrap(await farmer1.rpc('respond_trade_offer',{target_id:offer,decision:'ACCEPTED'}));
    const row=unwrap(await buyer1.from('trade_agreements').select('*').eq('id',agreement).single());assert.equal(Number(row.quantity_kg),10000);
  });
  await check('both participants must complete before reviewing',async()=>{
    await denied(await buyer1.rpc('submit_trade_review',{target_agreement_id:agreement,stars:5,review_comment:'too early'}));
    unwrap(await buyer1.rpc('complete_trade_agreement',{target_id:agreement}));
    assert.equal(unwrap(await farmer1.from('trade_agreements').select('status').eq('id',agreement).single()).status,'AGREED');
    unwrap(await farmer1.rpc('complete_trade_agreement',{target_id:agreement}));
    unwrap(await buyer1.rpc('submit_trade_review',{target_agreement_id:agreement,stars:5,review_comment:'[TEST HTTP] Đúng thỏa thuận'}));
    const row=unwrap(await farmer1.from('trade_reviews').select('target_id').eq('agreement_id',agreement).single());assert.equal(row.target_id,user('farmer1'));
    await denied(await buyer1.rpc('submit_trade_review',{target_agreement_id:agreement,stars:5,review_comment:'duplicate'}));
  });
  await check('Admin uses restricted directory and marketplace APIs',async()=>{
    await denied(await buyer1.rpc('admin_directory'));
    assert.ok(unwrap(await admin1.rpc('admin_directory')).length>=7);
    assert.ok(unwrap(await admin1.rpc('admin_marketplace')).some(row=>row.id===lot));
    assert.ok(unwrap(await admin1.rpc('admin_trade_overview')).some(row=>row.id===connection));
    assert.ok(unwrap(await buyer1.rpc('buyer_market_summary')).some(row=>row.fruit_name==='Sầu riêng'));
  });
  await check('Admin suspension blocks a live user and can be restored',async()=>{
    const original=unwrap(await admin1.rpc('admin_directory')).find(row=>row.id===user('carrier2'));
    const args={target_id:original.id,member_name:original.full_name,business_name:original.display_name,member_province:original.province};
    try{unwrap(await admin1.rpc('admin_update_member',{...args,suspended:true}));
      assert.equal(unwrap(await carrier2.from('vehicles').select('id')).length,0);
      assert.equal(unwrap(await carrier2.from('profiles').select('is_suspended').single()).is_suspended,true);
      await denied(await carrier2.from('profiles').update({is_suspended:false}).eq('id',original.id));
    }finally{unwrap(await admin1.rpc('admin_update_member',{...args,suspended:false}));}
  });
  await check('Admin closes the test listing and Buyer can still read own trade history',async()=>{
    unwrap(await admin1.rpc('admin_close_listing',{target_id:lot,target_kind:'lot'}));
    assert.equal(unwrap(await buyer1.from('lots').select('id').eq('id',lot)).length,0);
    assert.equal(unwrap(await buyer1.from('trade_connections').select('lot_title').eq('id',connection).single()).lot_title.startsWith('[TEST HTTP]'),true);
    const partner=unwrap(await buyer1.from('marketplace_profiles').select('user_id').eq('user_id',user('farmer1')));assert.equal(partner.length,1);
  });
  await writeFile('tmp/http-test-results.json',JSON.stringify({runId,passed,results,connectionId:connection,agreementId:agreement,lotId:lot,requestId:request},null,2)+'\n');
  console.log(`${passed} live HTTP checks passed. TEST-labelled records retained for browser verification.`);
}finally{for(const client of Object.values(clients))await client.auth.signOut({scope:'local'});}
