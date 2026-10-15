-- READ ONLY. Run on project yyslykqpamnlqkvutrlm before the initial migration.
select current_database() as database_name, version() as postgres_version;

select table_schema, table_name
from information_schema.tables
where table_schema in ('public', 'logstar_private')
order by table_schema, table_name;

select n.nspname as schema_name, t.typname as type_name
from pg_type t join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typname in
  ('app_role','lot_status','buy_request_status','trade_method','transport_responsibility','vehicle_type');

-- Existing permissive policies could also allow access to a NEW bucket.
-- Review these policies before adding ours; do not assume policies are exclusive.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'lot-images';

select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;

select count(*) as existing_auth_accounts from auth.users;
