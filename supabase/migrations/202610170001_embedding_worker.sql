-- Hosted worker access to the existing private queue. No client permissions added.
begin;

create table logstar_private.query_embeddings (
  text_hash text not null check (text_hash ~ '^[a-f0-9]{64}$'),
  model_version text not null check (model_version='multilingual-e5-base-v1'),
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now(),
  primary key (text_hash,model_version)
);
alter table logstar_private.query_embeddings enable row level security;
revoke all on logstar_private.query_embeddings from public,anon,authenticated;

create function public.embedding_worker_claim(batch_size integer default 16)
returns table(job_id bigint,target_kind text,target_id uuid,content_hash text,attempts integer,canonical_text text)
language plpgsql security definer set search_path='' as $$
begin
  if batch_size is null or batch_size not between 1 and 16 then raise exception 'Invalid batch size'; end if;
  -- Discard superseded documents without consuming GPU time.
  update logstar_private.embedding_jobs j set status='STALE',leased_until=null,updated_at=now()
  where j.model_version='multilingual-e5-base-v1'
    and (j.status='PENDING' or (j.status='LEASED' and j.leased_until<now()))
    and not exists (
      select 1 from public.lot_search_documents d where j.target_kind='lot' and d.lot_id=j.target_id and d.content_hash=j.content_hash
      union all
      select 1 from public.buy_request_search_documents d where j.target_kind='buy_request' and d.request_id=j.target_id and d.content_hash=j.content_hash
    );
  update logstar_private.embedding_jobs j set status='FAILED',leased_until=null,updated_at=now()
  where j.model_version='multilingual-e5-base-v1' and j.attempts>=5
    and (j.status='PENDING' or (j.status='LEASED' and j.leased_until<now()));
  return query
  with picked as (
    select j.id from logstar_private.embedding_jobs j
    where j.model_version='multilingual-e5-base-v1' and j.next_retry_at<=now()
      and (j.status='PENDING' or (j.status='LEASED' and j.leased_until<now()))
    order by j.id for update skip locked limit batch_size
  ), leased as (
    update logstar_private.embedding_jobs j set status='LEASED',attempts=j.attempts+1,
      leased_until=now()+interval '10 minutes',updated_at=now()
    from picked p where j.id=p.id
    returning j.id,j.target_kind,j.target_id,j.content_hash,j.attempts
  ), docs as (
    select 'lot'::text kind,d.lot_id id,d.content_hash hash,d.canonical_text body from public.lot_search_documents d
    union all
    select 'buy_request',d.request_id,d.content_hash,d.canonical_text from public.buy_request_search_documents d
  )
  select l.id,l.target_kind,l.target_id,l.content_hash,l.attempts,d.body from leased l
    join docs d on d.kind=l.target_kind and d.id=l.target_id and d.hash=l.content_hash order by l.id;
end;
$$;

create function public.embedding_worker_finish(job_id bigint,lease_attempt integer,encoded extensions.vector default null)
returns text language plpgsql security definer set search_path='' as $$
declare job logstar_private.embedding_jobs%rowtype; current_hash text; outcome text;
begin
  select * into job from logstar_private.embedding_jobs j where j.id=job_id for update;
  if not found or job.status<>'LEASED' or job.attempts<>lease_attempt or job.leased_until<now() then return 'LOST_LEASE'; end if;
  if job.model_version<>'multilingual-e5-base-v1' then raise exception 'Unsupported model'; end if;
  if job.target_kind='lot' then
    select d.content_hash into current_hash from public.lot_search_documents d where d.lot_id=job.target_id for share;
  else
    select d.content_hash into current_hash from public.buy_request_search_documents d where d.request_id=job.target_id for share;
  end if;
  if current_hash is distinct from job.content_hash then outcome:='STALE';
  elsif encoded is null then outcome:=case when job.attempts>=5 then 'FAILED' else 'PENDING' end;
  else
    if extensions.vector_dims(encoded)<>768 or not (extensions.vector_norm(encoded) between 0.99 and 1.01) then
      raise exception 'Invalid normalized E5 vector';
    end if;
    if job.target_kind='lot' then
      insert into public.lot_embeddings(lot_id,model_version,content_hash,embedding)
      values(job.target_id,job.model_version,job.content_hash,encoded)
      on conflict(lot_id,model_version) do update set content_hash=excluded.content_hash,embedding=excluded.embedding,embedded_at=now();
    else
      insert into public.buy_request_embeddings(request_id,model_version,content_hash,embedding)
      values(job.target_id,job.model_version,job.content_hash,encoded)
      on conflict(request_id,model_version) do update set content_hash=excluded.content_hash,embedding=excluded.embedding,embedded_at=now();
    end if;
    outcome:='DONE';
  end if;
  update logstar_private.embedding_jobs j set status=outcome,leased_until=null,updated_at=now(),
    next_retry_at=case when outcome='PENDING' then now()+interval '30 minutes' else j.next_retry_at end,
    last_error=case when encoded is null and outcome in ('PENDING','FAILED') then 'embedding-unavailable' else null end
    where j.id=job_id;
  return outcome;
end;
$$;

create function public.embedding_worker_status()
returns jsonb language sql stable security definer set search_path='' as $$
with docs as (
  select d.content_hash,v.content_hash vector_hash from public.lot_search_documents d
    left join public.lot_embeddings v on v.lot_id=d.lot_id and v.model_version='multilingual-e5-base-v1'
  union all
  select d.content_hash,v.content_hash from public.buy_request_search_documents d
    left join public.buy_request_embeddings v on v.request_id=d.request_id and v.model_version='multilingual-e5-base-v1'
)
select jsonb_build_object('modelVersion','multilingual-e5-base-v1','documents',count(*),
  'currentVectors',count(*) filter(where content_hash=vector_hash),
  'missing',count(*) filter(where content_hash is distinct from vector_hash),
  'failedJobs',(select count(*) from logstar_private.embedding_jobs where status='FAILED' and model_version='multilingual-e5-base-v1'),
  'pendingJobs',(select count(*) from logstar_private.embedding_jobs where status in ('PENDING','LEASED') and model_version='multilingual-e5-base-v1')) from docs;
$$;

create function public.embedding_query_cache(text_hash text,encoded extensions.vector default null)
returns extensions.vector language plpgsql security definer set search_path='' as $$
declare result extensions.vector;
begin
  if text_hash is null or text_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid query hash'; end if;
  if encoded is not null then
    if extensions.vector_dims(encoded)<>768 or not (extensions.vector_norm(encoded) between 0.99 and 1.01) then
      raise exception 'Invalid normalized E5 vector';
    end if;
    insert into logstar_private.query_embeddings(text_hash,model_version,embedding)
      values(embedding_query_cache.text_hash,'multilingual-e5-base-v1',encoded)
      on conflict on constraint query_embeddings_pkey do update set embedding=excluded.embedding,created_at=now();
    return encoded;
  end if;
  select q.embedding into result from logstar_private.query_embeddings q
    where q.text_hash=embedding_query_cache.text_hash and q.model_version='multilingual-e5-base-v1';
  return result;
end;
$$;

revoke all on function public.embedding_worker_claim(integer) from public,anon,authenticated;
revoke all on function public.embedding_worker_finish(bigint,integer,extensions.vector) from public,anon,authenticated;
revoke all on function public.embedding_worker_status() from public,anon,authenticated;
revoke all on function public.embedding_query_cache(text,extensions.vector) from public,anon,authenticated;
grant execute on function public.embedding_worker_claim(integer),public.embedding_worker_finish(bigint,integer,extensions.vector),
  public.embedding_worker_status(),public.embedding_query_cache(text,extensions.vector) to service_role;
commit;
