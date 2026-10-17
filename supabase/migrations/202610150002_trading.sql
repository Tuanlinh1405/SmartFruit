-- Persistent connections, chat, negotiated agreements and reviews.
-- No payments, inventory reservation, carrier booking or external integrations.
begin;
alter table public.profiles add column is_suspended boolean not null default false;
create or replace function logstar_private.current_app_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id=(select auth.uid()) and not p.is_suspended;
$$;

create table public.trade_connections (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id),
  lot_title text not null,
  buy_request_id uuid references public.buy_requests(id),
  buyer_id uuid not null references public.profiles(id),
  farmer_id uuid not null references public.profiles(id),
  initiated_by uuid not null references public.profiles(id),
  status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(buyer_id<>farmer_id), check(initiated_by in (buyer_id,farmer_id)),
  unique(lot_id,buyer_id)
);
create table public.trade_messages (
  id uuid primary key,
  connection_id uuid not null references public.trade_connections(id),
  sender_id uuid not null references public.profiles(id),
  body text not null check(length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create table public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.trade_connections(id),
  proposed_by uuid not null references public.profiles(id),
  price_vnd_per_kg bigint not null check(price_vnd_per_kg>0),
  quantity_kg numeric(14,3) not null check(quantity_kg>0 and quantity_kg<'Infinity'::numeric),
  delivery_date date not null,
  status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','REJECTED','WITHDRAWN','SUPERSEDED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.trade_agreements (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.trade_connections(id),
  offer_id uuid not null unique references public.trade_offers(id),
  price_vnd_per_kg bigint not null check(price_vnd_per_kg>0),
  quantity_kg numeric(14,3) not null check(quantity_kg>0 and quantity_kg<'Infinity'::numeric),
  delivery_date date not null,
  buyer_completed_at timestamptz, farmer_completed_at timestamptz,
  status text not null default 'AGREED' check(status in ('AGREED','COMPLETED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((status='COMPLETED')=(buyer_completed_at is not null and farmer_completed_at is not null))
);
create table public.trade_reviews (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.trade_agreements(id),
  reviewer_id uuid not null references public.profiles(id),
  target_id uuid not null references public.profiles(id),
  rating smallint not null check(rating between 1 and 5),
  comment text not null check(length(btrim(comment)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique(agreement_id,reviewer_id), check(reviewer_id<>target_id)
);
create index trade_buyer_idx on public.trade_connections(buyer_id,updated_at desc);
create index trade_farmer_idx on public.trade_connections(farmer_id,updated_at desc);
create index trade_messages_connection_idx on public.trade_messages(connection_id,created_at,id);
create index trade_offers_connection_idx on public.trade_offers(connection_id,created_at desc);
create index trade_reviews_target_idx on public.trade_reviews(target_id,created_at desc);

create function logstar_private.can_read_trade(target_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select logstar_private.current_app_role() in ('BUYER','FARMER') and exists(
    select 1 from public.trade_connections c where c.id=target_id and auth.uid() in(c.buyer_id,c.farmer_id));
$$;
create function logstar_private.require_trade(target_id uuid)
returns public.trade_connections language plpgsql security definer set search_path='' as $$
declare c public.trade_connections;
begin
  select * into c from public.trade_connections where id=target_id for update;
  if not found or logstar_private.can_read_trade(target_id) is not true then
    raise exception 'Connection unavailable' using errcode='42501'; end if;
  return c;
end $$;
do $$ declare tbl text; begin
  foreach tbl in array array['trade_connections','trade_messages','trade_offers','trade_agreements','trade_reviews'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('grant all on public.%I to service_role',tbl);
  end loop;
end $$;
create policy participant_read on public.trade_connections for select to authenticated
  using(logstar_private.can_read_trade(id));
create policy participant_read on public.trade_messages for select to authenticated
  using(logstar_private.can_read_trade(connection_id));
create policy participant_read on public.trade_offers for select to authenticated
  using(logstar_private.can_read_trade(connection_id));
create policy participant_read on public.trade_agreements for select to authenticated
  using(logstar_private.can_read_trade(connection_id));
create policy participant_read on public.trade_reviews for select to authenticated
  using(exists(select 1 from public.trade_agreements a where a.id=agreement_id));

create function public.open_trade_connection(target_lot_id uuid,target_request_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare l public.lots; r public.buy_requests; buyer uuid; result uuid;
  caller public.app_role:=logstar_private.current_app_role();
begin
  select * into l from public.lots where id=target_lot_id for share;
  if not found or l.status<>'PUBLISHED' or caller is null or caller not in('BUYER','FARMER') then
    raise exception 'Published lot unavailable' using errcode='42501'; end if;
  if target_request_id is not null then
    select * into r from public.buy_requests where id=target_request_id for share;
    if not found or r.status<>'OPEN' then raise exception 'Open request required' using errcode='23514'; end if;
  end if;
  if caller='BUYER' then
    buyer:=auth.uid();
    if target_request_id is not null and r.buyer_id<>buyer then raise exception 'Not your request' using errcode='42501'; end if;
  else
    if l.farmer_id<>auth.uid() or target_request_id is null then raise exception 'Own lot and target request required' using errcode='42501'; end if;
    buyer:=r.buyer_id;
  end if;
  if not exists(select 1 from public.profiles where id=buyer and role='BUYER' and not is_suspended)
    or not exists(select 1 from public.profiles where id=l.farmer_id and role='FARMER' and not is_suspended) then
    raise exception 'Participant unavailable' using errcode='42501'; end if;
  if target_request_id is not null and (l.fruit_type_id<>r.fruit_type_id
    or (r.variety_id is not null and l.variety_id is distinct from r.variety_id)
    or l.harvest_start>r.required_end or l.harvest_end<r.required_start
    or (r.min_lot_quantity_kg is not null and l.quantity_kg<r.min_lot_quantity_kg)
    or (not r.allow_partial and l.quantity_kg<r.target_quantity_kg)) then
    raise exception 'Lot does not meet request hard conditions' using errcode='23514'; end if;
  insert into public.trade_connections(lot_id,lot_title,buy_request_id,buyer_id,farmer_id,initiated_by)
    values(l.id,l.title,target_request_id,buyer,l.farmer_id,auth.uid())
    on conflict(lot_id,buyer_id) do nothing returning id into result;
  if result is null then select id into result from public.trade_connections where lot_id=l.id and buyer_id=buyer; end if;
  return result;
end $$;

create function public.respond_trade_connection(target_id uuid,decision text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.trade_connections;
begin
  c:=logstar_private.require_trade(target_id);
  if c.status<>'PENDING' then raise exception 'Invitation already answered' using errcode='23514'; end if;
  if (decision in('ACCEPTED','DECLINED') and c.initiated_by<>auth.uid())
    or (decision='CANCELLED' and c.initiated_by=auth.uid()) then
    update public.trade_connections set status=decision,updated_at=now() where id=target_id;
  else raise exception 'Invalid invitation action' using errcode='42501'; end if;
end $$;

create function public.send_trade_message(target_connection_id uuid,message_id uuid,message_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.trade_connections; existing public.trade_messages;
begin
  c:=logstar_private.require_trade(target_connection_id);
  if c.status<>'ACCEPTED' then raise exception 'Accept connection before messaging' using errcode='23514'; end if;
  select * into existing from public.trade_messages where id=message_id;
  if found then
    if existing.sender_id=auth.uid() and existing.connection_id=c.id and existing.body=btrim(message_body) then return existing.id; end if;
    raise exception 'Message identity conflict' using errcode='23505';
  end if;
  insert into public.trade_messages(id,connection_id,sender_id,body) values(message_id,c.id,auth.uid(),btrim(message_body));
  update public.trade_connections set updated_at=now() where id=c.id;
  return message_id;
end $$;

create function public.propose_trade_offer(target_connection_id uuid,price bigint,quantity numeric,delivery date)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.trade_connections; l public.lots; r public.buy_requests; result uuid;
begin
  c:=logstar_private.require_trade(target_connection_id);
  select * into l from public.lots where id=c.lot_id for share;
  if c.status<>'ACCEPTED' or l.status<>'PUBLISHED'
    or exists(select 1 from public.trade_agreements where connection_id=c.id) then
    raise exception 'Connection is not available for offers' using errcode='23514'; end if;
  if quantity is null or quantity<=0 or quantity>l.quantity_kg or quantity<>round(quantity,3)
    or price is null or price<=0 or delivery is null or delivery<l.harvest_start or delivery>l.harvest_end then
    raise exception 'Invalid price, quantity or harvest date' using errcode='23514'; end if;
  if c.buy_request_id is not null then
    select * into r from public.buy_requests where id=c.buy_request_id;
    if r.status<>'OPEN' or l.fruit_type_id<>r.fruit_type_id
      or (r.variety_id is not null and l.variety_id is distinct from r.variety_id)
      or quantity>r.target_quantity_kg or (not r.allow_partial and quantity<r.target_quantity_kg)
      or (r.min_lot_quantity_kg is not null and quantity<r.min_lot_quantity_kg)
      or delivery<r.required_start or delivery>r.required_end then
      raise exception 'Offer exceeds request quantity or date' using errcode='23514'; end if;
  end if;
  insert into public.trade_offers(connection_id,proposed_by,price_vnd_per_kg,quantity_kg,delivery_date)
    values(c.id,auth.uid(),price,quantity,delivery) returning id into result;
  update public.trade_connections set updated_at=now() where id=c.id;
  return result;
end $$;

create function public.respond_trade_offer(target_id uuid,decision text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.trade_connections; o public.trade_offers; l public.lots; r public.buy_requests; result uuid;
begin
  select * into o from public.trade_offers where id=target_id;
  if not found then raise exception 'Offer unavailable' using errcode='42501'; end if;
  c:=logstar_private.require_trade(o.connection_id);
  select * into o from public.trade_offers where id=target_id for update;
  if c.status<>'ACCEPTED' or o.status<>'PENDING' then raise exception 'Offer already answered' using errcode='23514'; end if;
  if decision='WITHDRAWN' and o.proposed_by=auth.uid() then
    update public.trade_offers set status=decision,updated_at=now() where id=o.id; return null;
  end if;
  if o.proposed_by=auth.uid() or decision not in('ACCEPTED','REJECTED') then
    raise exception 'Only recipient may accept/reject offer' using errcode='42501'; end if;
  if decision='ACCEPTED' then
    select * into l from public.lots where id=c.lot_id for share;
    if l.status<>'PUBLISHED' or o.quantity_kg>l.quantity_kg
      or o.delivery_date<l.harvest_start or o.delivery_date>l.harvest_end then
      raise exception 'Lot changed; propose a new offer' using errcode='23514'; end if;
    if c.buy_request_id is not null then
      select * into r from public.buy_requests where id=c.buy_request_id;
      if r.status<>'OPEN' or l.fruit_type_id<>r.fruit_type_id
        or (r.variety_id is not null and l.variety_id is distinct from r.variety_id)
        or o.quantity_kg>r.target_quantity_kg or (not r.allow_partial and o.quantity_kg<r.target_quantity_kg)
        or (r.min_lot_quantity_kg is not null and o.quantity_kg<r.min_lot_quantity_kg)
        or o.delivery_date<r.required_start or o.delivery_date>r.required_end then
        raise exception 'Request changed; propose a new offer' using errcode='23514'; end if;
    end if;
    insert into public.trade_agreements(connection_id,offer_id,price_vnd_per_kg,quantity_kg,delivery_date)
      values(c.id,o.id,o.price_vnd_per_kg,o.quantity_kg,o.delivery_date) returning id into result;
    update public.trade_offers set status='SUPERSEDED',updated_at=now() where connection_id=c.id and status='PENDING' and id<>o.id;
  end if;
  update public.trade_offers set status=decision,updated_at=now() where id=o.id;
  update public.trade_connections set updated_at=now() where id=c.id;
  return result;
end $$;

create function public.complete_trade_agreement(target_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare a public.trade_agreements; c public.trade_connections;
begin
  select * into a from public.trade_agreements where id=target_id;
  if not found then raise exception 'Agreement unavailable' using errcode='42501'; end if;
  c:=logstar_private.require_trade(a.connection_id);
  select * into a from public.trade_agreements where id=target_id for update;
  if auth.uid()=c.buyer_id then a.buyer_completed_at:=coalesce(a.buyer_completed_at,now());
  else a.farmer_completed_at:=coalesce(a.farmer_completed_at,now()); end if;
  update public.trade_agreements set buyer_completed_at=a.buyer_completed_at,farmer_completed_at=a.farmer_completed_at,
    status=case when a.buyer_completed_at is not null and a.farmer_completed_at is not null then 'COMPLETED' else 'AGREED' end,
    updated_at=now() where id=a.id;
end $$;

create function public.submit_trade_review(target_agreement_id uuid,stars integer,review_comment text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.trade_agreements; c public.trade_connections; result uuid;
begin
  select * into a from public.trade_agreements where id=target_agreement_id;
  if not found then raise exception 'Agreement unavailable' using errcode='42501'; end if;
  c:=logstar_private.require_trade(a.connection_id);
  if a.status<>'COMPLETED' then raise exception 'Both participants must confirm completion first' using errcode='23514'; end if;
  insert into public.trade_reviews(agreement_id,reviewer_id,target_id,rating,comment)
    values(a.id,auth.uid(),case when auth.uid()=c.buyer_id then c.farmer_id else c.buyer_id end,stars,btrim(review_comment))
    returning id into result;
  return result;
end $$;

-- Listing names remain readable to existing trading partners after a lot closes.
create or replace function logstar_private.can_read_marketplace_profile(target_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select target_user_id=auth.uid()
    or (logstar_private.current_app_role()='BUYER' and exists(select 1 from public.lots where farmer_id=target_user_id and status='PUBLISHED'))
    or (logstar_private.current_app_role()='FARMER' and exists(select 1 from public.buy_requests where buyer_id=target_user_id and status='OPEN'))
    or (logstar_private.current_app_role() in('BUYER','FARMER') and exists(select 1 from public.trade_connections c
      where auth.uid() in(c.buyer_id,c.farmer_id) and target_user_id in(c.buyer_id,c.farmer_id)));
$$;

-- Admin APIs expose explicit projections, not unrestricted SELECT on private tables.
create function logstar_private.require_admin()
returns void language plpgsql stable security definer set search_path='' as $$
begin if logstar_private.current_app_role() is distinct from 'ADMIN' then raise exception 'Admin required' using errcode='42501'; end if; end $$;
create function public.admin_directory()
returns table(id uuid,role public.app_role,full_name text,display_name text,province text,is_suspended boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform logstar_private.require_admin();
  return query select p.id,p.role,p.full_name,coalesce(m.display_name,p.full_name),coalesce(m.province,''),p.is_suspended,p.created_at
    from public.profiles p left join public.marketplace_profiles m on m.user_id=p.id order by p.created_at desc,p.id;
end $$;
create function public.admin_update_member(target_id uuid,member_name text,business_name text,member_province text,suspended boolean)
returns void language plpgsql security definer set search_path='' as $$
declare target_role public.app_role;
begin
  perform logstar_private.require_admin();
  select role into target_role from public.profiles where id=target_id for update;
  if not found or length(btrim(member_name)) not between 1 and 160 or suspended is null then
    raise exception 'Invalid member' using errcode='23514'; end if;
  if target_role='ADMIN' and suspended then raise exception 'Admin suspension requires trusted account administration' using errcode='42501'; end if;
  update public.profiles set full_name=btrim(member_name),is_suspended=suspended where id=target_id;
  if target_role='BUYER' then update public.buyer_profiles set organization_name=btrim(business_name),province=btrim(member_province) where user_id=target_id;
  elsif target_role='FARMER' then update public.farmer_profiles set farm_name=btrim(business_name),province=btrim(member_province) where user_id=target_id;
  elsif target_role='CARRIER' then update public.carrier_profiles set company_name=btrim(business_name),province=btrim(member_province) where user_id=target_id; end if;
end $$;
create function public.admin_marketplace()
returns table(id uuid,kind text,title text,owner_id uuid,owner_name text,quantity_kg numeric,province text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform logstar_private.require_admin();
  return query select l.id,'lot'::text,l.title,l.farmer_id,m.display_name,l.quantity_kg,l.province,l.status::text,l.created_at
    from public.lots l join public.marketplace_profiles m on m.user_id=l.farmer_id
    union all select r.id,'request'::text,r.title,r.buyer_id,m.display_name,r.target_quantity_kg,m.province,r.status::text,r.created_at
    from public.buy_requests r join public.marketplace_profiles m on m.user_id=r.buyer_id;
end $$;
create function public.admin_close_listing(target_id uuid,target_kind text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform logstar_private.require_admin();
  if target_kind='lot' then update public.lots set status='CLOSED' where id=target_id and status='PUBLISHED';
  elsif target_kind='request' then update public.buy_requests set status='CLOSED' where id=target_id and status='OPEN';
  else raise exception 'Invalid listing kind' using errcode='23514'; end if;
  if not found then raise exception 'Listing is no longer open' using errcode='23514'; end if;
end $$;
create function public.admin_trade_overview()
returns table(id uuid,buyer_name text,farmer_name text,lot_title text,status text,agreement_status text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform logstar_private.require_admin();
  return query select c.id,b.display_name,f.display_name,l.title,c.status,a.status,c.created_at
    from public.trade_connections c join public.marketplace_profiles b on b.user_id=c.buyer_id
    join public.marketplace_profiles f on f.user_id=c.farmer_id join public.lots l on l.id=c.lot_id
    left join public.trade_agreements a on a.connection_id=c.id order by c.created_at desc;
end $$;

create function public.buyer_market_summary()
returns table(fruit_name text,lot_count bigint,quantity_kg numeric,min_price bigint,max_price bigint)
language sql stable security invoker set search_path='' as $$
  select t.name,count(*),sum(l.quantity_kg),min(l.price_vnd_per_kg),max(l.price_vnd_per_kg)
  from public.lots l join public.fruit_types t on t.id=l.fruit_type_id
  where l.status='PUBLISHED' and logstar_private.current_app_role()='BUYER'
  group by t.id,t.name order by t.name;
$$;
revoke all on function public.buyer_market_summary() from public,anon;
grant execute on function public.buyer_market_summary() to authenticated;

revoke all on function logstar_private.can_read_trade(uuid),logstar_private.require_trade(uuid),logstar_private.require_admin() from public,anon,authenticated;
grant execute on function logstar_private.can_read_trade(uuid) to authenticated;
revoke all on function public.open_trade_connection(uuid,uuid),public.respond_trade_connection(uuid,text),
  public.send_trade_message(uuid,uuid,text),public.propose_trade_offer(uuid,bigint,numeric,date),
  public.respond_trade_offer(uuid,text),public.complete_trade_agreement(uuid),public.submit_trade_review(uuid,integer,text),
  public.admin_directory(),public.admin_update_member(uuid,text,text,text,boolean),public.admin_marketplace(),
  public.admin_close_listing(uuid,text),public.admin_trade_overview() from public,anon,authenticated;
grant execute on function public.open_trade_connection(uuid,uuid),public.respond_trade_connection(uuid,text),
  public.send_trade_message(uuid,uuid,text),public.propose_trade_offer(uuid,bigint,numeric,date),
  public.respond_trade_offer(uuid,text),public.complete_trade_agreement(uuid),public.submit_trade_review(uuid,integer,text),
  public.admin_directory(),public.admin_update_member(uuid,text,text,text,boolean),public.admin_marketplace(),
  public.admin_close_listing(uuid,text),public.admin_trade_overview() to authenticated;
commit;
