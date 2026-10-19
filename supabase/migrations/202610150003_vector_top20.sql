-- E5 cosine retrieval only. Text matching reranks these 20 records in the service.
-- Apply after 202610150001_hybrid_search.sql. Existing candidate RPCs remain for degraded mode.
begin;

create function public.search_lot_vector_top20(
  source_request_id uuid, query_embedding extensions.vector(768),
  active_model_version text default 'multilingual-e5-base-v1'
)
returns table(lot_id uuid, cosine_similarity double precision,
  eligible_count bigint, truncated boolean, graph_paths text[])
language sql stable security invoker set search_path = '' as $$
with source as (
  select r.* from public.buy_requests r
  where r.id=source_request_id and r.buyer_id=(select auth.uid())
    and r.status in ('OPEN','DRAFT')
), eligible as materialized (
  select l.id, l.variety_id,
    v.embedding operator(extensions.<=>) query_embedding as distance
  from public.lots l
  join public.lot_embeddings v on v.lot_id=l.id
  join public.lot_search_documents d on d.lot_id=l.id and d.content_hash=v.content_hash
  cross join source r
  where query_embedding is not null and v.model_version=active_model_version
    and l.status='PUBLISHED' and l.fruit_type_id=r.fruit_type_id
    and (r.variety_id is null or l.variety_id=r.variety_id)
    and l.harvest_start<=r.required_end and l.harvest_end>=r.required_start
    and (r.min_lot_quantity_kg is null or l.quantity_kg>=r.min_lot_quantity_kg)
    and (r.allow_partial or l.quantity_kg>=r.target_quantity_kg)
), top20 as (
  select e.*, count(*) over () as total from eligible e
  where e.distance between 0 and 2
  order by e.distance, e.id limit 20
)
select t.id, 1.0-t.distance, t.total, t.total>20,
  case when t.variety_id is null then array['Vector E5 → loại nông sản → lô']::text[]
    else array['Vector E5 → giống → lô']::text[] end
from top20 t order by t.distance, t.id;
$$;
revoke all on function public.search_lot_vector_top20(uuid,extensions.vector,text) from public, anon;
grant execute on function public.search_lot_vector_top20(uuid,extensions.vector,text) to authenticated;

create function public.search_request_vector_top20(
  source_lot_id uuid, query_embedding extensions.vector(768),
  active_model_version text default 'multilingual-e5-base-v1'
)
returns table(request_id uuid, cosine_similarity double precision,
  eligible_count bigint, truncated boolean, graph_paths text[])
language sql stable security invoker set search_path = '' as $$
with source as (
  select l.* from public.lots l
  where l.id=source_lot_id and l.farmer_id=(select auth.uid()) and l.status='PUBLISHED'
), eligible as materialized (
  select r.id, r.variety_id,
    v.embedding operator(extensions.<=>) query_embedding as distance
  from public.buy_requests r
  join public.buy_request_embeddings v on v.request_id=r.id
  join public.buy_request_search_documents d on d.request_id=r.id and d.content_hash=v.content_hash
  cross join source l
  where query_embedding is not null and v.model_version=active_model_version
    and r.status='OPEN' and r.fruit_type_id=l.fruit_type_id
    and (r.variety_id is null or r.variety_id=l.variety_id)
    and l.harvest_start<=r.required_end and l.harvest_end>=r.required_start
    and (r.min_lot_quantity_kg is null or l.quantity_kg>=r.min_lot_quantity_kg)
    and (r.allow_partial or l.quantity_kg>=r.target_quantity_kg)
), top20 as (
  select e.*, count(*) over () as total from eligible e
  where e.distance between 0 and 2
  order by e.distance, e.id limit 20
)
select t.id, 1.0-t.distance, t.total, t.total>20,
  case when t.variety_id is null then array['Vector E5 → loại nông sản → nhu cầu']::text[]
    else array['Vector E5 → giống → nhu cầu']::text[] end
from top20 t order by t.distance, t.id;
$$;
revoke all on function public.search_request_vector_top20(uuid,extensions.vector,text) from public, anon;
grant execute on function public.search_request_vector_top20(uuid,extensions.vector,text) to authenticated;

commit;
