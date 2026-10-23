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

  await db.exec(await readFile(new URL('../migrations/202610230001_buyer_evidence.sql',import.meta.url),'utf8'));
  const details={full_name:'Buyer legal',organization_name:'An Phu',province:'Ho Chi Minh',address:'Private warehouse',business_phone:'+84903234567',business_email:'buyer@example.test',tax_code:'1234567890',business_license:'GP-123',representative_name:'Representative',production_certificate:''};
  const save='select public.save_buyer_business_profile($1::jsonb,$2::jsonb,$3)';
  const path=ids.buyer+'/proof.png';
  await check('legacy profiles remain readable with empty legal fields',async()=>{assert.equal((await as('buyer','select tax_code from public.buyer_profiles where user_id=$1',[ids.buyer]))[0].tax_code,null);});
  await check('anonymous and other roles cannot save business profiles',async()=>{await denied('anon',save,[details,[],true]);await denied('farmer',save,[details,[],true]);await denied('carrier',save,[details,[],true]);});
  await check('owner saves an attested profile atomically',async()=>{await as('buyer',save,[details,[],true]);assert.equal((await as('buyer','select full_name from public.profiles where id=$1',[ids.buyer]))[0].full_name,'Buyer legal');assert.equal((await as('buyer','select business_phone from public.buyer_profiles'))[0].business_phone,'+84903234567');});
  await check('validation failures do not partially rename the account',async()=>{await denied('buyer',save,[{...details,full_name:'Broken',tax_code:'bad'},[],true]);await denied('buyer',save,[details,[],false]);await denied('buyer',save,[{...details,business_phone:'123'},[],true]);assert.equal((await as('buyer','select full_name from public.profiles where id=$1',[ids.buyer]))[0].full_name,'Buyer legal');});
  await check('private evidence upload ownership and metadata are enforced',async()=>{await denied('buyer2',"insert into storage.objects(bucket_id,name)values('buyer-evidence',$1)",[path]);await as('buyer',"insert into storage.objects(bucket_id,name)values('buyer-evidence',$1)",[path]);await as('buyer',save,[details,[{path,label:'Business license'}],true]);assert.equal((await as('buyer2',"select * from storage.objects where bucket_id='buyer-evidence'")).length,0);assert.equal((await as('buyer2','select * from public.buyer_evidence')).length,0);assert.equal((await as('farmer','select * from public.buyer_evidence')).length,0);assert.equal((await as('buyer','select * from public.buyer_evidence')).length,1);});
  await check('forged, duplicate and too many evidence images are rejected',async()=>{await denied('buyer2',save,[details,[{path,label:'Forged'}],true]);await denied('buyer',save,[details,[{path:ids.buyer+'/missing.jpg',label:'Missing'}],true]);await denied('buyer',save,[details,[{path,label:'a'},{path,label:'b'}],true]);await denied('buyer',save,[details,Array.from({length:11},(_,i)=>({path:ids.buyer+'/'+i+'.png',label:'many'})),true]);});
  await check('evidence cannot be deleted while referenced; removing it permits cleanup',async()=>{assert.equal((await as('buyer',"delete from storage.objects where bucket_id='buyer-evidence' and name=$1 returning name",[path])).length,0);await as('buyer',save,[details,[],true]);assert.equal((await as('buyer',"delete from storage.objects where bucket_id='buyer-evidence' and name=$1 returning name",[path])).length,1);});
  await check('legal data never enters the public partner projection',async()=>{const columns=(await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='marketplace_profiles'")).rows.map(x=>x.column_name);for(const key of ['tax_code','business_phone','business_email','business_license','address','representative_name'])assert.ok(!columns.includes(key));const bucket=(await db.query("select * from storage.buckets where id='buyer-evidence'")).rows[0];assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png']);});
  console.log(`${passed} business profile verification groups passed`);
}finally{await db.close();}
