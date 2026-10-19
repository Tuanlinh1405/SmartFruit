import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = await PGlite.create();
const root = new URL('../', import.meta.url);
let passed = 0;
const ids = Object.fromEntries(['buyer','buyer2','farmer','farmer2','carrier','admin'].map((name,i)=>
  [name,`81000000-0000-4000-8000-00000000000${i+1}`]));
const lot='82000000-0000-4000-8000-000000000001';
const req='83000000-0000-4000-8000-000000000001';
const message='84000000-0000-4000-8000-000000000001';
async function as(user,sql,args=[]) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${user==='anon'?'anon':'authenticated'}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids[user]||'']);
    const result=await db.query(sql,args); await db.exec('commit'); return result.rows;
  } catch(error) { await db.exec('rollback'); throw error; }
}
async function check(name,fn) { await fn(); passed++; console.log('PASS',name); }
async function denied(user,sql,args=[],codes=['42501','23514','23505','23502']) {
  await assert.rejects(()=>as(user,sql,args),error=>codes.includes(error.code));
}
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage; grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,phone text,email text unique,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security; grant select,insert,update,delete on storage.objects to authenticated;`);
  await db.exec(await readFile(new URL('migrations/202610140001_initial_schema.sql',root),'utf8'));
  await db.exec(await readFile(new URL('seed.sql',root),'utf8'));
  await db.exec(await readFile(new URL('migrations/202610150002_trading.sql',root),'utf8'));
  await db.exec(await readFile(new URL('migrations/202610150001_lot_image_lifecycle.sql',root),'utf8'));
  const repair = await readFile(new URL('migrations/202610180001_lot_deletion_repair.sql',root),'utf8');
  await db.exec('drop function public.delete_empty_lot(uuid); drop function public.replace_lot_image(uuid,text); drop trigger prevent_lot_delete_with_files on public.lots;');
  await db.exec(repair);
  await db.exec(repair); // Repair can safely be retried after an ambiguous deployment result.
  for(const [name,id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values($1,$2,$3)',
      [id,{app_role:name.replace('2','').toUpperCase()},{full_name:name}]);
  }
  for(const name of ['buyer','buyer2']) await db.query('insert into public.buyer_profiles(user_id,organization_name,province) values($1,$2,$3)',[ids[name],name,'Đồng Nai']);
  for(const name of ['farmer','farmer2']) await db.query('insert into public.farmer_profiles(user_id,farm_name,province) values($1,$2,$3)',[ids[name],name,'Đồng Nai']);
  await db.query(`insert into public.lots(id,farmer_id,fruit_type_id,variety_id,title,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,status)
    select $1,$2,t.id,v.id,'Ri6',15000,65000,'2026-10-20','2026-11-05','Đồng Nai','PUBLISHED'
    from public.fruit_types t join public.fruit_varieties v on v.fruit_type_id=t.id where v.code='ri6'`,[lot,ids.farmer]);
  await db.query(`insert into public.buy_requests(id,buyer_id,fruit_type_id,variety_id,title,target_quantity_kg,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,status)
    select $1,$2,t.id,v.id,'Thu mua Ri6',30000,60000,70000,'2026-10-20','2026-11-05','OPEN'
    from public.fruit_types t join public.fruit_varieties v on v.fruit_type_id=t.id where v.code='ri6'`,[req,ids.buyer]);
  let connection,offer,agreement;
  await check('anonymous and Carrier cannot open connections',async()=>{
    await denied('anon','select public.open_trade_connection($1,$2)',[lot,req]);
    await denied('carrier','select public.open_trade_connection($1,$2)',[lot,req]);
  });
  await check('Buyer cannot use another Buyer request',()=>denied('buyer2','select public.open_trade_connection($1,$2)',[lot,req]));
  await check('Buyer opens an idempotent pending connection',async()=>{
    connection=(await as('buyer','select public.open_trade_connection($1,$2) id',[lot,req]))[0].id;
    assert.equal((await as('buyer','select public.open_trade_connection($1,$2) id',[lot,req]))[0].id,connection);
  });
  await check('unrelated Buyer/Farmer/Carrier cannot read the connection',async()=>{
    for(const role of ['buyer2','farmer2','carrier','admin']) assert.equal((await as(role,'select * from public.trade_connections')).length,0);
  });
  await check('direct table mutation is denied',()=>denied('buyer',"update public.trade_connections set status='ACCEPTED' where id=$1",[connection]));
  await check('initiator cannot accept own invitation',()=>denied('buyer',"select public.respond_trade_connection($1,'ACCEPTED')",[connection]));
  await check('chat is blocked until recipient accepts',()=>denied('buyer','select public.send_trade_message($1,$2,$3)',[connection,message,'hello']));
  await check('Farmer recipient accepts',()=>as('farmer',"select public.respond_trade_connection($1,'ACCEPTED')",[connection]));
  await check('messages persist and retry does not duplicate',async()=>{
    for(let i=0;i<2;i++) await as('buyer','select public.send_trade_message($1,$2,$3)',[connection,message,'  Chào nhà vườn  ']);
    assert.equal((await as('farmer','select body from public.trade_messages'))[0].body,'Chào nhà vườn');
    assert.equal((await as('buyer','select * from public.trade_messages')).length,1);
  });
  await check('outsider cannot send or read messages',async()=>{
    await denied('buyer2','select public.send_trade_message($1,$2,$3)',[connection,message,'attack']);
    assert.equal((await as('buyer2','select * from public.trade_messages')).length,0);
  });
  await check('invalid offer quantity/date is rejected',async()=>{
    await denied('buyer',"select public.propose_trade_offer($1,65000,16000,'2026-10-25')",[connection]);
    await denied('buyer',"select public.propose_trade_offer($1,65000,10000,'2026-11-20')",[connection]);
  });
  await check('Buyer proposes valid terms',async()=>{
    offer=(await as('buyer',"select public.propose_trade_offer($1,65000,10000,'2026-10-25') id",[connection]))[0].id;
  });
  await check('proposer cannot accept own offer',()=>denied('buyer',"select public.respond_trade_offer($1,'ACCEPTED')",[offer]));
  await check('Farmer accepts and terms are snapshotted',async()=>{
    agreement=(await as('farmer',"select public.respond_trade_offer($1,'ACCEPTED') id",[offer]))[0].id;
    const row=(await as('buyer','select * from public.trade_agreements'))[0];
    assert.equal(Number(row.quantity_kg),10000); assert.equal(Number(row.price_vnd_per_kg),65000);
  });
  await check('a second acceptance and new offers cannot overwrite agreement',async()=>{
    await denied('farmer',"select public.respond_trade_offer($1,'ACCEPTED')",[offer]);
    await denied('buyer',"select public.propose_trade_offer($1,64000,10000,'2026-10-25')",[connection]);
  });
  await check('review requires completed agreement',()=>denied('buyer','select public.submit_trade_review($1,5,$2)',[agreement,'Tốt']));
  await check('one completion confirmation is insufficient',async()=>{
    await as('buyer','select public.complete_trade_agreement($1)',[agreement]);
    assert.equal((await as('farmer','select status from public.trade_agreements'))[0].status,'AGREED');
    await denied('buyer','select public.submit_trade_review($1,5,$2)',[agreement,'Tốt']);
  });
  await check('both confirmations complete agreement; review target is server assigned',async()=>{
    await as('farmer','select public.complete_trade_agreement($1)',[agreement]);
    await as('buyer','select public.submit_trade_review($1,5,$2)',[agreement,'Giao dịch đúng thỏa thuận']);
    const row=(await as('farmer','select * from public.trade_reviews'))[0];
    assert.equal(row.target_id,ids.farmer); assert.equal(row.reviewer_id,ids.buyer);
  });
  await check('duplicate reviews and out-of-range stars rejected',async()=>{
    await denied('buyer','select public.submit_trade_review($1,5,$2)',[agreement,'lặp']);
    await denied('farmer','select public.submit_trade_review($1,6,$2)',[agreement,'sai']);
  });
  await check('non-admin cannot call Admin APIs',async()=>{
    for(const role of ['buyer','farmer','carrier']) await denied(role,'select * from public.admin_directory()');
  });
  await check('Admin directory/marketplace/connection projections work',async()=>{
    assert.equal((await as('admin','select * from public.admin_directory()')).length,6);
    assert.equal((await as('admin','select * from public.admin_marketplace()')).length,2);
    const rows=await as('admin','select * from public.admin_trade_overview()');
    assert.equal(rows.length,1); assert.equal(rows[0].agreement_status,'COMPLETED');
    assert.equal(rows[0].body,undefined);
  });
  await check('Admin edits persist and suspension blocks business RPCs',async()=>{
    await as('admin','select public.admin_update_member($1,$2,$3,$4,true)',[ids.buyer,'Buyer edited','Business edited','Đồng Nai']);
    assert.equal((await as('buyer','select full_name from public.profiles'))[0].full_name,'Buyer edited');
    await denied('buyer','select public.send_trade_message($1,$2,$3)',[connection,'84000000-0000-4000-8000-000000000002','blocked']);
    await denied('buyer',"update public.profiles set is_suspended=false where id=$1",[ids.buyer]);
  });
  await check('Admin cannot suspend Admin or change account roles through member API',async()=>{
    await denied('admin','select public.admin_update_member($1,$2,$3,$4,true)',[ids.admin,'Admin','Admin','Đồng Nai']);
    const row=(await as('admin','select role from public.profiles where id=$1',[ids.admin]))[0]; assert.equal(row.role,'ADMIN');
  });
  await check('history blocks preparation without changing lot status or photos',async()=>{
    const historyPhoto=`${ids.farmer}/${lot}/history.png`;
    await db.query("insert into storage.objects(bucket_id,name) values('lot-images',$1)",[historyPhoto]);
    await as('farmer','insert into public.lot_images(lot_id,storage_path,sort_order) values($1,$2,0)',[lot,historyPhoto]);
    for (const status of ['PENDING','ACCEPTED','CANCELLED','DECLINED']) {
      await db.query('update public.trade_connections set status=$1 where id=$2',[status,connection]);
      await denied('farmer','select public.prepare_lot_deletion($1)',[lot],['23503']);
    }
    await db.query("update public.trade_connections set status='ACCEPTED' where id=$1",[connection]);
    assert.equal((await db.query('select status from public.lots where id=$1',[lot])).rows[0].status,'PUBLISHED');
    assert.equal((await db.query('select count(*)::int n from public.trade_agreements')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from public.lot_images where lot_id=$1',[lot])).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from storage.objects where name=$1',[historyPhoto])).rows[0].n,1);
  });
  const disposable='82000000-0000-4000-8000-000000000002';
  await db.query(`insert into public.lots(id,farmer_id,fruit_type_id,variety_id,title,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,status)
    select $1,farmer_id,fruit_type_id,variety_id,'Delete test',quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,'PUBLISHED'
    from public.lots where id=$2`,[disposable,lot]);
  const path=`${ids.farmer}/${disposable}/photo.png`;
  await db.query("insert into storage.objects(bucket_id,name) values('lot-images',$1)",[path]);
  await as('farmer','insert into public.lot_images(lot_id,storage_path,sort_order) values($1,$2,0)',[disposable,path]);
  await check('preparation denies other owners and roles without touching images',async()=>{
    for(const user of ['anon','buyer2','carrier','admin','farmer2']) await denied(user,'select public.prepare_lot_deletion($1)',[disposable]);
    assert.equal((await db.query('select count(*)::int n from public.lot_images where lot_id=$1',[disposable])).rows[0].n,1);
  });
  await check('preparation closes a lot and blocks new invitations',async()=>{
    await as('farmer','select public.prepare_lot_deletion($1)',[disposable]);
    assert.equal((await db.query('select status from public.lots where id=$1',[disposable])).rows[0].status,'CLOSED');
    await denied('buyer2','select public.open_trade_connection($1,null)',[disposable]);
  });
  await check('linked and orphan images block final deletion; retry succeeds after Storage cleanup',async()=>{
    await denied('farmer','select public.delete_empty_lot($1)',[disposable]);
    await as('farmer','delete from public.lot_images where lot_id=$1',[disposable]);
    await denied('farmer','select public.delete_empty_lot($1)',[disposable]);
    await as('farmer',"delete from storage.objects where bucket_id='lot-images' and name=$1",[path]);
    await as('farmer','select public.prepare_lot_deletion($1)',[disposable]);
    await as('farmer','select public.delete_empty_lot($1)',[disposable]);
    assert.equal((await db.query('select * from public.lots where id=$1',[disposable])).rows.length,0);
  });
  console.log(`${passed} trading and lot deletion database checks passed.`);
} finally { await db.close(); }
