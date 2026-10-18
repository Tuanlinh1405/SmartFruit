-- Apply only after storing the backend-only worker token in Vault as
-- smartfruit_embedding_worker_token and configuring the same Edge secret.
-- No key literals in saved queries or in the cron command.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule('smartfruit-embedding-worker','*/15 * * * *',$job$
  select logstar_private.requeue_missing_embeddings();
  select net.http_post(
    url := 'https://yyslykqpamnlqkvutrlm.supabase.co/functions/v1/process-embeddings',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
        where name='smartfruit_embedding_worker_token')),
    body := '{"limit":16}'::jsonb,
    timeout_milliseconds := 90000
  ) where exists (
    select 1 from logstar_private.embedding_jobs
    where model_version='multilingual-e5-base-v1' and next_retry_at<=now()
      and (status='PENDING' or (status='LEASED' and leased_until<now()))
  );
$job$);
