# Embedding service (prototype)

Latest decision (15 October): keep **multilingual-e5-base**, not Qwen. Query embedding → pgvector **cosine top 20** → exact/fuzzy word reranking → price/quantity scoring. The reranker never expands the vector candidate pool or replaces removed records with candidate 21. See [the current matching contract](../../docs/matching-e5-top20.md).

Local probe completed on 15 October 2026 with real CPU E5-small and E5-base: [report, cosine tables and figures](../../docs/benchmarks/e5-varieties-2026-10-15/README.md). This is a small synthetic closed-catalog probe, not production acceptance. No Supabase vectors were backfilled and hybrid remains off. The reusable scripts and frozen fixture are in `benchmarks/`; model files are ignored under `tmp/e5-models/`.

The model and worker run outside Supabase Edge Functions. The Edge function calls the private HTTP service for query vectors; the worker reads the private queue and writes passage vectors. Both use the same pinned `intfloat/multilingual-e5-base` revision, 768 dimensions, E5 prefixes and L2 normalization. The revision and usage convention come from the [model repository](https://huggingface.co/intfloat/multilingual-e5-base/tree/d13f1b27baf31030b7fd040960d60d909913633f) and [model card](https://huggingface.co/intfloat/multilingual-e5-base).

This service has **not** been deployed to a permanent host. Installing its Python dependencies downloads a large model on first use; choose a host/network budget before turning on hybrid mode. Do not put `DATABASE_URL` or `EMBEDDING_SERVICE_TOKEN` in the browser `.env.local` or Git.

On a private Python 3.11+ host:

```powershell
cd services/embedding
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
# Set DATABASE_URL and EMBEDDING_SERVICE_TOKEN in the host secret manager.
.venv/Scripts/python -m uvicorn api:app --host 127.0.0.1 --port 8080
.venv/Scripts/python worker.py
```

The inference server must be reachable from the `search-matches` Edge Function over HTTPS and require `EMBEDDING_SERVICE_TOKEN`. Set Edge secrets `EMBEDDING_SERVICE_URL`, `EMBEDDING_SERVICE_TOKEN` and optionally `SEARCH_ALLOWED_ORIGIN` on Supabase, then deploy `supabase/functions/search-matches`. The original hybrid migration is already applied to project `yyslykqpamnlqkvutrlm`; never reapply it there. The new `supabase/migrations/202610150003_vector_top20.sql` is locally tested and **not yet applied to cloud**; apply it once before deploying the new function. Only set `VITE_MATCHING_MODE=hybrid` after the new RPCs, function, inference service and worker are operational and checked with a real authenticated Buyer/Farmer account.

The queue starts with 11 pending demo jobs. A worker can claim up to 16 at once, back off on failure, and discards stale content hashes. The worker needs a trusted direct Postgres connection (`DATABASE_URL`); the browser never receives it. `python -m unittest discover -s services/embedding -p 'test_*.py'` runs model/worker tests with a fake encoder, without downloading the model. The SQL smoke test uses temporary synthetic vectors and rollback, so it does not prove real E5 quality or latency.
