-- LogStar MVP. Apply once to the explicitly selected Supabase project.
-- No DROP/TRUNCATE, demo users, credentials, chat, orders or payment tables.
-- Run the entire file in one transaction; a conflicting object aborts the migration.
begin;

create schema if not exists logstar_private;
revoke all on schema logstar_private from public, anon, authenticated;
grant usage on schema logstar_private to authenticated, service_role;

create type public.app_role as enum ('FARMER', 'BUYER', 'CARRIER', 'ADMIN');
create type public.lot_status as enum ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');
create type public.buy_request_status as enum ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
create type public.trade_method as enum ('WHOLE_FARM', 'BY_GRADE', 'PARTIAL', 'OFFTAKE');
create type public.transport_responsibility as enum ('BUYER', 'FARMER', 'UNDECIDED');
create type public.vehicle_type as enum ('TARPAULIN', 'ENCLOSED', 'REFRIGERATED');

create function logstar_private.valid_labels(items text[])
returns boolean language sql immutable set search_path = '' as $$
  select items is not null and cardinality(items) <= 32
    and not exists (
      select 1 from unnest(items) item
      where item is null or length(btrim(item)) not between 1 and 120
    );
$$;

create function logstar_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function logstar_private.protect_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) -> tg_argv[0]) is distinct from (to_jsonb(old) -> tg_argv[0])
     or new.created_at is distinct from old.created_at then
    raise exception 'Record identity and created_at are immutable' using errcode = '23514';
  end if;
  if tg_nargs > 1 and (to_jsonb(new) -> tg_argv[1]) is distinct from (to_jsonb(old) -> tg_argv[1]) then
    raise exception 'Record owner is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Private account data: no cross-account SELECT and no client role assignment.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role,
  full_name text not null default '' check (length(full_name) <= 160),
  phone_display text check (phone_display is null or length(phone_display) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, role)
);

create function logstar_private.current_app_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create table public.farmer_profiles (
  user_id uuid primary key,
  profile_role public.app_role generated always as ('FARMER'::public.app_role) stored,
  farm_name text not null check (length(btrim(farm_name)) between 1 and 160),
  province text not null check (length(btrim(province)) between 1 and 120),
  district text check (district is null or length(district) <= 120),
  address text check (address is null or length(address) <= 500),
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  area_m2 numeric(14,2) check (area_m2 > 0 and area_m2 < 'Infinity'::numeric),
  tree_count integer check (tree_count >= 0),
  orchard_age_years numeric(5,1) check (orchard_age_years >= 0 and orchard_age_years < 'Infinity'::numeric),
  annual_yield_kg numeric(14,3) check (annual_yield_kg >= 0 and annual_yield_kg < 'Infinity'::numeric),
  cultivated_varieties text[] not null default '{}' check (logstar_private.valid_labels(cultivated_varieties)),
  certifications text[] not null default '{}' check (logstar_private.valid_labels(certifications)),
  growing_area_code text check (growing_area_code is null or length(growing_area_code) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, profile_role) references public.profiles(id, role) on delete cascade,
  check ((latitude is null) = (longitude is null))
);

create table public.buyer_profiles (
  user_id uuid primary key,
  profile_role public.app_role generated always as ('BUYER'::public.app_role) stored,
  organization_name text not null check (length(btrim(organization_name)) between 1 and 160),
  province text not null check (length(btrim(province)) between 1 and 120),
  address text check (address is null or length(address) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, profile_role) references public.profiles(id, role) on delete cascade
);

create table public.carrier_profiles (
  user_id uuid primary key,
  profile_role public.app_role generated always as ('CARRIER'::public.app_role) stored,
  company_name text not null check (length(btrim(company_name)) between 1 and 160),
  province text not null check (length(btrim(province)) between 1 and 120),
  address text check (address is null or length(address) <= 500),
  service_provinces text[] not null default '{}' check (logstar_private.valid_labels(service_provinces)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, profile_role) references public.profiles(id, role) on delete cascade
);

-- Deliberately separate public listing identity from personal contacts/GPS.
-- Maintained by trusted triggers, never directly written by browser clients.
create table public.marketplace_profiles (
  user_id uuid primary key,
  role public.app_role not null,
  display_name text not null,
  province text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, role) references public.profiles(id, role) on delete cascade
);

create table public.fruit_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_-]{0,49}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fruit_varieties (
  id uuid primary key default gen_random_uuid(),
  fruit_type_id uuid not null references public.fruit_types(id),
  code text not null check (code ~ '^[a-z][a-z0-9_-]{0,49}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fruit_type_id, code),
  unique (id, fruit_type_id)
);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null default auth.uid() references public.farmer_profiles(user_id) on delete cascade,
  fruit_type_id uuid not null references public.fruit_types(id),
  variety_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  grade text check (grade is null or length(grade) <= 80),
  quantity_kg numeric(14,3) not null check (quantity_kg > 0 and quantity_kg < 'Infinity'::numeric),
  price_vnd_per_kg bigint not null check (price_vnd_per_kg between 1 and 9007199254740991),
  harvest_start date not null,
  harvest_end date not null,
  province text not null check (length(btrim(province)) between 1 and 120),
  district text check (district is null or length(district) <= 120),
  growing_area_code text check (growing_area_code is null or length(growing_area_code) <= 100),
  certifications text[] not null default '{}' check (logstar_private.valid_labels(certifications)),
  packaging_options text[] not null default '{}' check (logstar_private.valid_labels(packaging_options)),
  selling_method public.trade_method not null default 'PARTIAL',
  description text not null default '' check (length(description) <= 5000),
  status public.lot_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (variety_id, fruit_type_id) references public.fruit_varieties(id, fruit_type_id),
  check (harvest_start <= harvest_end)
);

-- A Buyer must never discover a Farmer's private negotiation floor.
create table public.lot_private_details (
  lot_id uuid primary key references public.lots(id) on delete cascade,
  price_floor_vnd_per_kg bigint check (price_floor_vnd_per_kg between 1 and 9007199254740991),
  internal_notes text not null default '' check (length(internal_notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buy_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null default auth.uid() references public.buyer_profiles(user_id) on delete cascade,
  fruit_type_id uuid not null references public.fruit_types(id),
  variety_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  grade text check (grade is null or length(grade) <= 80),
  -- Target is TOTAL procurement demand, not the minimum size of each candidate lot.
  target_quantity_kg numeric(14,3) not null check (target_quantity_kg > 0 and target_quantity_kg < 'Infinity'::numeric),
  min_lot_quantity_kg numeric(14,3) check (min_lot_quantity_kg > 0 and min_lot_quantity_kg < 'Infinity'::numeric),
  allow_partial boolean not null default true,
  min_price_vnd_per_kg bigint not null check (min_price_vnd_per_kg between 1 and 9007199254740991),
  max_price_vnd_per_kg bigint not null check (max_price_vnd_per_kg between 1 and 9007199254740991),
  required_start date not null,
  required_end date not null,
  preferred_provinces text[] not null default '{}' check (logstar_private.valid_labels(preferred_provinces)),
  preferred_districts text[] not null default '{}' check (logstar_private.valid_labels(preferred_districts)),
  quality_requirements text[] not null default '{}' check (logstar_private.valid_labels(quality_requirements)),
  packaging_options text[] not null default '{}' check (logstar_private.valid_labels(packaging_options)),
  buying_method public.trade_method not null default 'PARTIAL',
  transport_by public.transport_responsibility not null default 'UNDECIDED',
  -- Public procurement instructions. Do not put private contact information here.
  notes text not null default '' check (length(notes) <= 5000),
  status public.buy_request_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (variety_id, fruit_type_id) references public.fruit_varieties(id, fruit_type_id),
  check (required_start <= required_end),
  check (min_price_vnd_per_kg <= max_price_vnd_per_kg),
  check (min_lot_quantity_kg is null or min_lot_quantity_kg <= target_quantity_kg)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null default auth.uid() references public.carrier_profiles(user_id) on delete cascade,
  license_plate text not null check (length(btrim(license_plate)) between 3 and 24),
  license_plate_normalized text generated always as (upper(regexp_replace(license_plate, '[^a-zA-Z0-9]', '', 'g'))) stored,
  vehicle_type public.vehicle_type not null,
  capacity_kg numeric(14,3) not null check (capacity_kg > 0 and capacity_kg < 'Infinity'::numeric),
  provinces text[] not null default '{}' check (logstar_private.valid_labels(provinces)),
  min_temperature_c numeric(5,2) check (min_temperature_c between -100 and 100),
  max_temperature_c numeric(5,2) check (max_temperature_c between -100 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrier_id, license_plate_normalized),
  check ((min_temperature_c is null) = (max_temperature_c is null)),
  check (min_temperature_c <= max_temperature_c),
  check (min_temperature_c is null or vehicle_type = 'REFRIGERATED')
);

create table public.lot_images (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id) on delete cascade,
  storage_path text not null unique check (length(storage_path) <= 400),
  sort_order smallint not null default 0 check (sort_order between 0 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lot_id, sort_order) deferrable initially immediate
);

create index lots_farmer_status_idx on public.lots(farmer_id, status);
create index lots_published_matching_idx on public.lots(fruit_type_id, harvest_start, harvest_end)
  where status = 'PUBLISHED';
create index lots_published_province_price_idx on public.lots(province, price_vnd_per_kg)
  where status = 'PUBLISHED';
create index lots_variety_type_idx on public.lots(variety_id, fruit_type_id);
create index buy_requests_buyer_status_idx on public.buy_requests(buyer_id, status);
create index buy_requests_open_matching_idx on public.buy_requests(fruit_type_id, required_start, required_end)
  where status = 'OPEN';
create index buy_requests_variety_type_idx on public.buy_requests(variety_id, fruit_type_id);
create index buy_requests_provinces_idx on public.buy_requests using gin(preferred_provinces);
create index vehicles_carrier_active_idx on public.vehicles(carrier_id, active);
create index profiles_role_idx on public.profiles(role);

create function logstar_private.sync_marketplace_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare label text;
begin
  if tg_op = 'DELETE' then
    delete from public.marketplace_profiles where user_id = old.user_id;
    return old;
  end if;
  label := coalesce(to_jsonb(new)->>'farm_name', to_jsonb(new)->>'organization_name', to_jsonb(new)->>'company_name');
  insert into public.marketplace_profiles(user_id, role, display_name, province)
  values (new.user_id, new.profile_role, label, new.province)
  on conflict (user_id) do update
    set role = excluded.role, display_name = excluded.display_name,
        province = excluded.province, updated_at = now();
  return new;
end;
$$;

create function logstar_private.handle_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare assigned_role public.app_role;
begin
  -- raw_app_meta_data is controlled by the Auth administrator.
  -- raw_user_meta_data.role is deliberately ignored.
  if new.raw_app_meta_data->>'app_role' in ('FARMER','BUYER','CARRIER','ADMIN') then
    assigned_role := (new.raw_app_meta_data->>'app_role')::public.app_role;
  end if;
  insert into public.profiles(id, role, full_name, phone_display)
  values (new.id, assigned_role, left(coalesce(new.raw_user_meta_data->>'full_name',''),160), new.phone);
  return new;
end;
$$;

create trigger logstar_auth_user_created after insert on auth.users
for each row execute function logstar_private.handle_auth_user_created();

-- Existing accounts get pending access unless a trusted app_role is present.
insert into public.profiles(id, role, full_name, phone_display)
select u.id,
  case when u.raw_app_meta_data->>'app_role' in ('FARMER','BUYER','CARRIER','ADMIN')
    then (u.raw_app_meta_data->>'app_role')::public.app_role else null end,
  left(coalesce(u.raw_user_meta_data->>'full_name',''),160), u.phone
from auth.users u;

create function logstar_private.owns_lot(target_lot_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select logstar_private.current_app_role()) = 'FARMER' and exists (
    select 1 from public.lots l where l.id = target_lot_id and l.farmer_id = (select auth.uid())
  );
$$;

create function logstar_private.can_read_marketplace_profile(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_user_id = (select auth.uid())
    or ((select logstar_private.current_app_role()) = 'BUYER' and exists (
      select 1 from public.lots l where l.farmer_id = target_user_id and l.status = 'PUBLISHED'
    ))
    or ((select logstar_private.current_app_role()) = 'FARMER' and exists (
      select 1 from public.buy_requests r where r.buyer_id = target_user_id and r.status = 'OPEN'
    ));
$$;

create function logstar_private.validate_lot_floor()
returns trigger language plpgsql security definer set search_path = '' as $$
declare asking_price bigint; floor_price bigint;
begin
  if tg_table_name = 'lot_private_details' then
    select price_vnd_per_kg into asking_price from public.lots where id = new.lot_id for update;
    floor_price := new.price_floor_vnd_per_kg;
  else
    asking_price := new.price_vnd_per_kg;
    select price_floor_vnd_per_kg into floor_price from public.lot_private_details where lot_id = new.id;
  end if;
  if floor_price > asking_price then
    raise exception 'Private price floor cannot exceed asking price' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger lot_floor_valid before insert or update on public.lot_private_details
for each row execute function logstar_private.validate_lot_floor();
create trigger lot_price_floor_valid before update of price_vnd_per_kg on public.lots
for each row execute function logstar_private.validate_lot_floor();

-- Uniform identity protection and server-managed timestamps.
do $$
declare tbl text; identity_column text; owner_column text;
begin
  foreach tbl in array array['profiles','farmer_profiles','buyer_profiles','carrier_profiles',
    'marketplace_profiles','fruit_types','fruit_varieties','lots','lot_private_details',
    'buy_requests','vehicles','lot_images'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function logstar_private.touch_updated_at()', tbl);
    identity_column := case when tbl in ('farmer_profiles','buyer_profiles','carrier_profiles','marketplace_profiles')
      then 'user_id' when tbl = 'lot_private_details' then 'lot_id' else 'id' end;
    owner_column := case tbl when 'lots' then 'farmer_id' when 'buy_requests' then 'buyer_id'
      when 'vehicles' then 'carrier_id' when 'lot_images' then 'lot_id' else null end;
    if owner_column is null then
      execute format('create trigger protect_identity before update on public.%I for each row execute function logstar_private.protect_identity(%L)', tbl, identity_column);
    else
      execute format('create trigger protect_identity before update on public.%I for each row execute function logstar_private.protect_identity(%L,%L)', tbl, identity_column, owner_column);
    end if;
  end loop;
  foreach tbl in array array['farmer_profiles','buyer_profiles','carrier_profiles'] loop
    execute format('create trigger sync_marketplace_profile after insert or update or delete on public.%I for each row execute function logstar_private.sync_marketplace_profile()', tbl);
  end loop;
end;
$$;

-- Explicit privileges: none for anonymous clients, no client role/owner changes.
revoke all on public.profiles, public.farmer_profiles, public.buyer_profiles,
  public.carrier_profiles, public.marketplace_profiles, public.fruit_types,
  public.fruit_varieties, public.lots, public.lot_private_details,
  public.buy_requests, public.vehicles, public.lot_images from public, anon, authenticated;
grant select on public.profiles, public.marketplace_profiles, public.fruit_types,
  public.fruit_varieties to authenticated;
grant update(full_name, phone_display) on public.profiles to authenticated;
grant select, delete on public.farmer_profiles, public.buyer_profiles,
  public.carrier_profiles, public.lots, public.lot_private_details,
  public.buy_requests, public.vehicles, public.lot_images to authenticated;
-- Allow ordinary profile upserts to reassign the SAME user_id. The immutable-ID
-- trigger and RLS still reject changing it to a different account.
grant update(user_id, farm_name, province, district, address, latitude, longitude, area_m2,
  tree_count, orchard_age_years, annual_yield_kg, cultivated_varieties, certifications,
  growing_area_code) on public.farmer_profiles to authenticated;
grant update(user_id, organization_name, province, address) on public.buyer_profiles to authenticated;
grant update(user_id, company_name, province, address, service_provinces) on public.carrier_profiles to authenticated;
grant update(fruit_type_id, variety_id, title, grade, quantity_kg, price_vnd_per_kg,
  harvest_start, harvest_end, province, district, growing_area_code, certifications,
  packaging_options, selling_method, description, status) on public.lots to authenticated;
grant update(price_floor_vnd_per_kg, internal_notes) on public.lot_private_details to authenticated;
grant update(fruit_type_id, variety_id, title, grade, target_quantity_kg, min_lot_quantity_kg,
  allow_partial, min_price_vnd_per_kg, max_price_vnd_per_kg, required_start,
  required_end, preferred_provinces, preferred_districts, quality_requirements,
  packaging_options, buying_method, transport_by, notes, status) on public.buy_requests to authenticated;
grant update(license_plate, vehicle_type, capacity_kg, provinces, min_temperature_c,
  max_temperature_c, active) on public.vehicles to authenticated;
grant update(sort_order) on public.lot_images to authenticated;
-- INSERT only business columns: timestamps and generated columns are server-owned.
do $$
declare tbl text; allowed_columns text;
begin
  foreach tbl in array array['farmer_profiles','buyer_profiles','carrier_profiles',
    'lots','lot_private_details','buy_requests','vehicles','lot_images'] loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into allowed_columns
    from pg_attribute a
    where a.attrelid = ('public.' || tbl)::regclass and a.attnum > 0 and not a.attisdropped
      and a.attgenerated = '' and a.attname not in ('created_at','updated_at');
    execute format('grant insert (%s) on public.%I to authenticated', allowed_columns, tbl);
  end loop;
end;
$$;
grant all on public.profiles, public.farmer_profiles, public.buyer_profiles,
  public.carrier_profiles, public.marketplace_profiles, public.fruit_types,
  public.fruit_varieties, public.lots, public.lot_private_details,
  public.buy_requests, public.vehicles, public.lot_images to service_role;

create policy profile_owner_read on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profile_owner_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare tbl text; required_role text;
begin
  for tbl, required_role in select * from (values
    ('farmer_profiles','FARMER'),('buyer_profiles','BUYER'),('carrier_profiles','CARRIER')) as domains(tbl, role) loop
    execute format('create policy owner_access on public.%I for all to authenticated using (user_id = (select auth.uid()) and (select logstar_private.current_app_role()) = %L::public.app_role) with check (user_id = (select auth.uid()) and (select logstar_private.current_app_role()) = %L::public.app_role)', tbl, required_role, required_role);
  end loop;
end;
$$;

create policy marketplace_profile_read on public.marketplace_profiles for select to authenticated
using (logstar_private.can_read_marketplace_profile(user_id));
create policy catalog_read on public.fruit_types for select to authenticated using (true);
create policy catalog_read on public.fruit_varieties for select to authenticated using (true);

create policy farmer_own_lots on public.lots for all to authenticated
using (farmer_id = (select auth.uid()) and (select logstar_private.current_app_role()) = 'FARMER')
with check (farmer_id = (select auth.uid()) and (select logstar_private.current_app_role()) = 'FARMER');
create policy buyer_read_published on public.lots for select to authenticated
using (status = 'PUBLISHED' and (select logstar_private.current_app_role()) = 'BUYER');
create policy farmer_private_lot_details on public.lot_private_details for all to authenticated
using (logstar_private.owns_lot(lot_id)) with check (logstar_private.owns_lot(lot_id));

create policy buyer_own_requests on public.buy_requests for all to authenticated
using (buyer_id = (select auth.uid()) and (select logstar_private.current_app_role()) = 'BUYER')
with check (buyer_id = (select auth.uid()) and (select logstar_private.current_app_role()) = 'BUYER');
create policy farmer_read_open_requests on public.buy_requests for select to authenticated
using (status = 'OPEN' and (select logstar_private.current_app_role()) = 'FARMER');

create policy carrier_own_vehicles on public.vehicles for all to authenticated
using (carrier_id = (select auth.uid()) and (select logstar_private.current_app_role()) = 'CARRIER')
with check (carrier_id = (select auth.uid()) and (select logstar_private.current_app_role()) = 'CARRIER');

create policy farmer_own_lot_images on public.lot_images for all to authenticated
using (logstar_private.owns_lot(lot_id)) with check (logstar_private.owns_lot(lot_id));
create policy buyer_read_published_images on public.lot_images for select to authenticated
using ((select logstar_private.current_app_role()) = 'BUYER' and exists (
  select 1 from public.lots l where l.id = lot_id and l.status = 'PUBLISHED'
));

-- Private bucket: signed URLs only; 8 images per lot via unique sort slots 0..7.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('lot-images', 'lot-images', false, 5242880, array['image/jpeg','image/png','image/webp']);

create function logstar_private.can_upload_lot_image(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select logstar_private.current_app_role()) = 'FARMER'
    and split_part(object_name,'/',1) = (select auth.uid())::text
    and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}\.(jpg|jpeg|png|webp)$'
    and exists (select 1 from public.lots l
      where l.id::text = split_part(object_name,'/',2) and l.farmer_id = (select auth.uid()));
$$;

create function logstar_private.can_read_lot_image(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select ((select logstar_private.current_app_role()) = 'FARMER'
      and split_part(object_name,'/',1) = (select auth.uid())::text)
    or ((select logstar_private.current_app_role()) = 'BUYER' and exists (
      select 1 from public.lot_images i join public.lots l on l.id = i.lot_id
      where i.storage_path = object_name and l.status = 'PUBLISHED'
    ));
$$;

create function logstar_private.can_delete_lot_image(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select logstar_private.current_app_role()) = 'FARMER'
    and split_part(object_name,'/',1) = (select auth.uid())::text
    and not exists (select 1 from public.lot_images i where i.storage_path = object_name);
$$;

create policy logstar_lot_image_insert on storage.objects for insert to authenticated
with check (bucket_id = 'lot-images' and logstar_private.can_upload_lot_image(name));
create policy logstar_lot_image_read on storage.objects for select to authenticated
using (bucket_id = 'lot-images' and logstar_private.can_read_lot_image(name));
create policy logstar_lot_image_delete on storage.objects for delete to authenticated
using (bucket_id = 'lot-images' and logstar_private.can_delete_lot_image(name));
-- No UPDATE/upsert policy: use a new object name, link it, unlink the old one, then remove it.

create function logstar_private.validate_lot_image_link()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  select farmer_id into owner_id from public.lots where id = new.lot_id;
  if not (new.storage_path ~ ('^' || owner_id::text || '/' || new.lot_id::text || '/[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}\.(jpg|jpeg|png|webp)$'))
     or not exists (select 1 from storage.objects o where o.bucket_id = 'lot-images' and o.name = new.storage_path) then
    raise exception 'Image must exist in the owner/lot Storage folder' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_lot_image_link before insert or update of storage_path, lot_id on public.lot_images
for each row execute function logstar_private.validate_lot_image_link();

-- Trigger functions cannot be called over the Data API. Only narrow policy helpers
-- have EXECUTE for authenticated. logstar_private is NOT an exposed API schema.
revoke all on function logstar_private.valid_labels(text[]), logstar_private.touch_updated_at(),
  logstar_private.protect_identity(), logstar_private.current_app_role(), logstar_private.sync_marketplace_profile(),
  logstar_private.handle_auth_user_created(), logstar_private.owns_lot(uuid),
  logstar_private.can_read_marketplace_profile(uuid), logstar_private.validate_lot_floor(),
  logstar_private.can_upload_lot_image(text), logstar_private.can_read_lot_image(text),
  logstar_private.can_delete_lot_image(text), logstar_private.validate_lot_image_link() from public, anon, authenticated;
grant execute on function logstar_private.valid_labels(text[]), logstar_private.current_app_role(),
  logstar_private.owns_lot(uuid), logstar_private.can_read_marketplace_profile(uuid),
  logstar_private.can_upload_lot_image(text), logstar_private.can_read_lot_image(text),
  logstar_private.can_delete_lot_image(text) to authenticated, service_role;

comment on table public.profiles is 'Private account data. Role assigned only through trusted administration; NULL means pending.';
comment on table public.marketplace_profiles is 'Safe public listing identity, trigger-maintained. No phone, email, street address or GPS.';
comment on table public.lot_private_details is 'Farmer-only negotiation floor and internal notes; never readable by Buyer.';
comment on column public.buy_requests.target_quantity_kg is 'Total demand in kg, not the required size of a single lot.';
comment on column public.buy_requests.allow_partial is 'Allows candidate lots to satisfy part of total demand. No allocation/booking is performed.';
comment on column public.buy_requests.notes is 'Procurement instructions visible to Farmer while OPEN; not a private notes field.';
comment on column public.lots.certifications is 'Public self-declared certifications; not externally verified.';

commit;
