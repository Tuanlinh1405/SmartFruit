"""Backend-only queue maintenance, without reading business text into logs."""
from model import MODEL_VERSION

DOCUMENTS = """
with documents as (
  select 'lot'::text as kind, d.lot_id as id, d.content_hash from public.lot_search_documents d
  union all
  select 'buy_request', d.request_id, d.content_hash from public.buy_request_search_documents d
), missing as (
  select d.* from documents d
  left join public.lot_embeddings l on d.kind='lot' and l.lot_id=d.id
    and l.content_hash=d.content_hash and l.model_version=%s
  left join public.buy_request_embeddings r on d.kind='buy_request' and r.request_id=d.id
    and r.content_hash=d.content_hash and r.model_version=%s
  where l.lot_id is null and r.request_id is null
)
"""


COVERAGE_SQL = DOCUMENTS + """
      select (select count(*) from documents) as documents, (select count(*) from missing) as missing,
        (select count(*) from logstar_private.embedding_jobs where model_version=%s and status='FAILED') as failed_jobs
    """
ENQUEUE_SQL = DOCUMENTS + """
    insert into logstar_private.embedding_jobs(target_kind,target_id,content_hash,model_version)
    select kind,id,content_hash,%s from missing
    on conflict(target_kind,target_id,content_hash,model_version) do update set
      status='PENDING',attempts=0,next_retry_at=now(),leased_until=null,last_error=null,updated_at=now()
    where embedding_jobs.status not in ('PENDING','LEASED')
    returning id
"""


def coverage(connection) -> dict:
    row = connection.execute(COVERAGE_SQL, (MODEL_VERSION,) * 3).fetchone()
    return {"modelVersion": MODEL_VERSION, "documents": row[0],
            "missing": row[1], "currentVectors": row[0] - row[1], "failedJobs": row[2]}


def enqueue_missing(connection) -> int:
    with connection.transaction():
        rows = connection.execute(ENQUEUE_SQL, (MODEL_VERSION,) * 3).fetchall()
    return len(rows)
