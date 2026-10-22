import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';

// Real PostgreSQL engine, temporary in-memory database. These minimal Supabase
// system-schema stubs are TEST ONLY. Never run them against hosted Supabase.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = await PGlite.create({ extensions: { vector } });
let passed = 0;
const ids = {
  farmer: '30000000-0000-4000-8000-000000000001',
  farmer2: '30000000-0000-4000-8000-000000000002',
  buyer: '30000000-0000-4000-8000-000000000003',
  buyer2: '30000000-0000-4000-8000-000000000004',
  carrier: '30000000-0000-4000-8000-000000000005',
  carrier2: '30000000-0000-4000-8000-000000000006',
  admin: '30000000-0000-4000-8000-000000000007',
  pending: '30000000-0000-4000-8000-000000000008',
  spoofed: '30000000-0000-4000-8000-000000000009',
};
const lot = '40000000-0000-4000-8000-000000000001';
const draftLot = '40000000-0000-4000-8000-000000000002';
const otherLot = '40000000-0000-4000-8000-000000000003';
const request = '50000000-0000-4000-8000-000000000001';
const draftRequest = '50000000-0000-4000-8000-000000000002';
const vehicle = '60000000-0000-4000-8000-000000000001';
const objectPath = `${ids.farmer}/${lot}/image-1.jpg`;
const draftPath = `${ids.farmer}/${draftLot}/image-2.jpg`;
const fruit = '10000000-0000-4000-8000-000000000001';
const variety = '20000000-0000-4000-8000-000000000001';
const quote = (s) => `'${s.replaceAll("'", "''")}'`;

async function asUser(user, sql, params = []) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${user === 'anon' ? 'anon' : 'authenticated'}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ids[user] ?? (user === 'anon' ? '' : user)]);
    return await db.query(sql, params);
  } finally {
    await db.exec('rollback');
  }
}
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
const count = async (user, relation, n, where = 'true') => {
  const r = await asUser(user, `select count(*)::integer as n from ${relation} where ${where}`);
  assert.equal(r.rows[0].n, n);
};
const denied = async (user, sql, codes = ['42501']) => {
  await assert.rejects(() => asUser(user, sql), (e) => codes.includes(e.code), `Expected SQLSTATE ${codes.join('/')}`);
};

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    create schema extensions;
    grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
    create table auth.users (
      id uuid primary key, phone text, email text unique,
      raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create table storage.buckets (
      id text primary key, name text not null unique, public boolean not null default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
      name text not null, owner_id text, metadata jsonb, unique(bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    -- Backfill test: migration must handle an existing Auth user.
    insert into auth.users(id, raw_app_meta_data) values ('${ids.pending}', '{}');
  `);
  if (process.argv.includes('--deploy')) {
    await db.exec(await readFile(path.join(root, 'deploy.sql'), 'utf8'));
    console.log('APPLIED generated deploy.sql');
  } else {
    for (const file of (await readdir(path.join(root, 'migrations'))).filter(f => f.endsWith('.sql')).sort()) {
      await db.exec(await readFile(path.join(root, 'migrations', file), 'utf8'));
      console.log(`APPLIED ${file}`);
    }
  }
  const seed = await readFile(path.join(root, 'seed.sql'), 'utf8');
  await db.exec(seed);
  await db.exec(seed); // Prove repeatable catalog seeding.

  for (const [user, id] of Object.entries(ids)) {
    if (user === 'pending') continue;
    const role = user.replace(/2$/, '').toUpperCase();
    const meta = user === 'spoofed' ? {} : { app_role: role };
    const userMeta = user === 'spoofed' ? { role: 'ADMIN', app_role: 'ADMIN', full_name: 'Spoof attempt' } : { full_name: user };
    await db.query('insert into auth.users(id, raw_app_meta_data, raw_user_meta_data) values ($1,$2,$3)', [id, meta, userMeta]);
  }
  await db.exec(`
    insert into public.farmer_profiles(user_id, farm_name, province, address)
    values ('${ids.farmer}', 'Farm One', 'Dong Nai', 'Private address'),
           ('${ids.farmer2}', 'Farm Two', 'Lam Dong', 'Another private address');
    insert into public.buyer_profiles(user_id, organization_name, province)
    values ('${ids.buyer}', 'Buyer One', 'Dong Nai'), ('${ids.buyer2}', 'Buyer Two', 'Lam Dong');
    insert into public.carrier_profiles(user_id, company_name, province)
    values ('${ids.carrier}', 'Carrier One', 'Dong Nai'), ('${ids.carrier2}', 'Carrier Two', 'Lam Dong');
    insert into public.lots(id,farmer_id,fruit_type_id,variety_id,title,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,status)
    values ('${lot}','${ids.farmer}','${fruit}','${variety}','Published Ri6',15000,65000,'2026-10-15','2026-10-20','Dong Nai','PUBLISHED'),
           ('${draftLot}','${ids.farmer}','${fruit}','${variety}','Private draft',12000,63000,'2026-10-15','2026-10-20','Dong Nai','DRAFT'),
           ('${otherLot}','${ids.farmer2}','${fruit}','${variety}','Other draft',10000,64000,'2026-10-15','2026-10-20','Lam Dong','DRAFT');
    insert into public.lot_private_details(lot_id,price_floor_vnd_per_kg,internal_notes)
    values ('${lot}',60000,'Private negotiation strategy');
    insert into public.buy_requests(id,buyer_id,fruit_type_id,title,target_quantity_kg,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,status)
    values ('${request}','${ids.buyer}','${fruit}','Procure 50t',50000,60000,70000,'2026-10-15','2026-10-20','OPEN'),
           ('${draftRequest}','${ids.buyer}','${fruit}','Private request',10000,60000,70000,'2026-10-15','2026-10-20','DRAFT');
    insert into public.vehicles(id,carrier_id,license_plate,vehicle_type,capacity_kg)
    values ('${vehicle}','${ids.carrier}','60C-123.45','REFRIGERATED',15000);
    insert into storage.objects(bucket_id,name) values ('lot-images',${quote(objectPath)}),('lot-images',${quote(draftPath)});
    insert into public.lot_images(lot_id,storage_path,sort_order)
    values ('${lot}',${quote(objectPath)},0),('${draftLot}',${quote(draftPath)},0);
  `);

  await check('all application tables have RLS', async () => {
    const r = await db.query("select count(*)::integer n, bool_and(relrowsecurity) secured from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");
    assert.equal(r.rows[0].n, process.argv.includes('--deploy') ? 18 : 25); assert.equal(r.rows[0].secured, true);
  });
  await check('deployment verification queries run successfully', async () => {
    await db.exec(await readFile(path.join(root, 'verify-deployment.sql'), 'utf8'));
  });
  await check('catalog seed can run twice without duplicates', () => count('buyer', 'public.fruit_types', 3));
  await check('five varieties seeded', () => count('buyer', 'public.fruit_varieties', 5));
  await check('existing Auth user backfilled as pending', async () => {
    const r = await asUser('pending', 'select role from public.profiles'); assert.equal(r.rows[0].role, null);
  });
  await check('user-controlled metadata cannot grant ADMIN', async () => {
    const r = await asUser('spoofed', 'select role from public.profiles'); assert.equal(r.rows[0].role, null);
  });
  await check('trusted Auth metadata assigns role', async () => {
    const r = await asUser('buyer', 'select role from public.profiles'); assert.equal(r.rows[0].role, 'BUYER');
  });
  await check('profile query is non-recursive and owner-only', () => count('buyer', 'public.profiles', 1));
  await check('anonymous cannot query profiles', () => denied('anon', 'select * from public.profiles'));
  await check('anonymous cannot query lots', () => denied('anon', 'select * from public.lots'));
  await check('anonymous cannot query catalog', () => denied('anon', 'select * from public.fruit_types'));
  await check('pending user cannot access lots', () => count('pending', 'public.lots', 0));
  await check('owner can edit personal display fields', async () => {
    const r = await asUser('buyer', "update public.profiles set full_name='Updated' returning full_name"); assert.equal(r.rows[0].full_name, 'Updated');
  });
  await check('client cannot change role', () => denied('buyer', "update public.profiles set role='ADMIN'"));
  await check('client cannot overwrite own profile using insert/upsert', () => denied('buyer', `insert into public.profiles(id,role) values ('${ids.buyer}','ADMIN') on conflict(id) do update set role=excluded.role`));
  await check('client cannot change account ID', () => denied('buyer', `update public.profiles set id='${ids.buyer2}'`));
  await check('profile edit cannot touch another account', async () => {
    const r = await asUser('buyer2', `update public.profiles set full_name='Hacked' where id='${ids.buyer}' returning id`); assert.equal(r.rows.length, 0);
  });
  await check('domain profiles are owner-only', () => count('buyer', 'public.farmer_profiles', 0));
  await check('Buyer profile supports standard owner upsert', async () => {
    const r = await asUser('buyer', `insert into public.buyer_profiles(user_id,organization_name,province) values ('${ids.buyer}','Renamed Buyer','Dong Nai') on conflict(user_id) do update set user_id=excluded.user_id, organization_name=excluded.organization_name, province=excluded.province returning organization_name`);
    assert.equal(r.rows[0].organization_name, 'Renamed Buyer');
  });
  await check('domain profile user ID remains immutable', () => denied('buyer', `update public.buyer_profiles set user_id='${ids.buyer2}'`, ['23514']));
  await check('client cannot forge server creation timestamp', () => denied('buyer', `insert into public.buy_requests(buyer_id,fruit_type_id,title,target_quantity_kg,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,created_at) values ('${ids.buyer}','${fruit}','Forged date',1,1,2,'2026-10-15','2026-10-20','2000-01-01')`));
  await check('Buyer cannot create a Farmer profile', () => denied('buyer', `insert into public.farmer_profiles(user_id,farm_name,province) values ('${ids.buyer}','Fake','Dong Nai')`));
  await check('trusted writes still cannot mismatch profile role', async () => {
    await assert.rejects(() => db.exec(`insert into public.farmer_profiles(user_id,farm_name,province) values ('${ids.buyer}','Fake','Dong Nai')`), e => e.code === '23503');
  });
  await check('Buyer sees only one published lot', () => count('buyer', 'public.lots', 1));
  await check('Buyer cannot read draft by direct ID', () => count('buyer', 'public.lots', 0, `id='${draftLot}'`));
  await check('Farmer sees own drafts and published lot', () => count('farmer', 'public.lots', 2));
  await check('Farmer cannot read other Farmer draft', () => count('farmer', 'public.lots', 0, `id='${otherLot}'`));
  await check('Carrier cannot browse lots', () => count('carrier', 'public.lots', 0));
  await check('Admin has no implicit database-wide access', () => count('admin', 'public.lots', 0));
  await check('Buyer cannot insert a lot with forged owner', () => denied('buyer', `insert into public.lots(farmer_id,fruit_type_id,title,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province) values ('${ids.farmer}','${fruit}','Forged',1,1,'2026-10-15','2026-10-20','Dong Nai')`));
  await check('Farmer cannot forge another lot owner', () => denied('farmer', `insert into public.lots(farmer_id,fruit_type_id,title,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province) values ('${ids.farmer2}','${fruit}','Forged',1,1,'2026-10-15','2026-10-20','Dong Nai')`));
  await check('lot owner cannot be reassigned', () => denied('farmer', `update public.lots set farmer_id='${ids.farmer2}' where id='${lot}'`));
  await check('non-owner lot update changes no rows', async () => {
    const r = await asUser('farmer2', `update public.lots set title='Hacked' where id='${lot}' returning id`); assert.equal(r.rows.length, 0);
  });
  await check('owner can edit a lot', async () => {
    const r = await asUser('farmer', `update public.lots set title='Updated' where id='${lot}' returning title`); assert.equal(r.rows[0].title,'Updated');
  });
  await check('Buyer cannot read private floor', () => count('buyer', 'public.lot_private_details', 0));
  await check('other Farmer cannot read private floor', () => count('farmer2', 'public.lot_private_details', 0));
  await check('owner can read private floor', () => count('farmer', 'public.lot_private_details', 1));
  await check('floor above asking price rejected', () => denied('farmer', `update public.lot_private_details set price_floor_vnd_per_kg=66000 where lot_id='${lot}'`, ['23514']));
  await check('asking price below existing floor rejected', () => denied('farmer', `update public.lots set price_vnd_per_kg=59000 where id='${lot}'`, ['23514']));
  await check('negative lot quantity rejected', () => denied('farmer', `update public.lots set quantity_kg=-1 where id='${lot}'`, ['23514']));
  await check('NaN lot quantity rejected', () => denied('farmer', `update public.lots set quantity_kg='NaN' where id='${lot}'`, ['23514']));
  await check('reversed harvest dates rejected', () => denied('farmer', `update public.lots set harvest_end='2026-10-01' where id='${lot}'`, ['23514']));
  await check('variety must belong to chosen fruit', () => denied('farmer', `update public.lots set variety_id='20000000-0000-4000-8000-000000000003' where id='${lot}'`, ['23503']));
  await check('owner sees both own requests', () => count('buyer', 'public.buy_requests', 2));
  await check('another Buyer cannot read requests', () => count('buyer2', 'public.buy_requests', 0));
  await check('Farmer sees OPEN request only', () => count('farmer', 'public.buy_requests', 1));
  await check('Farmer cannot read draft request by ID', () => count('farmer', 'public.buy_requests', 0, `id='${draftRequest}'`));
  await check('Carrier sees no buyer requests', () => count('carrier', 'public.buy_requests', 0));
  await check('Buyer cannot forge request owner', () => denied('buyer2', `insert into public.buy_requests(buyer_id,fruit_type_id,title,target_quantity_kg,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end) values ('${ids.buyer}','${fruit}','Forged',1,1,2,'2026-10-15','2026-10-20')`));
  await check('request owner cannot be changed', () => denied('buyer', `update public.buy_requests set buyer_id='${ids.buyer2}' where id='${request}'`));
  await check('another Buyer cannot edit request', async () => {
    const r = await asUser('buyer2', `update public.buy_requests set title='Hacked' where id='${request}' returning id`); assert.equal(r.rows.length, 0);
  });
  await check('owner can edit request and preserve preview fields', async () => {
    const r = await asUser('buyer', `update public.buy_requests set preferred_provinces=array['Dong Nai','Lam Dong'], quality_requirements=array['VietGAP'], packaging_options=array['CARTON'], buying_method='BY_GRADE', transport_by='BUYER' where id='${request}' returning preferred_provinces, quality_requirements, packaging_options, buying_method, transport_by`);
    assert.deepEqual(r.rows[0].preferred_provinces,['Dong Nai','Lam Dong']); assert.equal(r.rows[0].buying_method,'BY_GRADE'); assert.equal(r.rows[0].transport_by,'BUYER');
  });
  await check('partial demand defaults enabled', async () => {
    const r=await asUser('buyer',`select target_quantity_kg::text, allow_partial, min_lot_quantity_kg from public.buy_requests where id='${request}'`);
    assert.equal(r.rows[0].target_quantity_kg,'50000.000'); assert.equal(r.rows[0].allow_partial,true); assert.equal(r.rows[0].min_lot_quantity_kg,null);
  });
  await check('inverted price range rejected', () => denied('buyer', `update public.buy_requests set min_price_vnd_per_kg=80000 where id='${request}'`, ['23514']));
  await check('zero demand rejected', () => denied('buyer', `update public.buy_requests set target_quantity_kg=0 where id='${request}'`, ['23514']));
  await check('minimum lot quantity cannot exceed total demand', () => denied('buyer', `update public.buy_requests set min_lot_quantity_kg=60000 where id='${request}'`, ['23514']));
  await check('invalid/null label elements rejected', () => denied('buyer', `update public.buy_requests set preferred_provinces=array[null]::text[] where id='${request}'`, ['23514']));
  await check('marketplace card exposes only safe listing identity', async () => {
    const r=await asUser('buyer','select * from public.marketplace_profiles');
    assert.equal(r.rows.length,2); // Own Buyer identity + published Farmer.
    assert.ok(r.rows.some(x=>x.user_id===ids.farmer));
    for(const x of r.rows) for(const key of ['phone_display','address','latitude','longitude','password']) assert.ok(!(key in x));
  });
  await check('private Farmer identity hidden without published lots', () => count('buyer','public.marketplace_profiles',0,`user_id='${ids.farmer2}'`));
  await check('Farmer can see OPEN Buyer identity', () => count('farmer','public.marketplace_profiles',1,`user_id='${ids.buyer}'`));
  await check('client cannot forge public marketplace identity', () => denied('buyer', "update public.marketplace_profiles set display_name='Spoofed'"));
  await check('profile edits synchronize safe marketplace name', async () => {
    await db.exec('begin');
    try {
      await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${ids.farmer}',true); update public.farmer_profiles set farm_name='Renamed Farm';`);
      const r=await db.query(`select display_name from public.marketplace_profiles where user_id='${ids.farmer}'`); assert.equal(r.rows[0].display_name,'Renamed Farm');
    } finally { await db.exec('rollback'); }
  });
  await check('Carrier sees own vehicle', () => count('carrier','public.vehicles',1));
  await check('another Carrier cannot read vehicle', () => count('carrier2','public.vehicles',0));
  await check('Buyer cannot read vehicle plate', () => count('buyer','public.vehicles',0));
  await check('vehicle owner cannot be changed', () => denied('carrier',`update public.vehicles set carrier_id='${ids.carrier2}'`));
  await check('duplicate normalized plate rejected for same Carrier', () => denied('carrier',`insert into public.vehicles(carrier_id,license_plate,vehicle_type,capacity_kg) values ('${ids.carrier}','60c 12345','ENCLOSED',1000)`,['23505']));
  await check('invalid cold-chain temperature range rejected', () => denied('carrier',`update public.vehicles set min_temperature_c=10,max_temperature_c=4 where id='${vehicle}'`,['23514']));
  await check('non-refrigerated vehicle cannot set temperature', () => denied('carrier',`update public.vehicles set vehicle_type='ENCLOSED',min_temperature_c=0,max_temperature_c=4 where id='${vehicle}'`,['23514']));
  await check('bucket private with file size/MIME limits',async()=>{
    const r=await db.query("select * from storage.buckets where id='lot-images'");assert.equal(r.rows[0].public,false);assert.equal(Number(r.rows[0].file_size_limit),5242880);assert.deepEqual(r.rows[0].allowed_mime_types,['image/jpeg','image/png','image/webp']);
  });
  await check('Buyer sees published image metadata only',()=>count('buyer','public.lot_images',1));
  await check('Buyer sees published Storage object only',()=>count('buyer','storage.objects',1));
  await check('Farmer sees own uploaded files',()=>count('farmer','storage.objects',2));
  await check('other Farmer cannot read files',()=>count('farmer2','storage.objects',0));
  await check('Farmer can upload new file in own existing lot folder',async()=>{
    const r=await asUser('farmer',`insert into storage.objects(bucket_id,name) values ('lot-images','${ids.farmer}/${lot}/new.jpg') returning name`);assert.equal(r.rows.length,1);
  });
  await check('upload into another owner folder denied',()=>denied('farmer2',`insert into storage.objects(bucket_id,name) values ('lot-images','${ids.farmer}/${lot}/forged.jpg')`));
  await check('own prefix does not permit upload into another lot',()=>denied('farmer2',`insert into storage.objects(bucket_id,name) values ('lot-images','${ids.farmer2}/${lot}/forged.jpg')`));
  await check('upload into nonexistent lot denied',()=>denied('farmer',`insert into storage.objects(bucket_id,name) values ('lot-images','${ids.farmer}/40000000-0000-4000-8000-000000000099/new.jpg')`));
  await check('unsafe file type rejected by path policy',()=>denied('farmer',`insert into storage.objects(bucket_id,name) values ('lot-images','${ids.farmer}/${lot}/file.svg')`));
  await check('Buyer cannot upload images',()=>denied('buyer',`insert into storage.objects(bucket_id,name) values ('lot-images','${ids.buyer}/${lot}/new.jpg')`));
  await check('link requires existing Storage file',()=>denied('farmer',`insert into public.lot_images(lot_id,storage_path,sort_order) values ('${lot}','${ids.farmer}/${lot}/missing.jpg',1)`,['23514']));
  await check('link cannot reuse an image from a different lot',()=>denied('farmer',`insert into public.lot_images(lot_id,storage_path,sort_order) values ('${lot}',${quote(draftPath)},1)`,['23514']));
  await check('image slot 8 is rejected',()=>denied('farmer',`update public.lot_images set sort_order=8 where lot_id='${lot}'`,['23514']));
  await check('linked file cannot be deleted before metadata unlink',async()=>{
    const r=await asUser('farmer',`delete from storage.objects where name=${quote(objectPath)} returning id`);assert.equal(r.rows.length,0);
  });
  await check('storage overwrite/update denied',async()=>{
    const r=await asUser('farmer',`update storage.objects set name='replacement.jpg' where name=${quote(objectPath)} returning id`);assert.equal(r.rows.length,0);
  });
  await check('unlink then delete works for owner',async()=>{
    await db.exec('begin');try{
      await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${ids.farmer}',true); delete from public.lot_images where lot_id='${lot}';`);
      const r=await db.query(`delete from storage.objects where name=${quote(objectPath)} returning id`);assert.equal(r.rows.length,1);
    }finally{await db.exec('rollback');}
  });
  await check('unsafe direct helper calls unavailable to anonymous',()=>denied('anon',"select logstar_private.current_app_role()"));
  await check('all SECURITY DEFINER functions pin an empty search path',async()=>{
    const r=await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='logstar_private' and p.prosecdef and not coalesce(p.proconfig @> array['search_path=\"\"'],false)");assert.deepEqual(r.rows,[]);
  });
  await check('public SECURITY DEFINER APIs match the allowlist, with safe search_path and no anonymous grants',async()=>{
    const r=await db.query("select p.proname,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') as anon_access,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_access from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef order by p.proname");
    const expected = process.argv.includes('--deploy') ? ['delete_empty_lot','replace_lot_image'] : [
      'admin_close_listing','admin_directory','admin_marketplace','admin_trade_overview','admin_update_member',
      'complete_registration','complete_trade_agreement','create_transport_request','delete_empty_lot','embedding_query_cache','embedding_worker_claim','embedding_worker_finish','embedding_worker_status',
      'find_transport_vehicles','mark_notifications_read','my_review_summary','my_transport_sources','open_trade_connection','prepare_lot_deletion',
      'propose_trade_offer','replace_lot_image','respond_trade_connection','respond_trade_offer','respond_transport_request','send_trade_message','submit_trade_review',
    ];
    assert.deepEqual(r.rows.map(x=>x.proname),expected);
    for(const x of r.rows){assert.ok(x.proconfig.includes('search_path=""'));assert.equal(x.anon_access,false);}
    for(const x of r.rows.filter(x=>x.proname.startsWith('embedding_'))) assert.equal(x.authenticated_access,false);
  });
  if(!process.argv.includes('--deploy')) {
    await check('image lifecycle RPC rejects other owners and roles',async()=>{
      const image=(await db.query(`select id from public.lot_images where lot_id='${lot}' limit 1`)).rows[0].id;
      for(const user of ['farmer2','buyer','admin']) {
        await denied(user,`select public.replace_lot_image('${image}',${quote(objectPath)})`);
        await denied(user,`select public.delete_empty_lot('${lot}')`);
      }
      await denied('anon',`select public.delete_empty_lot('${lot}')`);
    });
    await check('lot DELETE blocked by linked images AND orphan objects',async()=>{
      await denied('farmer',`delete from public.lots where id='${lot}'`,['23514']);
      await db.exec('begin');try {
        await db.exec(`set local role authenticated;select set_config('request.jwt.claim.sub','${ids.farmer}',true);delete from public.lot_images where lot_id='${lot}'`);
        await assert.rejects(()=>db.query(`select public.delete_empty_lot('${lot}')`),e=>e.code==='23514');
      }finally{await db.exec('rollback');}
    });
    await check('image replacement preserves slot and old file until Storage cleanup; delete empty lot works',async()=>{
      await db.exec('begin');try {
        await db.exec(`set local role authenticated;select set_config('request.jwt.claim.sub','${ids.farmer}',true);insert into storage.objects(bucket_id,name) values ('lot-images','${ids.farmer}/${lot}/replacement.jpg')`);
        const image=(await db.query(`select id,sort_order from public.lot_images where lot_id='${lot}' limit 1`)).rows[0];
        await db.query('select public.replace_lot_image($1,$2)',[image.id,`${ids.farmer}/${lot}/replacement.jpg`]);
        const next=(await db.query('select storage_path,sort_order from public.lot_images where id=$1',[image.id])).rows[0];
        assert.equal(next.sort_order,image.sort_order);assert.equal(next.storage_path,`${ids.farmer}/${lot}/replacement.jpg`);
        assert.equal((await db.query(`select count(*)::int n from storage.objects where name=${quote(objectPath)}`)).rows[0].n,1);
        await db.exec(`delete from public.lot_images where lot_id='${lot}';delete from storage.objects where name like '${ids.farmer}/${lot}/%';select public.delete_empty_lot('${lot}')`);
        assert.equal((await db.query(`select count(*)::int n from public.lots where id='${lot}'`)).rows[0].n,0);
      }finally{await db.exec('rollback');}
    });
  }
  await check('cloud smoke script passes and rolls back all synthetic accounts', async () => {
    await db.exec(await readFile(path.join(root, 'tests', 'cloud-smoke.sql'), 'utf8'));
    const r=await db.query("select count(*)::integer n from auth.users where id::text like '99000000-%'");
    assert.equal(r.rows[0].n,0);
  });
  const demoSql = await readFile(path.join(root, 'seeds', 'demo.sql'), 'utf8');
  const demoBuyer = '71000000-0000-4000-8000-000000000004';
  const demoFarmer = '71000000-0000-4000-8000-000000000002';
  const demoLot = '72000000-0000-4000-8000-000000000001';
  await check('demo seed creates complete linked business dataset', async () => {
    await db.exec(demoSql);
    const results = await db.exec(await readFile(path.join(root, 'seeds', 'verify-demo.sql'), 'utf8'));
    assert.deepEqual(Object.fromEntries(results[0].rows.map(r => [r.dataset, Number(r.records)])), {
      profiles:6,farmer_profiles:3,buyer_profiles:2,carrier_profiles:1,marketplace_profiles:6,
      lots:6,lot_private_details:6,buy_requests:5,vehicles:3,
    });
    assert.deepEqual(results[1].rows.map(r => Number(r.candidate_lots)), [1,1,1,0]);
  });
  await check('hybrid graph/vector candidates enforce Buyer and Farmer ownership', async () => {
    await db.exec('begin');
    try {
      const lotId = '72000000-0000-4000-8000-000000000001';
      const requestId = '73000000-0000-4000-8000-000000000001';
      const embedding = "('[' || array_to_string(array_fill('0.01'::text,array[768]), ',') || ']')::extensions.vector(768)";
      await db.exec(`
        insert into public.lot_embeddings(lot_id,model_version,content_hash,embedding)
          select lot_id,'multilingual-e5-base-v1',content_hash,${embedding}
          from public.lot_search_documents where lot_id='${lotId}';
        insert into public.buy_request_embeddings(request_id,model_version,content_hash,embedding)
          select request_id,'multilingual-e5-base-v1',content_hash,${embedding}
          from public.buy_request_search_documents where request_id='${requestId}';
        set local role authenticated;
        select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000004',true);
      `);
      const buyer = await db.query(`select * from public.search_lot_candidates('${requestId}',${embedding},'Ri6') where lot_id='${lotId}'`);
      assert.equal(buyer.rows.length, 1); assert.equal(Number(buyer.rows[0].semantic_rank), 1);
      assert.ok(buyer.rows[0].graph_paths.some(p => p.startsWith('Từ khóa')));
      assert.equal((await db.query(`select * from public.search_lot_candidates('73000000-0000-4000-8000-000000000003',null::extensions.vector(768),'Ri6')`)).rows.length, 0);
      await db.exec("select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true)");
      const farmer = await db.query(`select * from public.search_request_candidates('${lotId}',${embedding},'Ri6') where request_id='${requestId}'`);
      assert.equal(farmer.rows.length, 1); assert.equal(Number(farmer.rows[0].semantic_rank), 1);
      assert.ok(farmer.rows[0].graph_paths.some(p => p.startsWith('Từ khóa')));
      assert.equal((await db.query(`select * from public.search_request_candidates('72000000-0000-4000-8000-000000000003',null::extensions.vector(768),'Ri6')`)).rows.length, 0);
    } finally {
      await db.exec('rollback');
    }
  });
  await check('demo rerun preserves edits and never duplicates business rows', async () => {
    await db.exec(`update public.lot_private_details set price_floor_vnd_per_kg=50000 where lot_id='${demoLot}';
      update public.lots set title='[DEMO] Edited by developer',price_vnd_per_kg=55000 where id='${demoLot}';`);
    await db.exec(demoSql);
    await db.exec(demoSql);
    const r=await db.query(`select title,price_vnd_per_kg from public.lots where id='${demoLot}'`);
    assert.equal(r.rows[0].title,'[DEMO] Edited by developer');
    assert.equal(Number(r.rows[0].price_vnd_per_kg),55000);
    const n=await db.query("select count(*)::integer n from public.lots where id::text like '72000000-%'");
    assert.equal(n.rows[0].n,6);
    await db.exec(`update public.lots set price_vnd_per_kg=65000 where id='${demoLot}';`);
  });
  await check('demo Buyer sees four published lots and only own requests', async () => {
    await count(demoBuyer,'public.lots',4,"id::text like '72000000-%'");
    await count(demoBuyer,'public.buy_requests',2,"id::text like '73000000-%'");
    await count(demoBuyer,'public.lot_private_details',0);
  });
  await check('demo Farmer sees own draft and published lot plus open requests', async () => {
    await count(demoFarmer,'public.lots',2,"id::text like '72000000-%'");
    await count(demoFarmer,'public.buy_requests',4,"id::text like '73000000-%'");
  });
  await check('demo Carrier sees only own three vehicles', () => count('71000000-0000-4000-8000-000000000006','public.vehicles',3));
  console.log(`\n${passed} database checks passed. Auth/Storage HTTP services are not emulated.`);
} catch (error) {
  console.error(`FAIL after ${passed} checks: ${error.message}`);
  if (error.code) console.error(`SQLSTATE ${error.code}`);
  if (error.detail) console.error(error.detail);
  process.exitCode = 1;
} finally {
  await db.close();
}
