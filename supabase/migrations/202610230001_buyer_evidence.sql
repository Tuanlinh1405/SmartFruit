-- Private business profile and owner-only supporting images. No verification workflow.
begin;
alter table public.buyer_profiles
  add column business_phone text check(business_phone is null or business_phone ~ '^\+84[0-9]{9}$'),
  add column business_email text check(business_email is null or (length(business_email)<=254 and business_email ~ '^[^ @]+@[^ @]+\.[^ @]+$')),
  add column tax_code text check(tax_code is null or tax_code ~ '^([0-9]{10}|[0-9]{13})$'),
  add column business_license text check(business_license is null or length(btrim(business_license)) between 1 and 160),
  add column representative_name text check(representative_name is null or length(btrim(representative_name)) between 1 and 160),
  add column production_certificate text check(production_certificate is null or length(production_certificate)<=200),
  add column attested_at timestamptz;

create table public.buyer_evidence (
  user_id uuid not null references public.buyer_profiles(user_id) on delete cascade,
  path text primary key,
  label text not null check(length(btrim(label)) between 1 and 160),
  position integer not null check(position between 0 and 9),
  check(path like user_id::text||'/%')
);
alter table public.buyer_evidence enable row level security;
revoke all on public.buyer_evidence from public,anon,authenticated;
grant select on public.buyer_evidence to authenticated;
grant all on public.buyer_evidence to service_role;
create policy evidence_owner_read on public.buyer_evidence for select to authenticated
using(user_id=auth.uid() and logstar_private.current_app_role()='BUYER');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('buyer-evidence','buyer-evidence',false,5242880,array['image/jpeg','image/png']);
create policy buyer_evidence_upload on storage.objects for insert to authenticated
with check(bucket_id='buyer-evidence' and split_part(name,'/',1)=auth.uid()::text and logstar_private.current_app_role()='BUYER');
create policy buyer_evidence_download on storage.objects for select to authenticated
using(bucket_id='buyer-evidence' and split_part(name,'/',1)=auth.uid()::text and logstar_private.current_app_role()='BUYER');
create policy buyer_evidence_cleanup on storage.objects for delete to authenticated
using(bucket_id='buyer-evidence' and split_part(name,'/',1)=auth.uid()::text and logstar_private.current_app_role()='BUYER'
and not exists(select 1 from public.buyer_evidence e where e.path=name));

create function public.save_buyer_business_profile(details jsonb,evidence jsonb,attested boolean)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); item jsonb;
begin
  if logstar_private.current_app_role() is distinct from 'BUYER' then raise exception 'Buyer required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=uid for update;
  if attested is distinct from true then raise exception 'Please attest to the profile information' using errcode='23514'; end if;
  if jsonb_typeof(details) is distinct from 'object' or jsonb_typeof(evidence) is distinct from 'array' then raise exception 'Invalid profile' using errcode='23514'; end if;
  if jsonb_array_length(evidence)>10 or
    (select count(distinct x->>'path') from jsonb_array_elements(evidence) x)<>jsonb_array_length(evidence)
    then raise exception 'Invalid evidence count' using errcode='23514'; end if;
  if length(btrim(coalesce(details->>'full_name',''))) not between 1 and 160
    or coalesce(details->>'business_phone','') !~ '^\+84[0-9]{9}$'
    or coalesce(details->>'tax_code','') !~ '^([0-9]{10}|[0-9]{13})$'
    or length(btrim(coalesce(details->>'business_license',''))) not between 1 and 160
    or length(btrim(coalesce(details->>'representative_name',''))) not between 1 and 160
    then raise exception 'Required business profile fields are invalid' using errcode='23514'; end if;
  for item in select * from jsonb_array_elements(evidence) loop
    if coalesce(item->>'path','') not like uid::text||'/%'
      or not exists(select 1 from storage.objects o where o.bucket_id='buyer-evidence' and o.name=item->>'path')
      or length(btrim(coalesce(item->>'label',''))) not between 1 and 160
      then raise exception 'Invalid evidence image' using errcode='23514'; end if;
  end loop;
  update public.profiles set full_name=btrim(details->>'full_name') where id=uid;
  insert into public.buyer_profiles(user_id,organization_name,province,address,business_phone,business_email,tax_code,business_license,representative_name,production_certificate,attested_at)
  values(uid,btrim(details->>'organization_name'),btrim(details->>'province'),nullif(btrim(details->>'address'),''),details->>'business_phone',nullif(btrim(details->>'business_email'),''),details->>'tax_code',btrim(details->>'business_license'),btrim(details->>'representative_name'),nullif(btrim(details->>'production_certificate'),''),now())
  on conflict(user_id) do update set organization_name=excluded.organization_name,province=excluded.province,address=excluded.address,
  business_phone=excluded.business_phone,business_email=excluded.business_email,tax_code=excluded.tax_code,business_license=excluded.business_license,representative_name=excluded.representative_name,production_certificate=excluded.production_certificate,attested_at=excluded.attested_at;
  delete from public.buyer_evidence where user_id=uid;
  insert into public.buyer_evidence(user_id,path,label,position)
  select uid,x.value->>'path',btrim(x.value->>'label'),(x.ordinality-1)::integer from jsonb_array_elements(evidence) with ordinality x(value,ordinality);
end $$;
revoke all on function public.save_buyer_business_profile(jsonb,jsonb,boolean) from public,anon;
grant execute on function public.save_buyer_business_profile(jsonb,jsonb,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
