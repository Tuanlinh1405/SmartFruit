-- Run inside the transaction begun by 202610150001_hybrid_search.sql,
-- replacing its final COMMIT with this script and ROLLBACK.
do $$ declare actual integer; begin
  select count(*) into actual from public.lot_search_documents;
  if actual <> (select count(*) from public.lots) then
    raise exception 'Lot documents were not backfilled: %', actual;
  end if;
  select count(*) into actual from public.buy_request_search_documents;
  if actual <> (select count(*) from public.buy_requests) then
    raise exception 'Request documents were not backfilled: %', actual;
  end if;
  select count(*) into actual from logstar_private.embedding_jobs;
  if actual <> (select count(*) from public.lots) + (select count(*) from public.buy_requests) then
    raise exception 'Embedding jobs were not queued: %', actual;
  end if;
  if has_function_privilege('authenticated', 'logstar_private.sync_lot_document_by_id(uuid)', 'EXECUTE') then
    raise exception 'Private maintenance function is callable by authenticated';
  end if;
  if not (select proconfig @> array['search_path=""'] from pg_proc
    where oid='logstar_private.sync_lot_document_by_id(uuid)'::regprocedure) then
    raise exception 'Security definer search_path is not pinned';
  end if;
end $$;

-- Two temporary non-zero vectors exercise pgvector's cosine operator and hash gate.
insert into public.lot_embeddings(lot_id,model_version,content_hash,embedding)
select d.lot_id,'multilingual-e5-base-v1',d.content_hash,
  ('[' || array_to_string(array_fill('0.01'::text,array[768]), ',') || ']')::extensions.vector(768)
from public.lot_search_documents d where d.lot_id='72000000-0000-4000-8000-000000000001';
insert into public.buy_request_embeddings(request_id,model_version,content_hash,embedding)
select d.request_id,'multilingual-e5-base-v1',d.content_hash,
  ('[' || array_to_string(array_fill('0.01'::text,array[768]), ',') || ']')::extensions.vector(768)
from public.buy_request_search_documents d where d.request_id='73000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000004',true);
do $$ declare actual integer; begin
  select count(*) into actual from public.lot_search_documents;
  if actual <> 4 then raise exception 'Buyer may read % lot documents, expected 4', actual; end if;
  select count(*) into actual from public.buy_request_search_documents;
  if actual <> 2 then raise exception 'Buyer may read % request documents, expected 2', actual; end if;
  select count(*) into actual from public.search_lot_candidates(
    '73000000-0000-4000-8000-000000000001', null::extensions.vector(768), 'Ri6');
  if actual <> 1 then raise exception 'Ri6 graph/keyword candidate count was %, expected 1', actual; end if;
  select count(*) into actual from public.search_lot_candidates(
    '73000000-0000-4000-8000-000000000001', null::extensions.vector(768), 'Ri6')
    where graph_paths[1] like 'Từ khóa%';
  if actual <> 1 then raise exception 'Buyer alias graph path was not resolved'; end if;
  select count(*) into actual from public.search_lot_candidates(
    '73000000-0000-4000-8000-000000000001',
    ('[' || array_to_string(array_fill('0.01'::text,array[768]), ',') || ']')::extensions.vector(768), 'Ri6')
    where semantic_rank=1;
  if actual <> 1 then raise exception 'Buyer semantic branch did not find Ri6'; end if;
  select count(*) into actual from public.search_lot_candidates(
    '73000000-0000-4000-8000-000000000003', null::extensions.vector(768), 'Ri6');
  if actual <> 0 then raise exception 'Buyer could search another Buyer request'; end if;
end $$;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
do $$ declare actual integer; begin
  select count(*) into actual from public.search_request_candidates(
    '72000000-0000-4000-8000-000000000001', null::extensions.vector(768), 'Ri6');
  if actual <> 1 then raise exception 'Farmer candidate count was %, expected 1', actual; end if;
  select count(*) into actual from public.search_request_candidates(
    '72000000-0000-4000-8000-000000000001', null::extensions.vector(768), 'Ri6')
    where graph_paths[1] like 'Từ khóa%';
  if actual <> 1 then raise exception 'Farmer alias graph path was not resolved'; end if;
  select count(*) into actual from public.search_request_candidates(
    '72000000-0000-4000-8000-000000000001',
    ('[' || array_to_string(array_fill('0.01'::text,array[768]), ',') || ']')::extensions.vector(768), 'Ri6')
    where semantic_rank=1;
  if actual <> 1 then raise exception 'Farmer semantic branch did not find Ri6'; end if;
  select count(*) into actual from public.search_request_candidates(
    '72000000-0000-4000-8000-000000000003', null::extensions.vector(768), 'Ri6');
  if actual <> 0 then raise exception 'Farmer could search another Farmer lot'; end if;
end $$;
reset role;
rollback;
