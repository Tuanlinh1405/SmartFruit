import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=await PGlite.create();
const farmer='94000000-0000-4000-8000-000000000001',other='94000000-0000-4000-8000-000000000002';
const lot='95000000-0000-4000-8000-000000000001',draft='95000000-0000-4000-8000-000000000002';
const fruit='10000000-0000-4000-8000-000000000001',variety='20000000-0000-4000-8000-000000000001';
const file=farmer+'/'+lot+'/original.jpg';let passed=0;
const sql=async name=>readFile(new URL('../migrations/'+name,import.meta.url),'utf8');
async function as(user,query,args=[]){await db.exec('begin');try{await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);const r=await db.query(query,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
const denied=(user,query,args=[],codes=['23514','42501'])=>assert.rejects(()=>as(user,query,args),e=>codes.includes(e.code));
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema auth;create schema storage;grant usage on schema public,auth,storage to anon,authenticated,service_role;
 create table auth.users(id uuid primary key,phone text,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(await sql('202610140001_initial_schema.sql'));
 await db.exec(await readFile(new URL('../seed.sql',import.meta.url),'utf8'));
 await db.exec(await sql('202610150001_lot_image_lifecycle.sql'));
 for(const id of[farmer,other]){await db.query("insert into auth.users(id,raw_app_meta_data,raw_user_meta_data)values($1,'{\"app_role\":\"FARMER\"}','{\"full_name\":\"Test\"}')",[id]);await db.query("insert into public.farmer_profiles(user_id,farm_name,province)values($1,'Test','Đồng Nai')",[id]);}
 const insert=`insert into public.lots(id,farmer_id,fruit_type_id,variety_id,title,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,status)values($1,$2,'${fruit}','${variety}','Photo test',1000,65000,'2026-10-20','2026-11-20','Đồng Nai',$3)`;
 await db.query(insert,[lot,farmer,'PUBLISHED']);
 const migration=await sql('202610250001_required_lot_photos.sql');
 await check('migration refuses published legacy lots without photos',async()=>{await assert.rejects(()=>db.exec(migration),e=>e.code==='23514');await db.exec('rollback');});
 await db.query("insert into storage.objects(bucket_id,name)values('lot-images',$1)",[file]);await db.query('insert into public.lot_images(lot_id,storage_path)values($1,$2)',[lot,file]);
 await db.exec(migration);
 await check('existing photos backfill counts and preserve user provenance',async()=>{assert.equal((await db.query('select image_count from public.lots where id=$1',[lot])).rows[0].image_count,1);assert.equal((await db.query('select is_ai_generated from public.lot_images where lot_id=$1',[lot])).rows[0].is_ai_generated,false);});
 await as(farmer,insert,[draft,farmer,'DRAFT']);
 await check('draft upload staging is allowed; direct published inserts and empty publication are blocked',async()=>{await denied(farmer,`update public.lots set status='PUBLISHED' where id=$1`,[draft]);await denied(farmer,insert,['95000000-0000-4000-8000-000000000003',farmer,'PUBLISHED']);});
 await check('clients cannot forge counts or generated-photo provenance',async()=>{await denied(farmer,'update public.lots set image_count=1 where id=$1',[draft]);await denied(farmer,'update public.lot_images set is_ai_generated=false where lot_id=$1',[lot]);});
 await check('deleting the last published image rolls back metadata and count',async()=>{await denied(farmer,'delete from public.lot_images where lot_id=$1',[lot]);assert.equal((await db.query('select image_count from public.lots where id=$1',[lot])).rows[0].image_count,1);assert.equal((await db.query('select count(*)::int n from public.lot_images where lot_id=$1',[lot])).rows[0].n,1);});
 await check('multiple images permit removal until the final photo',async()=>{const p=farmer+'/'+lot+'/second.jpg';await as(farmer,"insert into storage.objects(bucket_id,name)values('lot-images',$1)",[p]);await as(farmer,'insert into public.lot_images(lot_id,storage_path,sort_order)values($1,$2,1)',[lot,p]);await as(farmer,'delete from public.lot_images where storage_path=$1',[p]);await denied(farmer,'delete from public.lot_images where lot_id=$1',[lot]);});
 await check('replacing an AI image preserves count and resets provenance',async()=>{await db.query('update public.lot_images set is_ai_generated=true where lot_id=$1',[lot]);const p=farmer+'/'+lot+'/user-replacement.jpg';await as(farmer,"insert into storage.objects(bucket_id,name)values('lot-images',$1)",[p]);const id=(await db.query('select id from public.lot_images where lot_id=$1',[lot])).rows[0].id;await as(farmer,'select public.replace_lot_image($1,$2)',[id,p]);const row=(await db.query('select i.is_ai_generated,l.image_count from public.lot_images i join public.lots l on l.id=i.lot_id where l.id=$1',[lot])).rows[0];assert.equal(row.is_ai_generated,false);assert.equal(row.image_count,1);});
 await check('other owners cannot remove photos or reassign image ownership',async()=>{assert.equal((await as(other,'delete from public.lot_images where lot_id=$1 returning id',[lot])).length,0);await denied(farmer,'update public.lot_images set lot_id=$1 where lot_id=$2',[draft,lot]);});
 await check('closed lot cleanup works but cannot be republished without a photo',async()=>{await as(farmer,"update public.lots set status='CLOSED' where id=$1",[lot]);await as(farmer,'delete from public.lot_images where lot_id=$1',[lot]);assert.equal((await db.query('select image_count from public.lots where id=$1',[lot])).rows[0].image_count,0);await denied(farmer,"update public.lots set status='PUBLISHED' where id=$1",[lot]);});
 await check('guard functions are private with a pinned search path',async()=>{const r=await db.query("select p.proname,has_function_privilege('authenticated',p.oid,'execute') allowed,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='logstar_private' and p.proname in('initialize_lot_image_count','sync_lot_image_count','protect_lot_image_identity','require_published_lot_photo')");assert.equal(r.rows.length,4);for(const p of r.rows){assert.equal(p.allowed,false);assert.ok(p.proconfig.includes('search_path=\"\"'));}});
 console.log(`${passed} required-photo database checks passed`);
}finally{await db.close();}
