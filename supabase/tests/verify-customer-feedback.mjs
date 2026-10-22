import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=await PGlite.create();
const ids=Object.fromEntries(['farmer','farmer2','buyer','buyer2','carrier','carrier2','admin'].map((n,i)=>[n,`91000000-0000-4000-8000-00000000000${i+1}`]));
let passed=0;
async function as(user,sql,args=[]){await db.exec('begin');try{await db.exec(`set local role ${user==='anon'?'anon':'authenticated'}`);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids[user]??'']);const r=await db.query(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
async function denied(user,sql,args=[]){await assert.rejects(()=>as(user,sql,args),e=>['42501','23514','23505','23502','22003'].includes(e.code));}
try{
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
    create schema auth;create schema storage;grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,phone text,email text unique,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
  for(const file of ['migrations/202610140001_initial_schema.sql','seed.sql','migrations/202610150002_trading.sql','migrations/202610220001_customer_feedback.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
  for(const[name,id]of Object.entries(ids))await db.query('insert into auth.users(id,raw_app_meta_data,raw_user_meta_data)values($1,$2,$3)',[id,{app_role:name.replace('2','').toUpperCase()},{full_name:name}]);
  for(const n of ['farmer','farmer2'])await db.query("insert into public.farmer_profiles(user_id,farm_name,province)values($1,$2,'Đồng Nai')",[ids[n],n]);
  for(const n of ['buyer','buyer2'])await db.query("insert into public.buyer_profiles(user_id,organization_name,province)values($1,$2,'Hồ Chí Minh')",[ids[n],n]);
  for(const n of ['carrier','carrier2'])await db.query("insert into public.carrier_profiles(user_id,company_name,province)values($1,$2,'Đồng Nai')",[ids[n],n]);
  const today=(await db.query("select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text d")).rows[0].d;
  const end=(await db.query("select ((now() at time zone 'Asia/Ho_Chi_Minh')::date+20)::text d")).rows[0].d;
  const lot=(await as('farmer',`insert into public.lots(farmer_id,fruit_type_id,variety_id,title,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,status)
    select $1,t.id,v.id,'Ri6',5000,65000,$2,$3,'Đồng Nai','PUBLISHED' from public.fruit_types t join public.fruit_varieties v on v.fruit_type_id=t.id where v.code='ri6' returning id`,[ids.farmer,today,end]))[0].id;
  const req=(await as('buyer',`insert into public.buy_requests(buyer_id,fruit_type_id,variety_id,title,target_quantity_kg,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,status,allow_partial)
    select $1,t.id,v.id,'Thu mua Ri6',5000,60000,70000,$2,$3,'OPEN',true from public.fruit_types t join public.fruit_varieties v on v.fruit_type_id=t.id where v.code='ri6' returning id`,[ids.buyer,today,end]))[0].id;
  const vehicle=(await as('carrier',`insert into public.vehicles(carrier_id,license_plate,vehicle_type,capacity_kg,provinces)values($1,'TEST-TRUCK','ENCLOSED',8000,array['Đồng Nai','Hồ Chí Minh'])returning id`,[ids.carrier]))[0].id;
  const filters="select public.find_transport_vehicles(5000,'Đồng Nai','Hồ Chí Minh','ENCLOSED') result";
  const create="select public.create_transport_request($1,null,$2,5000,'Đồng Nai','Hồ Chí Minh','Vườn A','Kho B',$3,'ENCLOSED') id";
  let shipment;
  await check('matching notification is durable, private and not repeated by metadata edits',async()=>{
    const a=await as('farmer','select * from public.notifications');assert.equal(a.length,1);assert.equal(a[0].kind,'matching');
    await as('buyer',"update public.buy_requests set notes='updated' where id=$1",[req]);
    await as('buyer',"update public.buy_requests set max_price_vnd_per_kg=71000 where id=$1",[req]);
    assert.equal((await as('farmer','select * from public.notifications')).length,1);
    assert.equal((await as('farmer2','select * from public.notifications')).length,0);
  });
  await check('anonymous and wrong roles cannot search or create requests',async()=>{
    await denied('anon',filters);await denied('carrier',filters);await denied('admin',filters);await denied('carrier',create,[lot,vehicle,today]);
  });
  await check('limited vehicle search works without granting table access',async()=>{
    const r=(await as('farmer',filters))[0].result;assert.equal(r.count,1);assert.equal(r.items[0].id,vehicle);assert.ok(!('license_plate' in r.items[0]));
    assert.equal((await as('farmer','select * from public.vehicles')).length,0);
    assert.equal((await as('farmer',"select public.find_transport_vehicles(9000,'Đồng Nai','Hồ Chí Minh','ENCLOSED') r"))[0].r.count,0);
    assert.equal((await as('farmer',"select public.find_transport_vehicles(5000,'Đồng Nai','Hà Nội','ENCLOSED') r"))[0].r.count,0);
    assert.equal((await as('farmer',"select public.find_transport_vehicles(5000,'Đồng Nai','Hồ Chí Minh','REFRIGERATED',4,8) r"))[0].r.count,0);
  });
  await check('sources and ownership cannot be forged',async()=>{
    assert.equal((await as('farmer','select public.my_transport_sources() s'))[0].s.length,1);
    assert.equal((await as('buyer','select public.my_transport_sources() s'))[0].s.length,0);
    await denied('farmer2',create,[lot,vehicle,today]);await denied('buyer',create,[lot,vehicle,today]);
    await denied('farmer',"select public.create_transport_request($1,null,$2,5001,'Đồng Nai','Hồ Chí Minh','A','B',$3,'ENCLOSED')",[lot,vehicle,today]);
  });
  await check('request creates one notification for its designated carrier',async()=>{
    shipment=(await as('farmer',create,[lot,vehicle,today]))[0].id;
    const n=await as('carrier','select * from public.notifications');assert.equal(n.length,1);assert.ok(n[0].path.includes(shipment));
    assert.equal((await as('carrier2','select * from public.transport_requests')).length,0);
    assert.equal((await as('buyer','select * from public.transport_requests')).length,0);
    await denied('farmer',create,[lot,vehicle,today]);
  });
  await check('all direct writes and internal notification helper are denied',async()=>{
    await denied('farmer',"update public.transport_requests set status='ACCEPTED' where id=$1",[shipment]);
    await denied('carrier',"update public.notifications set recipient_id=$1",[ids.farmer]);
    await denied('farmer',"select logstar_private.notify($1,'fake','fake','fake','/farmer/dashboard')",[ids.buyer]);
  });
  await check('quote authority, validation and status transitions are enforced',async()=>{
    await denied('farmer',"select public.respond_transport_request($1,'QUOTED',500000,'test')",[shipment]);
    await denied('carrier2',"select public.respond_transport_request($1,'QUOTED',500000,'test')",[shipment]);
    await denied('carrier',"select public.respond_transport_request($1,'QUOTED',0,'test')",[shipment]);
    await as('carrier',"select public.respond_transport_request($1,'QUOTED',500000,'Đã xác nhận lịch')",[shipment]);
    await denied('carrier',"select public.respond_transport_request($1,'QUOTED',600000,'overwrite')",[shipment]);
    await denied('carrier',"select public.respond_transport_request($1,'ACCEPTED')",[shipment]);
  });
  await check('acceptance rechecks active vehicle and source then preserves quote',async()=>{
    await as('carrier','update public.vehicles set active=false where id=$1',[vehicle]);
    await denied('farmer',"select public.respond_transport_request($1,'ACCEPTED')",[shipment]);
    await as('carrier','update public.vehicles set active=true where id=$1',[vehicle]);
    await as('farmer',"update public.lots set quantity_kg=4000 where id=$1",[lot]);
    await denied('farmer',"select public.respond_transport_request($1,'ACCEPTED')",[shipment]);
    await as('farmer',"update public.lots set quantity_kg=5000 where id=$1",[lot]);
    await as('farmer',"select public.respond_transport_request($1,'ACCEPTED')",[shipment]);
    await denied('farmer',"select public.respond_transport_request($1,'ACCEPTED')",[shipment]);
    assert.equal(Number((await as('farmer','select quote_vnd from public.transport_requests'))[0].quote_vnd),500000);
  });
  await check('cancellation frees source without deleting its history',async()=>{
    await as('farmer',"select public.respond_transport_request($1,'CANCELLED')",[shipment]);
    await denied('farmer',"select public.respond_transport_request($1,'CANCELLED')",[shipment]);
    const next=(await as('farmer',create,[lot,vehicle,today]))[0].id;assert.notEqual(next,shipment);
    await as('carrier',"select public.respond_transport_request($1,'DECLINED')",[next]);
  });
  await check('only notification recipient can mark read, cutoffs preserve new messages',async()=>{
    const n=(await as('carrier','select * from public.notifications order by created_at limit 1'))[0];
    await as('farmer','select public.mark_notifications_read($1)',[n.id]);
    assert.equal((await as('carrier','select read_at from public.notifications where id=$1',[n.id]))[0].read_at,null);
    await as('carrier',"select public.mark_notifications_read($1,'2000-01-01')",[n.id]);
    assert.equal((await as('carrier','select read_at from public.notifications where id=$1',[n.id]))[0].read_at,null);
    await as('carrier','select public.mark_notifications_read($1)',[n.id]);
    assert.ok((await as('carrier','select read_at from public.notifications where id=$1',[n.id]))[0].read_at);
  });
  let connection,agreement;
  await check('trade events notify only the other participant and group messages',async()=>{
    connection=(await as('buyer','select public.open_trade_connection($1,$2) id',[lot,req]))[0].id;
    await as('farmer',"select public.respond_trade_connection($1,'ACCEPTED')",[connection]);
    for(let i=0;i<2;i++)await as('buyer','select public.send_trade_message($1,gen_random_uuid(),$2)',[connection,'hello']);
    assert.equal((await as('farmer',"select * from public.notifications where kind='trade_messages'")).length,1);
    assert.equal((await as('buyer',"select * from public.notifications where kind='trade_messages'")).length,0);
    const offer=(await as('buyer','select public.propose_trade_offer($1,65000,5000,$2) id',[connection,today]))[0].id;
    agreement=(await as('farmer',"select public.respond_trade_offer($1,'ACCEPTED') id",[offer]))[0].id;
    await as('buyer','select public.complete_trade_agreement($1)',[agreement]);await as('farmer','select public.complete_trade_agreement($1)',[agreement]);
  });
  await check('review summary is accurate and cannot expose another account',async()=>{
    await as('buyer',"select public.submit_trade_review($1,5,'Đánh giá mẫu tốt')",[agreement]);
    const r=(await as('farmer','select public.my_review_summary() s'))[0].s;assert.equal(r.count,1);assert.equal(r.average,5);assert.equal(r.recent[0].reviewer_name,'buyer');
    assert.equal((await as('farmer2','select public.my_review_summary() s'))[0].s.count,0);
    await denied('carrier','select public.my_review_summary()');await denied('anon','select public.my_review_summary()');
  });
  await check('Buyer uses only their own agreement as transport source',async()=>{
    assert.equal((await as('buyer','select public.my_transport_sources() s'))[0].s[0].agreement_id,agreement);
    const sql="select public.create_transport_request($1,$2,$3,5000,'Đồng Nai','Hồ Chí Minh','A','B',$4,'ENCLOSED') id";
    await denied('buyer2',sql,[lot,agreement,vehicle,today]);
    await as('buyer',sql,[lot,agreement,vehicle,today]);
  });
  await check('suspended accounts cannot read or mutate new features',async()=>{
    await db.query('update public.profiles set is_suspended=true where id=$1',[ids.farmer]);
    assert.equal((await as('farmer','select * from public.notifications')).length,0);assert.equal((await as('farmer','select * from public.transport_requests')).length,0);
    await denied('farmer',filters);await denied('farmer','select public.mark_notifications_read()');
  });
  console.log(`${passed} customer feedback database checks passed.`);
}finally{await db.close();}
