import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite-pgvector';
const db=await PGlite.create({extensions:{vector}});
const version='multilingual-e5-base-v1',id='00000000-0000-4000-8000-000000000001';
const encoded=JSON.stringify([1,...Array(767).fill(0)]);
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS',name);};
const claim=async()=> (await db.query('select * from public.embedding_worker_claim(16)')).rows;
const finish=async(job,v=encoded)=> (await db.query('select public.embedding_worker_finish($1,$2,$3::extensions.vector) as status',[job.job_id,job.attempts,v])).rows[0].status;
try {
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
    create schema extensions;create schema logstar_private;create extension vector with schema extensions;
    grant usage on schema public,extensions to anon,authenticated,service_role;
    create table public.lot_search_documents(lot_id uuid primary key,content_hash text,canonical_text text);
    create table public.buy_request_search_documents(request_id uuid primary key,content_hash text,canonical_text text);
    create table public.lot_embeddings(lot_id uuid,model_version text,content_hash text,embedding extensions.vector(768),embedded_at timestamptz default now(),primary key(lot_id,model_version));
    create table public.buy_request_embeddings(request_id uuid,model_version text,content_hash text,embedding extensions.vector(768),embedded_at timestamptz default now(),primary key(request_id,model_version));
    create table logstar_private.embedding_jobs(id bigint generated always as identity primary key,target_kind text,target_id uuid,content_hash text,model_version text default '${version}',status text default 'PENDING',attempts integer default 0,next_retry_at timestamptz default now(),leased_until timestamptz,last_error text,updated_at timestamptz default now(),unique(target_kind,target_id,content_hash,model_version));
    insert into lot_search_documents values('${id}','hash1','Sầu riêng Ri6');
    insert into buy_request_search_documents values('${id}','hash2','Thu mua sầu riêng');
    insert into logstar_private.embedding_jobs(target_kind,target_id,content_hash) values('lot','${id}','hash1'),('buy_request','${id}','hash2'),('lot','${id}','obsolete');`);
  await db.exec(await readFile(new URL('../migrations/202610170001_embedding_worker.sql',import.meta.url),'utf8'));
  let jobs;
  await check('claim leases current documents, skips stale hashes and active leases',async()=>{
    jobs=await claim();assert.equal(jobs.length,2);assert.equal(jobs[0].canonical_text,'Sầu riêng Ri6');
    assert.equal((await claim()).length,0);
    assert.equal((await db.query("select status from logstar_private.embedding_jobs where content_hash='obsolete'")).rows[0].status,'STALE');
  });
  await check('old attempt cannot overwrite a newer lease; valid finish is idempotent',async()=>{
    assert.equal(await finish({...jobs[0],attempts:0}),'LOST_LEASE');
    assert.equal(await finish(jobs[0]),'DONE');assert.equal(await finish(jobs[0]),'LOST_LEASE');
    assert.equal((await db.query('select content_hash from lot_embeddings')).rows[0].content_hash,'hash1');
  });
  await check('changed content during inference never receives a stale vector',async()=>{
    await db.exec("update buy_request_search_documents set content_hash='changed'");
    assert.equal(await finish(jobs[1]),'STALE');
    assert.equal((await db.query('select * from buy_request_embeddings')).rows.length,0);
  });
  await check('invalid vectors rejected, quota failures retry with backoff and stop after five attempts',async()=>{
    await db.exec(`insert into logstar_private.embedding_jobs(target_kind,target_id,content_hash) values('buy_request','${id}','changed')`);
    const [job]=await claim();
    await assert.rejects(finish(job,'[1,0]'),/Invalid normalized/);
    assert.equal(await finish(job,null),'PENDING');assert.equal((await claim()).length,0);
    await db.exec("update logstar_private.embedding_jobs set attempts=4,next_retry_at=now() where status='PENDING'");
    const [last]=await claim();assert.equal(await finish(last,null),'FAILED');assert.equal((await claim()).length,0);
  });
  await check('query cache is hash-only and rejects invalid dimensions or zero vectors',async()=>{
    const hash='a'.repeat(64);
    assert.equal((await db.query('select embedding_query_cache($1) as value',[hash])).rows[0].value,null);
    await db.query('select embedding_query_cache($1,$2::extensions.vector)',[hash,encoded]);
    assert.deepEqual(JSON.parse((await db.query('select embedding_query_cache($1) as value',[hash])).rows[0].value),JSON.parse(encoded));
    await assert.rejects(db.query("select embedding_query_cache('invalid')"),/Invalid query hash/);
    await assert.rejects(db.query('select embedding_query_cache($1,$2::extensions.vector)',[hash,JSON.stringify(Array(768).fill(0))]),/Invalid normalized/);
  });
  await check('anon and every app role lack queue/cache access; service_role can access counters',async()=>{
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      for(const sql of ['select embedding_worker_status()','select * from embedding_worker_claim(1)',`select embedding_worker_finish(1,1,null)`,`select embedding_query_cache('${'a'.repeat(64)}')`,'select * from logstar_private.query_embeddings']) await assert.rejects(db.query(sql),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const report=(await db.query('select embedding_worker_status() as report')).rows[0].report;
    assert.equal(report.documents,2);assert.equal(report.currentVectors,1);assert.equal(report.missing,1);assert.equal(report.failedJobs,1);
    await db.exec('reset role');
  });
  await db.exec(await readFile(new URL('../migrations/202610170002_embedding_queue_recovery.sql',import.meta.url),'utf8'));
  await check('editing A to B and back to A requeues an already-completed hash',async()=>{
    await db.exec(`create trigger enqueue_lot after update of content_hash on lot_search_documents for each row execute function logstar_private.enqueue_search_embedding('lot');
      update lot_search_documents set content_hash='hashB';
      update lot_embeddings set content_hash='hashB';
      update logstar_private.embedding_jobs set status='DONE' where content_hash='hashB';
      update lot_search_documents set content_hash='hash1';`);
    const job=(await db.query("select status,attempts from logstar_private.embedding_jobs where content_hash='hash1'")).rows[0];
    assert.equal(job.status,'PENDING');assert.equal(job.attempts,0);
  });
  await check('recovery respects active retries and requeues exhausted quota jobs after 24 hours',async()=>{
    await db.exec('select logstar_private.requeue_missing_embeddings()');
    assert.equal((await db.query("select status from logstar_private.embedding_jobs where content_hash='changed'")).rows[0].status,'FAILED');
    await db.exec("update logstar_private.embedding_jobs set updated_at=now()-interval '25 hours' where status='FAILED'; select logstar_private.requeue_missing_embeddings()");
    assert.equal((await db.query("select status from logstar_private.embedding_jobs where content_hash='changed'")).rows[0].status,'PENDING');
  });
  console.log(`${passed} hosted worker checks passed.`);
} finally {await db.close();}
