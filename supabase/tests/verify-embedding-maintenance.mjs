import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite-pgvector';

// Execute the exact worker SQL in PostgreSQL/pgvector; no network or AI inference.
const root=new URL('../../',import.meta.url);
const queries=JSON.parse(execFileSync('python',['-c',
  "import sys,json; sys.path.insert(0,'services/embedding'); from maintenance import COVERAGE_SQL,ENQUEUE_SQL; print(json.dumps([COVERAGE_SQL,ENQUEUE_SQL]))",
],{cwd:fileURLToPath(root),encoding:'utf8'}));
const postgres=sql=>{let i=0;return sql.replace(/%s/g,()=>`$${++i}`);};
const db=await PGlite.create({extensions:{vector}});
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS',name);};
const version='multilingual-e5-base-v1';
const status=async()=> (await db.query(postgres(queries[0]),[version,version,version])).rows[0];
const enqueue=async()=> (await db.query(postgres(queries[1]),[version,version,version])).rows;
try {
  await db.exec(`create schema extensions; create schema logstar_private;
    create extension vector with schema extensions;
    create table public.lot_search_documents(lot_id uuid primary key,content_hash text);
    create table public.buy_request_search_documents(request_id uuid primary key,content_hash text);
    create table public.lot_embeddings(lot_id uuid,content_hash text,model_version text,embedding extensions.vector(768));
    create table public.buy_request_embeddings(request_id uuid,content_hash text,model_version text,embedding extensions.vector(768));
    create table logstar_private.embedding_jobs(id bigint generated always as identity primary key,
      target_kind text,target_id uuid,content_hash text,model_version text,status text default 'PENDING',
      attempts int default 0,next_retry_at timestamptz default now(),leased_until timestamptz,last_error text,
      updated_at timestamptz default now(),unique(target_kind,target_id,content_hash,model_version));
    insert into lot_search_documents values('00000000-0000-4000-8000-000000000001','lot-hash');
    insert into buy_request_search_documents values('00000000-0000-4000-8000-000000000002','request-hash');`);
  await check('missing documents are queued idempotently',async()=>{
    assert.equal(Number((await status()).documents),2);
    assert.equal((await enqueue()).length,2);assert.equal((await enqueue()).length,0);
  });
  await check('FAILED or DONE jobs with missing vectors can be requeued; live leases stay intact',async()=>{
    await db.exec("update logstar_private.embedding_jobs set status='FAILED',attempts=5 where target_kind='lot'; update logstar_private.embedding_jobs set status='LEASED' where target_kind='buy_request';");
    assert.equal((await enqueue()).length,1);
    const rows=(await db.query('select target_kind,status,attempts from logstar_private.embedding_jobs order by target_kind')).rows;
    assert.equal(rows[0].status,'LEASED');assert.equal(rows[1].status,'PENDING');assert.equal(rows[1].attempts,0);
  });
  await check('stale hashes and other model versions do not count as current vectors',async()=>{
    const v=JSON.stringify([1,...Array(767).fill(0)]);
    await db.query("insert into lot_embeddings values('00000000-0000-4000-8000-000000000001','old',$1,$2)",[version,v]);
    await db.query("insert into buy_request_embeddings values('00000000-0000-4000-8000-000000000002','request-hash','other',$1)",[v]);
    const report=await db.query(postgres(queries[0]),[version,version,version]);
    assert.equal(Number(report.rows[0].missing),2);
    await db.exec("update lot_embeddings set content_hash='lot-hash'; update buy_request_embeddings set model_version='multilingual-e5-base-v1';");
    assert.equal(Number((await status()).missing),0);assert.equal((await enqueue()).length,0);
  });
  console.log(`${passed} embedding maintenance checks passed.`);
} finally { await db.close(); }
