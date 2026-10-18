-- READ ONLY. This confirms deployed structure, not Auth/Storage HTTP behavior.
with expected(name) as (values
  ('profiles'),('farmer_profiles'),('buyer_profiles'),('carrier_profiles'),
  ('marketplace_profiles'),('fruit_types'),('fruit_varieties'),('lots'),
  ('lot_private_details'),('buy_requests'),('vehicles'),('lot_images')
)
select e.name as table_name, c.oid is not null as exists,
  coalesce(c.relrowsecurity,false) as rls_enabled,
  (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
from expected e left join pg_class c
  on c.oid = to_regclass('public.' || e.name)
order by e.name;

select code, name from public.fruit_types order by code;
select t.code as fruit_type, v.code as variety, v.name
from public.fruit_varieties v join public.fruit_types t on t.id = v.fruit_type_id
order by t.code, v.code;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'lot-images';

select n.nspname as function_schema, p.proname, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'logstar_private' order by p.proname;

select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and tgname = 'logstar_auth_user_created';

select count(*) as auth_users_missing_profile
from auth.users u left join public.profiles p on p.id = u.id where p.id is null;

select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and grantee in ('anon','PUBLIC')
  and table_name in ('profiles','farmer_profiles','buyer_profiles','carrier_profiles',
    'marketplace_profiles','fruit_types','fruit_varieties','lots','lot_private_details',
    'buy_requests','vehicles','lot_images');
-- Expected: zero rows for anonymous table grants; 12 RLS-enabled application tables.

-- A image-lifecycle installation check (read-only; NULL means not installed).
select to_regprocedure('public.replace_lot_image(uuid,text)') as replace_image_rpc,
       to_regprocedure('public.delete_empty_lot(uuid)') as delete_empty_lot_rpc,
       to_regprocedure('public.prepare_lot_deletion(uuid)') as prepare_lot_deletion_rpc;
