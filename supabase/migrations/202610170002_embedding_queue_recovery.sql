-- A -> B -> A must requeue A even if its earlier job already completed.
begin;
create or replace function logstar_private.enqueue_search_embedding()
returns trigger language plpgsql security definer set search_path='' as $$
declare item_id uuid;
begin
  if tg_op='UPDATE' and old.content_hash is not distinct from new.content_hash then return new; end if;
  item_id:=(to_jsonb(new)->>case when tg_argv[0]='lot' then 'lot_id' else 'request_id' end)::uuid;
  insert into logstar_private.embedding_jobs(target_kind,target_id,content_hash)
    values(tg_argv[0],item_id,new.content_hash)
  on conflict(target_kind,target_id,content_hash,model_version) do update set
    status='PENDING',attempts=0,next_retry_at=now(),leased_until=null,last_error=null,updated_at=now()
    where embedding_jobs.status not in ('PENDING','LEASED');
  return new;
end;
$$;

-- Called by cron, not by app users. Quota failures get another attempt the next day.
create function logstar_private.requeue_missing_embeddings()
returns void language sql security definer set search_path='' as $$
with docs as (
  select 'lot'::text kind,d.lot_id id,d.content_hash from public.lot_search_documents d
    where not exists(select 1 from public.lot_embeddings v where v.lot_id=d.lot_id
      and v.model_version='multilingual-e5-base-v1' and v.content_hash=d.content_hash)
  union all
  select 'buy_request',d.request_id,d.content_hash from public.buy_request_search_documents d
    where not exists(select 1 from public.buy_request_embeddings v where v.request_id=d.request_id
      and v.model_version='multilingual-e5-base-v1' and v.content_hash=d.content_hash)
)
insert into logstar_private.embedding_jobs(target_kind,target_id,content_hash)
select kind,id,content_hash from docs
on conflict(target_kind,target_id,content_hash,model_version) do update set
  status='PENDING',attempts=0,next_retry_at=now(),leased_until=null,last_error=null,updated_at=now()
where embedding_jobs.status in ('DONE','STALE')
  or (embedding_jobs.status='FAILED' and embedding_jobs.updated_at<now()-interval '24 hours');
$$;
revoke all on function logstar_private.requeue_missing_embeddings() from public,anon,authenticated;
grant execute on function logstar_private.requeue_missing_embeddings() to service_role;
commit;
