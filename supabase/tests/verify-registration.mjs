import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=await PGlite.create();let passed=0;
const id=n=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const run=async(n,sql='select public.complete_registration() role')=>{
  await db.exec('begin');try{await db.exec(`set local role ${n?'authenticated':'anon'}`);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[n?id(n):'']);const r=await db.query(sql);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}
};
const denied=async(n,code='42501',sql)=>assert.rejects(()=>run(n,sql),e=>e.code===code);
const check=async(name,fn)=>{await fn();passed++;console.log('PASS',name);};
async function user(n,requested,options={}){
 await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3,$4,$5)',
 [id(n),options.noEmail?null:`registration${n}@example.test`,options.unconfirmed?null:'2026-10-19T00:00:00Z',{full_name:'Test signup',registration_role:requested,role:'ADMIN'},options.trusted?{app_role:options.trusted}:{}]);
}
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema auth;create schema storage;grant usage on schema public,auth,storage to anon,authenticated,service_role;
 create table auth.users(id uuid primary key,phone text,email text unique,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`);
 for(const file of ['202610140001_initial_schema.sql','202610150002_trading.sql','202610190001_email_registration.sql'])await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 for(const [index,role] of ['FARMER','BUYER','CARRIER'].entries())await check(`verified email enrolls ${role} exactly once`,async()=>{
   const n=index+1;await user(n,role);assert.equal((await db.query('select role from profiles where id=$1',[id(n)])).rows[0].role,null);
   assert.equal((await run(n))[0].role,role);assert.equal((await run(n))[0].role,role);
 });
 await check('enrolled users can create only the matching business profile',async()=>{
   for(const [n,table,field] of [[1,'farmer_profiles','farm_name'],[2,'buyer_profiles','organization_name'],[3,'carrier_profiles','company_name']])
     await run(n,`insert into public.${table}(user_id,${field},province) values('${id(n)}','Registration test','Đồng Nai')`);
   await denied(2,'42501',`insert into public.carrier_profiles(user_id,company_name,province) values('${id(2)}','Wrong role','Đồng Nai')`);
 });
 await check('anonymous and missing profiles cannot enroll',async()=>{await denied(0);await denied(99);});
 await check('unconfirmed email has no role or domain access',async()=>{
   await user(4,'FARMER',{unconfirmed:true});await denied(4);assert.equal((await db.query('select role from profiles where id=$1',[id(4)])).rows[0].role,null);
   await denied(4, '42501',`insert into public.farmer_profiles(user_id,farm_name,province) values('${id(4)}','No access','Đồng Nai')`);
 });
 await check('ADMIN, malformed and missing registration roles are rejected',async()=>{
   for(const [n,role] of [[5,'ADMIN'],[6,'admin'],[7,'UNKNOWN'],[8,null]]){await user(n,role);await denied(n,'22023');}
 });
 await check('metadata edits and direct writes cannot change an enrolled role',async()=>{
   await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{registration_role:'ADMIN'},id(1)]);
   assert.equal((await run(1))[0].role,'FARMER');await denied(1,'42501',`update profiles set role='ADMIN' where id='${id(1)}'`);
   assert.equal((await db.query('select role from profiles where id=$1',[id(2)])).rows[0].role,'BUYER');
 });
 await check('suspended accounts cannot enroll',async()=>{await user(9,'FARMER');await db.query('update profiles set is_suspended=true where id=$1',[id(9)]);await denied(9);});
 await check('trusted existing roles are never overwritten',async()=>{await user(10,'BUYER',{trusted:'ADMIN'});assert.equal((await run(10))[0].role,'ADMIN');});
 await check('a confirmed timestamp alone cannot enroll a phone-only account',async()=>{await user(11,'CARRIER',{noEmail:true});await denied(11);});
 console.log(`${passed} registration security checks passed.`);
}finally{await db.close();}
