-- LogStar hybrid matching. Apply after 202610140001_initial_schema.sql.
-- New derived data only; no existing lot/request rows are altered.
begin;

create extension if not exists vector with schema extensions;

create table public.fruit_type_aliases (
  id uuid primary key default gen_random_uuid(),
  fruit_type_id uuid not null references public.fruit_types(id) on delete cascade,
  alias text not null check (length(btrim(alias)) between 1 and 120),
  normalized_alias text generated always as (lower(btrim(alias))) stored,
  locale text not null default 'vi',
  unique (fruit_type_id, normalized_alias, locale)
);
create table public.fruit_variety_aliases (
  id uuid primary key default gen_random_uuid(),
  variety_id uuid not null references public.fruit_varieties(id) on delete cascade,
  alias text not null check (length(btrim(alias)) between 1 and 120),
  normalized_alias text generated always as (lower(btrim(alias))) stored,
  locale text not null default 'vi',
  unique (variety_id, normalized_alias, locale)
);

create table public.lot_search_documents (
  lot_id uuid primary key references public.lots(id) on delete cascade,
  canonical_text text not null,
  content_hash text not null,
  template_version text not null default 'lot-v1',
  search_vector tsvector generated always as (to_tsvector('simple'::regconfig, canonical_text)) stored,
  updated_at timestamptz not null default now()
);
create table public.buy_request_search_documents (
  request_id uuid primary key references public.buy_requests(id) on delete cascade,
  canonical_text text not null,
  content_hash text not null,
  template_version text not null default 'request-v1',
  search_vector tsvector generated always as (to_tsvector('simple'::regconfig, canonical_text)) stored,
  updated_at timestamptz not null default now()
);

create table public.lot_embeddings (
  lot_id uuid not null references public.lot_search_documents(lot_id) on delete cascade,
  model_version text not null,
  content_hash text not null,
  embedding extensions.vector(768) not null,
  embedded_at timestamptz not null default now(),
  primary key (lot_id, model_version)
);
create table public.buy_request_embeddings (
  request_id uuid not null references public.buy_request_search_documents(request_id) on delete cascade,
  model_version text not null,
  content_hash text not null,
  embedding extensions.vector(768) not null,
  embedded_at timestamptz not null default now(),
  primary key (request_id, model_version)
);

create table logstar_private.embedding_jobs (
  id bigint generated always as identity primary key,
  target_kind text not null check (target_kind in ('lot', 'buy_request')),
  target_id uuid not null,
  content_hash text not null,
  model_version text not null default 'multilingual-e5-base-v1',
  attempts integer not null default 0 check (attempts >= 0),
  status text not null default 'PENDING' check (status in ('PENDING','LEASED','DONE','FAILED','STALE')),
  next_retry_at timestamptz not null default now(),
  leased_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_kind, target_id, content_hash, model_version)
);
create index embedding_jobs_ready_idx on logstar_private.embedding_jobs(next_retry_at, id)
  where status in ('PENDING','LEASED');

create function logstar_private.enqueue_search_embedding()
returns trigger language plpgsql security definer set search_path = '' as $$
declare item_id uuid;
begin
  if tg_op='UPDATE' and old.content_hash is not distinct from new.content_hash then return new; end if;
  item_id := (to_jsonb(new)->>case when tg_argv[0]='lot' then 'lot_id' else 'request_id' end)::uuid;
  insert into logstar_private.embedding_jobs(target_kind, target_id, content_hash)
  values (tg_argv[0], item_id, new.content_hash)
  on conflict (target_kind, target_id, content_hash, model_version) do nothing;
  return new;
end;
$$;
create trigger enqueue_lot_embedding after insert or update of content_hash on public.lot_search_documents
  for each row
  execute function logstar_private.enqueue_search_embedding('lot');
create trigger enqueue_request_embedding after insert or update of content_hash on public.buy_request_search_documents
  for each row
  execute function logstar_private.enqueue_search_embedding('buy_request');

create function logstar_private.sync_lot_document_by_id(target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare document text; source_lot public.lots%rowtype;
begin
  select * into source_lot from public.lots where id=target_id;
  if not found then return; end if;
  select concat_ws('; ', 'Loại: ' || t.name,
    case when v.id is not null then 'Giống: ' || v.name end,
    'Tên: ' || source_lot.title,
    case when source_lot.grade is not null then 'Phân loại: ' || source_lot.grade end,
    case when source_lot.description <> '' then 'Mô tả: ' || source_lot.description end)
  into document
  from public.fruit_types t
  left join public.fruit_varieties v on v.id = source_lot.variety_id
  where t.id = source_lot.fruit_type_id;
  if document is null then raise exception 'Fruit catalog not found'; end if;
  insert into public.lot_search_documents(lot_id, canonical_text, content_hash)
  values (source_lot.id, document, md5('lot-v1:' || document))
  on conflict (lot_id) do update set canonical_text=excluded.canonical_text,
    content_hash=excluded.content_hash, updated_at=now()
  where public.lot_search_documents.content_hash is distinct from excluded.content_hash;
end;
$$;
create function logstar_private.sync_request_document_by_id(target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare document text; source_request public.buy_requests%rowtype;
begin
  select * into source_request from public.buy_requests where id=target_id;
  if not found then return; end if;
  select concat_ws('; ', 'Loại: ' || t.name,
    case when v.id is not null then 'Giống: ' || v.name end,
    'Tên: ' || source_request.title,
    case when source_request.grade is not null then 'Phân loại: ' || source_request.grade end,
    case when source_request.notes <> '' then 'Yêu cầu: ' || source_request.notes end)
  into document
  from public.fruit_types t
  left join public.fruit_varieties v on v.id = source_request.variety_id
  where t.id = source_request.fruit_type_id;
  if document is null then raise exception 'Fruit catalog not found'; end if;
  insert into public.buy_request_search_documents(request_id, canonical_text, content_hash)
  values (source_request.id, document, md5('request-v1:' || document))
  on conflict (request_id) do update set canonical_text=excluded.canonical_text,
    content_hash=excluded.content_hash, updated_at=now()
  where public.buy_request_search_documents.content_hash is distinct from excluded.content_hash;
end;
$$;
create function logstar_private.sync_lot_search_document()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform logstar_private.sync_lot_document_by_id(new.id);
  return new;
end;
$$;
create function logstar_private.sync_request_search_document()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform logstar_private.sync_request_document_by_id(new.id);
  return new;
end;
$$;
create trigger sync_lot_search_document after insert or update of
  fruit_type_id, variety_id, title, grade, description on public.lots
  for each row execute function logstar_private.sync_lot_search_document();
create trigger sync_request_search_document after insert or update of
  fruit_type_id, variety_id, title, grade, notes on public.buy_requests
  for each row execute function logstar_private.sync_request_search_document();

-- A catalog rename changes canonical text for all dependent records.
create function logstar_private.refresh_catalog_documents()
returns trigger language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  if tg_table_name='fruit_types' then
    for item in select * from public.lots where fruit_type_id=new.id loop
      perform logstar_private.sync_lot_document_by_id(item.id);
    end loop;
    for item in select * from public.buy_requests where fruit_type_id=new.id loop
      perform logstar_private.sync_request_document_by_id(item.id);
    end loop;
  else
    for item in select * from public.lots where variety_id=new.id loop
      perform logstar_private.sync_lot_document_by_id(item.id);
    end loop;
    for item in select * from public.buy_requests where variety_id=new.id loop
      perform logstar_private.sync_request_document_by_id(item.id);
    end loop;
  end if;
  return new;
end;
$$;

-- The schema is usable by authenticated for older policy helpers; do not expose
-- these SECURITY DEFINER maintenance functions as directly callable APIs.
revoke all on function logstar_private.enqueue_search_embedding(),
  logstar_private.sync_lot_document_by_id(uuid),
  logstar_private.sync_request_document_by_id(uuid),
  logstar_private.sync_lot_search_document(),
  logstar_private.sync_request_search_document(),
  logstar_private.refresh_catalog_documents()
  from public, anon, authenticated;

create trigger refresh_type_documents after update of name on public.fruit_types
  for each row when (old.name is distinct from new.name)
  execute function logstar_private.refresh_catalog_documents();
create trigger refresh_variety_documents after update of name on public.fruit_varieties
  for each row when (old.name is distinct from new.name)
  execute function logstar_private.refresh_catalog_documents();

-- Existing rows are indexed without touching business records.
do $$ declare item record; begin
  for item in select id from public.lots loop
    perform logstar_private.sync_lot_document_by_id(item.id);
  end loop;
  for item in select id from public.buy_requests loop
    perform logstar_private.sync_request_document_by_id(item.id);
  end loop;
end $$;

create index lot_search_lexical_idx on public.lot_search_documents using gin(search_vector);
create index request_search_lexical_idx on public.buy_request_search_documents using gin(search_vector);
create index lot_embeddings_exact_lookup_idx on public.lot_embeddings(model_version, lot_id);
create index request_embeddings_exact_lookup_idx on public.buy_request_embeddings(model_version, request_id);
-- Add HNSW only after exact-vs-approximate recall and latency have been measured.

alter table public.fruit_type_aliases enable row level security;
alter table public.fruit_variety_aliases enable row level security;
alter table public.lot_search_documents enable row level security;
alter table public.buy_request_search_documents enable row level security;
alter table public.lot_embeddings enable row level security;
alter table public.buy_request_embeddings enable row level security;
alter table logstar_private.embedding_jobs enable row level security;
revoke all on public.fruit_type_aliases, public.fruit_variety_aliases,
  public.lot_search_documents, public.buy_request_search_documents,
  public.lot_embeddings, public.buy_request_embeddings from public, anon, authenticated;
grant select on public.fruit_type_aliases, public.fruit_variety_aliases,
  public.lot_search_documents, public.buy_request_search_documents,
  public.lot_embeddings, public.buy_request_embeddings to authenticated;
grant all on public.fruit_type_aliases, public.fruit_variety_aliases,
  public.lot_search_documents, public.buy_request_search_documents,
  public.lot_embeddings, public.buy_request_embeddings to service_role;
grant all on logstar_private.embedding_jobs to service_role;
grant usage, select on sequence logstar_private.embedding_jobs_id_seq to service_role;

create policy read_type_aliases on public.fruit_type_aliases for select to authenticated using (true);
create policy read_variety_aliases on public.fruit_variety_aliases for select to authenticated using (true);
create policy read_lot_document on public.lot_search_documents for select to authenticated
  using (exists (select 1 from public.lots l where l.id=lot_id));
create policy read_request_document on public.buy_request_search_documents for select to authenticated
  using (exists (select 1 from public.buy_requests r where r.id=request_id));
create policy read_lot_embedding on public.lot_embeddings for select to authenticated
  using (exists (select 1 from public.lots l where l.id=lot_id));
create policy read_request_embedding on public.buy_request_embeddings for select to authenticated
  using (exists (select 1 from public.buy_requests r where r.id=request_id));

-- Aliases are curated catalog entries; collisions across different varieties remain visible.
insert into public.fruit_type_aliases(fruit_type_id, alias)
select id, name from public.fruit_types on conflict do nothing;
insert into public.fruit_variety_aliases(variety_id, alias)
select id, name from public.fruit_varieties on conflict do nothing;

-- SQL SECURITY INVOKER: the caller's grants/RLS remain in force.
create function public.search_lot_candidates(
  source_request_id uuid, query_embedding extensions.vector(768), query_text text,
  active_model_version text default 'multilingual-e5-base-v1'
)
returns table(lot_id uuid, semantic_rank bigint, lexical_rank bigint,
  eligible_count bigint, truncated boolean, graph_paths text[])
language sql stable security invoker set search_path = '' as $$
with source as (
  select r.* from public.buy_requests r
  where r.id=source_request_id and r.buyer_id=(select auth.uid())
    and r.status in ('OPEN','DRAFT')
), eligible as materialized (
  select l.id, l.fruit_type_id, l.variety_id from public.lots l cross join source r
  where l.status='PUBLISHED' and l.fruit_type_id=r.fruit_type_id
    and (r.variety_id is null or l.variety_id=r.variety_id)
    and l.harvest_start<=r.required_end and l.harvest_end>=r.required_start
    and (r.min_lot_quantity_kg is null or l.quantity_kg>=r.min_lot_quantity_kg)
    and (r.allow_partial or l.quantity_kg>=r.target_quantity_kg)
), alias_match as (
  select a.variety_id from public.fruit_variety_aliases a
  where a.normalized_alias=lower(btrim(query_text))
), semantic_top as (
  select e.id, row_number() over (order by e.distance, e.id) as rank from (
    select x.id, (v.embedding operator(extensions.<=>) query_embedding) as distance
    from eligible x join public.lot_embeddings v on v.lot_id=x.id
    join public.lot_search_documents d on d.lot_id=x.id
    where query_embedding is not null and v.model_version=active_model_version
      and v.content_hash=d.content_hash
    order by v.embedding operator(extensions.<=>) query_embedding, x.id limit 200
  ) e
), lexical_top as (
  select e.id, row_number() over (order by e.lexical_score desc, e.id) as rank from (
    select x.id, ts_rank_cd(d.search_vector, plainto_tsquery('simple'::regconfig, query_text)) as lexical_score
    from eligible x join public.lot_search_documents d on d.lot_id=x.id
    where nullif(btrim(query_text),'') is not null
      and d.search_vector @@ plainto_tsquery('simple'::regconfig, query_text)
    order by lexical_score desc, x.id limit 200
  ) e
), graph_top as (select id from eligible order by id limit 1000),
pool as (
  select id from semantic_top union select id from lexical_top union select id from graph_top
)
select p.id, s.rank, k.rank, (select count(*) from eligible),
  (select count(*) from eligible) > (select count(*) from pool),
  case when exists (select 1 from eligible x join alias_match a on a.variety_id=x.variety_id
    where x.id=p.id) then array['Từ khóa → tên gọi giống → giống → lô']::text[]
    when exists (select 1 from eligible x where x.id=p.id and x.variety_id is not null)
      then array['Nhu cầu → giống → lô']::text[]
    else array['Nhu cầu → loại nông sản → lô']::text[] end
from pool p left join semantic_top s on s.id=p.id
left join lexical_top k on k.id=p.id
order by p.id limit 1400;
$$;
revoke all on function public.search_lot_candidates(uuid,extensions.vector,text,text) from public, anon;
grant execute on function public.search_lot_candidates(uuid,extensions.vector,text,text) to authenticated;

-- Reverse traversal: a Farmer's own published lot -> eligible open Buyer requests.
create function public.search_request_candidates(
  source_lot_id uuid, query_embedding extensions.vector(768), query_text text,
  active_model_version text default 'multilingual-e5-base-v1'
)
returns table(request_id uuid, semantic_rank bigint, lexical_rank bigint,
  eligible_count bigint, truncated boolean, graph_paths text[])
language sql stable security invoker set search_path = '' as $$
with source as (
  select l.* from public.lots l
  where l.id=source_lot_id and l.farmer_id=(select auth.uid())
    and l.status='PUBLISHED'
), eligible as materialized (
  select r.id, r.variety_id from public.buy_requests r cross join source l
  where r.status='OPEN' and r.fruit_type_id=l.fruit_type_id
    and (r.variety_id is null or l.variety_id=r.variety_id)
    and l.harvest_start<=r.required_end and l.harvest_end>=r.required_start
    and (r.min_lot_quantity_kg is null or l.quantity_kg>=r.min_lot_quantity_kg)
    and (r.allow_partial or l.quantity_kg>=r.target_quantity_kg)
), alias_match as (
  select a.variety_id from public.fruit_variety_aliases a
  where a.normalized_alias=lower(btrim(query_text))
), semantic_top as (
  select e.id, row_number() over (order by e.distance, e.id) as rank from (
    select x.id, (v.embedding operator(extensions.<=>) query_embedding) as distance
    from eligible x join public.buy_request_embeddings v on v.request_id=x.id
    join public.buy_request_search_documents d on d.request_id=x.id
    where query_embedding is not null and v.model_version=active_model_version
      and v.content_hash=d.content_hash
    order by v.embedding operator(extensions.<=>) query_embedding, x.id limit 200
  ) e
), lexical_top as (
  select e.id, row_number() over (order by e.lexical_score desc, e.id) as rank from (
    select x.id, ts_rank_cd(d.search_vector, plainto_tsquery('simple'::regconfig, query_text)) as lexical_score
    from eligible x join public.buy_request_search_documents d on d.request_id=x.id
    where nullif(btrim(query_text),'') is not null
      and d.search_vector @@ plainto_tsquery('simple'::regconfig, query_text)
    order by lexical_score desc, x.id limit 200
  ) e
), graph_top as (select id from eligible order by id limit 1000),
pool as (select id from semantic_top union select id from lexical_top union select id from graph_top)
select p.id, s.rank, k.rank, (select count(*) from eligible),
  (select count(*) from eligible) > (select count(*) from pool),
  case when exists (select 1 from eligible x join alias_match a on a.variety_id=x.variety_id
    where x.id=p.id) then array['Từ khóa → tên gọi giống → giống → nhu cầu']::text[]
    when exists (select 1 from eligible x where x.id=p.id and x.variety_id is not null)
      then array['Lô → giống → nhu cầu']::text[]
    else array['Lô → loại nông sản → nhu cầu']::text[] end
from pool p left join semantic_top s on s.id=p.id
left join lexical_top k on k.id=p.id
order by p.id limit 1400;
$$;
revoke all on function public.search_request_candidates(uuid,extensions.vector,text,text) from public, anon;
grant execute on function public.search_request_candidates(uuid,extensions.vector,text,text) to authenticated;

commit;
