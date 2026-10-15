"""Claim and encode derived documents; run separately from the web server."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass

from model import Encoder, MODEL_VERSION


@dataclass(frozen=True)
class Job:
    id: int
    kind: str
    target_id: str
    content_hash: str
    attempts: int


def claim_jobs(connection, limit: int = 16) -> list[Job]:
    with connection.transaction():
        rows = connection.execute(
            """with picked as (
              select id from logstar_private.embedding_jobs
              where model_version=%s and next_retry_at<=now()
                and (status='PENDING' or (status='LEASED' and leased_until<now()))
              order by id for update skip locked limit %s
            )
            update logstar_private.embedding_jobs j set status='LEASED',
              attempts=j.attempts+1, leased_until=now()+interval '10 minutes',
              updated_at=now() from picked where j.id=picked.id
            returning j.id,j.target_kind,j.target_id,j.content_hash,j.attempts""",
            (MODEL_VERSION, limit),
        ).fetchall()
    return [Job(*row) for row in rows]


def document_for_job(connection, job: Job):
    table, key = (
        ("public.lot_search_documents", "lot_id") if job.kind == "lot"
        else ("public.buy_request_search_documents", "request_id")
    )
    return connection.execute(
        f"select canonical_text,content_hash from {table} where {key}=%s", (job.target_id,)
    ).fetchone()


def finish_job(connection, job: Job, vector: list[float] | None,
               failed: bool = False) -> str:
    """Recheck hash and lease generation under a lock before writing a vector."""
    table, key = (
        ("public.lot_embeddings", "lot_id") if job.kind == "lot"
        else ("public.buy_request_embeddings", "request_id")
    )
    with connection.transaction():
        lease = connection.execute(
            "select status,attempts from logstar_private.embedding_jobs where id=%s for update", (job.id,)
        ).fetchone()
        if lease != ("LEASED", job.attempts):
            return "LOST_LEASE"
        doc = document_for_job(connection, job)
        if doc is None or doc[1] != job.content_hash:
            status = "STALE"
        elif vector is None:
            status = "PENDING" if job.attempts < 5 else "FAILED"
        else:
            connection.execute(
                f"""insert into {table}({key},model_version,content_hash,embedding)
                values (%s,%s,%s,%s::extensions.vector)
                on conflict ({key},model_version) do update set
                  content_hash=excluded.content_hash,embedding=excluded.embedding,
                  embedded_at=now()""",
                (job.target_id, MODEL_VERSION, job.content_hash,
                 "[" + ",".join(str(value) for value in vector) + "]"),
            )
            status = "DONE"
        connection.execute(
            """update logstar_private.embedding_jobs set status=%s,
              next_retry_at=case when %s='PENDING' then now()+make_interval(secs=>least(300,power(2,attempts)::int*5))
                else next_retry_at end,
              last_error=case when %s then 'embedding-failed' else null end,
              leased_until=null,updated_at=now() where id=%s""",
            (status, status, failed, job.id),
        )
    return status


def run_once(connection, encoder: Encoder) -> dict[str, int]:
    jobs = claim_jobs(connection)
    outcome: dict[str, int] = {}
    ready: list[tuple[Job, str]] = []
    for job in jobs:
        with connection.transaction():
            doc = document_for_job(connection, job)
        if doc and doc[1] == job.content_hash:
            ready.append((job, doc[0]))
        else:
            result = finish_job(connection, job, None)
            outcome[result] = outcome.get(result, 0) + 1
    vectors: list[list[float]] = []
    failed = False
    if ready:
        try:
            vectors = encoder.encode([text for _, text in ready], "passage")
        except Exception:
            failed = True
    for index, (job, _) in enumerate(ready):
        # finish_job checks the hash after encoding and before storing the vector.
        result = finish_job(connection, job, None if failed else vectors[index], failed)
        outcome[result] = outcome.get(result, 0) + 1
    return outcome


def main() -> None:
    import psycopg

    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required on the worker host")
    encoder = Encoder()
    with psycopg.connect(url, autocommit=True) as connection:
        while True:
            result = run_once(connection, encoder)
            if not result:
                time.sleep(5)


if __name__ == "__main__":
    main()
