"""Claim and encode derived documents; run separately from the web server."""
from __future__ import annotations

import os
import argparse
import json
import signal
import time
from dataclasses import dataclass

from model import Encoder, MODEL_VERSION, validate_vectors


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
    if job.kind not in ("lot", "buy_request"):
        raise ValueError("Unsupported job kind")
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


def run_once(connection, encoder: Encoder, limit: int = 16) -> dict[str, int]:
    if not 1 <= limit <= 16:
        raise ValueError("limit must be between 1 and 16")
    jobs = claim_jobs(connection, limit)
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
            vectors = validate_vectors(encoder.encode([text for _, text in ready], "passage"), len(ready))
        except Exception:
            failed = True
    for index, (job, _) in enumerate(ready):
        # finish_job checks the hash after encoding and before storing the vector.
        result = finish_job(connection, job, None if failed else vectors[index], failed)
        outcome[result] = outcome.get(result, 0) + 1
    return outcome


def main() -> None:
    import psycopg
    from maintenance import coverage, enqueue_missing

    parser = argparse.ArgumentParser(description="E5 queue worker; no text or secrets in logs")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--once", action="store_true", help="process one batch")
    modes.add_argument("--drain", action="store_true", help="bounded backfill; fail if coverage incomplete")
    modes.add_argument("--status", action="store_true", help="read counts without loading model")
    modes.add_argument("--enqueue-missing", action="store_true", help="queue missing/current vectors")
    parser.add_argument("--limit", type=int, choices=range(1, 17), default=4)
    parser.add_argument("--max-batches", type=int, default=100)
    args = parser.parse_args()
    if args.max_batches < 1:
        parser.error("--max-batches must be positive")

    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required on the worker host")
    stopping = False
    def stop(*_):
        nonlocal stopping
        stopping = True
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    encoder = None
    batches = failures = 0
    while not stopping:
        try:
            with psycopg.connect(url, autocommit=True, connect_timeout=15) as connection:
                if args.status or args.enqueue_missing:
                    if args.enqueue_missing:
                        print(json.dumps({"enqueued": enqueue_missing(connection)}), flush=True)
                    print(json.dumps(coverage(connection)), flush=True)
                    return
                if encoder is None:
                    encoder = Encoder()
                while not stopping:
                    result = run_once(connection, encoder, args.limit)
                    failures = 0
                    batches += 1
                    print(json.dumps({"batch": batches, "outcome": result}), flush=True)
                    if args.once:
                        raise SystemExit(1 if result.get("PENDING", 0) or result.get("FAILED", 0) else 0)
                    if args.drain and (not result or batches >= args.max_batches):
                        report = coverage(connection)
                        print(json.dumps(report), flush=True)
                        raise SystemExit(0 if report["missing"] == 0 else 2)
                    if not result:
                        time.sleep(5)
        except (psycopg.Error, OSError):
            failures += 1
            # Driver exceptions can contain credentials; never log their message.
            print(json.dumps({"error": "database-unavailable", "retry": failures}), flush=True)
            if args.once or args.drain or args.status or args.enqueue_missing:
                raise SystemExit(1) from None
            time.sleep(min(30, 2 ** min(failures, 5)))


if __name__ == "__main__":
    main()
