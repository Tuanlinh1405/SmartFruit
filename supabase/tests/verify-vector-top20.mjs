import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';

// Real pgvector cosine/RLS tests, with tiny synthetic vectors; never loads an AI model.
const db = await PGlite.create({ extensions: { vector } });
const root = new URL('../', import.meta.url);
const ids = { farmer: '91000000-0000-4000-8000-000000000001', farmer2: '91000000-0000-4000-8000-000000000002',
  buyer: '91000000-0000-4000-8000-000000000003', buyer2: '91000000-0000-4000-8000-000000000004' };
const lotId = i => `92000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const requestId = i => `93000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const embedding = i => JSON.stringify([1, (i - 1) / 25, ...Array(766).fill(0)]);
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('PASS', name); }
async function as(user, sql, params = []) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${user === 'anon' ? 'anon' : 'authenticated'}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [ids[user] ?? '']);
    return (await db.query(sql, params)).rows;
  } finally { await db.exec('rollback'); }
}
const lots = (user = 'buyer', value = embedding(1)) => as(user,
  'select * from public.search_lot_vector_top20($1,$2::extensions.vector)', [requestId(1), value]);
const requests = (user = 'farmer', value = embedding(1)) => as(user,
  'select * from public.search_request_vector_top20($1,$2::extensions.vector)', [lotId(1), value]);

try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage; create schema extensions;
    grant usage on schema public,auth,storage,extensions to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,phone text,email text unique,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security; grant select,insert,update,delete on storage.objects to authenticated;`);
  await db.exec(await readFile(new URL('migrations/202610140001_initial_schema.sql', root), 'utf8'));
  await db.exec(await readFile(new URL('seed.sql', root), 'utf8'));
  await db.exec(await readFile(new URL('migrations/202610150001_hybrid_search.sql', root), 'utf8'));
  await db.exec(await readFile(new URL('migrations/202610150003_vector_top20.sql', root), 'utf8'));
  for (const [name, id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id,raw_app_meta_data) values($1,$2)',
      [id, { app_role: name.replace('2', '').toUpperCase() }]);
    if (name.startsWith('farmer')) await db.query('insert into public.farmer_profiles(user_id,farm_name,province) values($1,$2,$3)', [id, name, 'Đồng Nai']);
    else await db.query('insert into public.buyer_profiles(user_id,organization_name,province) values($1,$2,$3)', [id, name, 'Đồng Nai']);
  }
  for (let i = 1; i <= 32; i++) {
    await db.query(`insert into public.lots(id,farmer_id,fruit_type_id,variety_id,title,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,status)
      select $1,$2,v.fruit_type_id,v.id,'Sầu riêng Ri6',15000,65000,'2026-10-20','2026-11-05','Đồng Nai','PUBLISHED'
      from public.fruit_varieties v where v.code='ri6'`, [lotId(i), ids.farmer]);
    await db.query(`insert into public.buy_requests(id,buyer_id,fruit_type_id,variety_id,title,target_quantity_kg,min_lot_quantity_kg,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,status)
      select $1,$2,v.fruit_type_id,v.id,'Thu mua Ri6',30000,5000,60000,70000,'2026-10-20','2026-11-05','OPEN'
      from public.fruit_varieties v where v.code='ri6'`, [requestId(i), ids.buyer]);
    if (i === 28) continue; // No embedding yet.
    for (const [table, key, target, documents] of [
      ['lot_embeddings', 'lot_id', lotId(i), 'lot_search_documents'],
      ['buy_request_embeddings', 'request_id', requestId(i), 'buy_request_search_documents'],
    ]) await db.query(`insert into public.${table}(${key},model_version,content_hash,embedding)
      select ${key},$2,case when $3 then 'stale' else content_hash end,$4::extensions.vector
      from public.${documents} where ${key}=$1`,
    [target, i === 27 ? 'other-model' : 'multilingual-e5-base-v1', i === 26, embedding(i > 25 ? 1 : i)]);
  }
  await db.query("update public.lots set status='CLOSED' where id=$1", [lotId(29)]);
  await db.query("update public.buy_requests set status='CLOSED' where id=$1", [requestId(29)]);
  await db.query("update public.lots set variety_id=(select id from public.fruit_varieties where code='monthong') where id=$1", [lotId(30)]);
  await db.query("update public.buy_requests set variety_id=(select id from public.fruit_varieties where code='monthong') where id=$1", [requestId(30)]);
  await db.query("update public.lots set harvest_start='2026-12-01',harvest_end='2026-12-05' where id=$1", [lotId(31)]);
  await db.query("update public.buy_requests set required_start='2026-12-01',required_end='2026-12-05' where id=$1", [requestId(31)]);
  await db.query('update public.lots set quantity_kg=1000 where id=$1', [lotId(32)]);
  await db.query('update public.buy_requests set min_lot_quantity_kg=20000 where id=$1', [requestId(32)]);
  // Keep the ineligible records' embeddings fresh to test eligibility independently of hash checks.
  await db.exec(`update public.lot_embeddings v set content_hash=d.content_hash from public.lot_search_documents d
    where v.lot_id=d.lot_id and v.lot_id>='${lotId(29)}';
    update public.buy_request_embeddings v set content_hash=d.content_hash from public.buy_request_search_documents d
    where v.request_id=d.request_id and v.request_id>='${requestId(29)}';`);

  await check('Buyer gets exactly vector top 20 in cosine order, not lexical order', async () => {
    const rows = await lots();
    assert.equal(rows.length, 20);
    assert.deepEqual(rows.map(row => row.lot_id), Array.from({ length: 20 }, (_, i) => lotId(i + 1)));
    assert.equal(Number(rows[0].eligible_count), 25);
    assert.equal(rows[0].truncated, true);
    rows.forEach((row, i) => assert.ok(Math.abs(row.cosine_similarity - 1 / Math.sqrt(1 + (i / 25) ** 2)) < 0.000001));
  });
  await check('Farmer gets exactly vector top 20 open requests', async () => {
    const rows = await requests();
    assert.equal(rows.length, 20);
    assert.deepEqual(rows.map(row => row.request_id), Array.from({ length: 20 }, (_, i) => requestId(i + 1)));
    assert.equal(Number(rows[0].eligible_count), 25);
  });
  await check('other Buyer/Farmer cannot search someone else source', async () => {
    assert.deepEqual(await lots('buyer2'), []);
    assert.deepEqual(await requests('farmer2'), []);
  });
  await check('anonymous cannot invoke either vector RPC', async () => {
    await assert.rejects(() => lots('anon'), error => error.code === '42501');
    await assert.rejects(() => requests('anon'), error => error.code === '42501');
  });
  await check('null/zero query never causes keyword or graph expansion', async () => {
    const zero = JSON.stringify(Array(768).fill(0));
    assert.deepEqual(await lots('buyer', null), []);
    assert.deepEqual(await requests('farmer', null), []);
    assert.deepEqual(await lots('buyer', zero), []);
  });
  await check('no-partial quantity eligibility is applied before vector top 20', async () => {
    await db.query('update public.buy_requests set allow_partial=false where id=$1', [requestId(1)]);
    assert.deepEqual(await lots(), []);
    const reverse = await requests();
    assert.equal(Number(reverse[0].eligible_count), 24);
    assert.ok(reverse.every(row => row.request_id !== requestId(1)));
    await db.query('update public.buy_requests set allow_partial=true where id=$1', [requestId(1)]);
  });
  await check('equal cosine uses stable IDs and does not exceed 20', async () => {
    await db.query('update public.lot_embeddings set embedding=$1::extensions.vector where lot_id=$2', [embedding(1), lotId(21)]);
    const rows = await lots();
    assert.equal(rows.length, 20);
    assert.deepEqual(rows.slice(0, 2).map(row => row.lot_id), [lotId(1), lotId(21)]);
  });
  await check('changing province preferences does not change vector retrieval', async () => {
    const before = await lots();
    await db.query("update public.buy_requests set preferred_provinces=array['Khác tỉnh'] where id=$1", [requestId(1)]);
    assert.deepEqual(await lots(), before);
  });
  await check('new RPCs retain caller permissions and pinned search path', async () => {
    const rows = (await db.query(`select prosecdef,proconfig from pg_proc
      where oid in ('public.search_lot_vector_top20(uuid,extensions.vector,text)'::regprocedure,
      'public.search_request_vector_top20(uuid,extensions.vector,text)'::regprocedure)`)).rows;
    assert.equal(rows.length, 2);
    rows.forEach(row => { assert.equal(row.prosecdef, false); assert.ok(row.proconfig.includes('search_path=""')); });
  });
  console.log(`PASS ${passed} pgvector top-20/RLS groups`);
} finally { await db.close(); }
