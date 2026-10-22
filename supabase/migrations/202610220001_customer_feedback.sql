-- Customer dashboard summaries, participant-only notifications and minimal transport.
begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  kind text not null,
  title text not null,
  path text not null check(path ~ '^/(farmer|buyer|carrier|admin)/'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(recipient_id,event_key)
);
create index notifications_recipient_idx on public.notifications(recipient_id,created_at desc,id);
create index notifications_unread_idx on public.notifications(recipient_id) where read_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy recipient_read on public.notifications for select to authenticated
using(recipient_id=auth.uid() and logstar_private.current_app_role() is not null);

create function logstar_private.notify(recipient uuid,event_id text,event_kind text,event_title text,event_path text,regroup boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
  if recipient is null or recipient=auth.uid() or not exists(select 1 from public.profiles where id=recipient and not is_suspended) then return; end if;
  insert into public.notifications(recipient_id,event_key,kind,title,path)
  values(recipient,event_id,event_kind,event_title,event_path)
  on conflict(recipient_id,event_key) do update set created_at=now(),read_at=null,title=excluded.title,path=excluded.path
  where regroup;
end $$;

create function public.mark_notifications_read(target_id uuid default null,through_time timestamptz default now())
returns void language plpgsql security definer set search_path='' as $$
begin
  if logstar_private.current_app_role() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update public.notifications set read_at=now() where recipient_id=auth.uid() and read_at is null
    and created_at<=least(through_time,now()) and (target_id is null or id=target_id);
end $$;

create function public.my_review_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if logstar_private.current_app_role() not in ('FARMER','BUYER') or logstar_private.current_app_role() is null then
    raise exception 'Trading account required' using errcode='42501'; end if;
  return (select jsonb_build_object('average',round(avg(rating),1),'count',count(*),'recent',(
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) from (
      select r.id,r.rating,r.comment,r.created_at,p.full_name reviewer_name from public.trade_reviews r
      join public.profiles p on p.id=r.reviewer_id where r.target_id=auth.uid() order by r.created_at desc,r.id limit 3
    ) x)) from public.trade_reviews where target_id=auth.uid());
end $$;

create table public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  carrier_id uuid not null references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  lot_id uuid not null references public.lots(id),
  agreement_id uuid references public.trade_agreements(id),
  source_key text not null,
  source_title text not null,
  carrier_name text not null,
  vehicle_label text not null,
  quantity_kg numeric(14,3) not null check(quantity_kg>0 and quantity_kg<'Infinity'::numeric),
  origin_province text not null check(length(btrim(origin_province)) between 1 and 120),
  destination_province text not null check(length(btrim(destination_province)) between 1 and 120),
  origin_address text not null check(length(btrim(origin_address)) between 1 and 500),
  destination_address text not null check(length(btrim(destination_address)) between 1 and 500),
  pickup_date date not null,
  required_type public.vehicle_type not null,
  min_temperature_c numeric(5,2),max_temperature_c numeric(5,2),
  status text not null default 'PENDING' check(status in ('PENDING','QUOTED','ACCEPTED','DECLINED','CANCELLED')),
  quote_vnd bigint check(quote_vnd>0 and quote_vnd<=1000000000000),
  quote_note text not null default '' check(length(quote_note)<=1000),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check(requester_id<>carrier_id),
  check((min_temperature_c is null)=(max_temperature_c is null)),
  check(min_temperature_c is null or (required_type='REFRIGERATED' and min_temperature_c>=-100 and max_temperature_c<=100 and min_temperature_c<=max_temperature_c)),
  check((status in ('QUOTED','ACCEPTED'))=(quote_vnd is not null) or status='CANCELLED')
);
create unique index transport_one_active_source_idx on public.transport_requests(requester_id,source_key) where status in('PENDING','QUOTED','ACCEPTED');
create index transport_requester_idx on public.transport_requests(requester_id,created_at desc);
create index transport_carrier_idx on public.transport_requests(carrier_id,created_at desc);
alter table public.transport_requests enable row level security;
revoke all on public.transport_requests from public,anon,authenticated;
grant select on public.transport_requests to authenticated;
grant all on public.transport_requests to service_role;
create policy participant_read on public.transport_requests for select to authenticated
using(auth.uid() in(requester_id,carrier_id) and logstar_private.current_app_role() in('FARMER','BUYER','CARRIER'));

create function logstar_private.valid_vehicle(v public.vehicles,kg numeric,origin text,destination text,required public.vehicle_type,temp_min numeric,temp_max numeric)
returns boolean language sql stable set search_path='' as $$
  select coalesce(v.active and v.capacity_kg>=kg and kg>0 and kg<'Infinity'::numeric
    and v.vehicle_type=required and origin=any(v.provinces) and destination=any(v.provinces)
    and exists(select 1 from public.profiles where id=v.carrier_id and role='CARRIER' and not is_suspended)
    and ((temp_min is null and temp_max is null) or (required='REFRIGERATED' and temp_min>=-100 and temp_max<=100
      and temp_min<=temp_max and v.min_temperature_c<=temp_min and v.max_temperature_c>=temp_max)),false);
$$;

create function public.find_transport_vehicles(kg numeric,origin text,destination text,required public.vehicle_type,temp_min numeric default null,temp_max numeric default null,page_number integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if logstar_private.current_app_role() is null or logstar_private.current_app_role() not in('FARMER','BUYER') then raise exception 'Requester required' using errcode='42501'; end if;
  if kg is null or kg<=0 or kg>100000000000 or kg<>round(kg,3) or length(btrim(origin)) not between 1 and 120
    or length(btrim(destination)) not between 1 and 120 or page_number is null or page_number<1 or page_number>10000 then raise exception 'Invalid filters' using errcode='23514'; end if;
  with candidates as (
    select v.id,v.carrier_id,v.vehicle_type,v.capacity_kg,v.provinces,v.min_temperature_c,v.max_temperature_c,c.company_name,
      count(*) over() total_count
    from public.vehicles v join public.carrier_profiles c on c.user_id=v.carrier_id
    where logstar_private.valid_vehicle(v,kg,btrim(origin),btrim(destination),required,temp_min,temp_max)
    order by v.capacity_kg,v.id limit 20 offset (page_number-1)*20
  ) select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(candidates)),'[]'::jsonb),'count',coalesce(max(total_count),0)) into result from candidates;
  return result;
end $$;

create function public.my_transport_sources()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if logstar_private.current_app_role()='FARMER' then
    return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
      select id lot_id,null::uuid agreement_id,title,quantity_kg,province,harvest_start available_start,harvest_end available_end
      from public.lots where farmer_id=auth.uid() and status='PUBLISHED' and harvest_end>=(now() at time zone 'Asia/Ho_Chi_Minh')::date order by created_at desc,id limit 200
    ) x);
  elsif logstar_private.current_app_role()='BUYER' then
    return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
      select l.id lot_id,a.id agreement_id,c.lot_title title,a.quantity_kg,l.province,a.delivery_date available_start,a.delivery_date available_end
      from public.trade_agreements a join public.trade_connections c on c.id=a.connection_id join public.lots l on l.id=c.lot_id
      where c.buyer_id=auth.uid() and a.delivery_date>=(now() at time zone 'Asia/Ho_Chi_Minh')::date order by a.created_at desc,a.id limit 200
    ) x);
  end if;
  raise exception 'Requester required' using errcode='42501';
end $$;

create function public.create_transport_request(target_lot_id uuid,target_agreement_id uuid,target_vehicle_id uuid,kg numeric,
  origin text,destination text,origin_detail text,destination_detail text,pickup date,required public.vehicle_type,temp_min numeric default null,temp_max numeric default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare l public.lots;v public.vehicles;a public.trade_agreements;c public.trade_connections;source text;result uuid; max_kg numeric;start_day date;end_day date;
begin
  if logstar_private.current_app_role() is null or logstar_private.current_app_role() not in('FARMER','BUYER') then raise exception 'Requester required' using errcode='42501'; end if;
  -- Lock the source first to serialize retries against the same source.
  select * into l from public.lots where id=target_lot_id for share;
  if not found then raise exception 'Source unavailable' using errcode='42501';end if;
  if logstar_private.current_app_role()='FARMER' then
    if l.farmer_id<>auth.uid() or l.status<>'PUBLISHED' or target_agreement_id is not null then raise exception 'Source unavailable' using errcode='42501'; end if;
    max_kg:=l.quantity_kg;start_day:=l.harvest_start;end_day:=l.harvest_end;source:='lot:'||l.id;
  else
    select * into a from public.trade_agreements where id=target_agreement_id and connection_id in(select id from public.trade_connections where buyer_id=auth.uid() and lot_id=l.id) for share;
    if not found then raise exception 'Agreement unavailable' using errcode='42501';end if;
    max_kg:=a.quantity_kg;start_day:=a.delivery_date;end_day:=a.delivery_date;source:='agreement:'||a.id;
  end if;
  if kg is null or kg<=0 or kg>max_kg or kg<>round(kg,3) or pickup is null or pickup<(now() at time zone 'Asia/Ho_Chi_Minh')::date
    or pickup<start_day or pickup>end_day or btrim(origin)<>l.province or required is null then raise exception 'Invalid shipment' using errcode='23514';end if;
  select * into v from public.vehicles where id=target_vehicle_id for share;
  if not found or not logstar_private.valid_vehicle(v,kg,btrim(origin),btrim(destination),required,temp_min,temp_max) then raise exception 'Vehicle unavailable' using errcode='23514';end if;
  insert into public.transport_requests(requester_id,carrier_id,vehicle_id,lot_id,agreement_id,source_key,source_title,carrier_name,vehicle_label,
    quantity_kg,origin_province,destination_province,origin_address,destination_address,pickup_date,required_type,min_temperature_c,max_temperature_c)
  values(auth.uid(),v.carrier_id,v.id,l.id,target_agreement_id,source,l.title,(select company_name from public.carrier_profiles where user_id=v.carrier_id),
    v.vehicle_type::text||' · '||v.capacity_kg||' kg',kg,btrim(origin),btrim(destination),btrim(origin_detail),btrim(destination_detail),pickup,required,temp_min,temp_max)
  returning id into result;
  return result;
end $$;

create function public.respond_transport_request(target_id uuid,decision text,price bigint default null,note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare r public.transport_requests;v public.vehicles;
begin
  select * into r from public.transport_requests where id=target_id for update;
  if not found or logstar_private.current_app_role() is null or auth.uid() not in(r.requester_id,r.carrier_id) then raise exception 'Request unavailable' using errcode='42501';end if;
  if decision='CANCELLED' and auth.uid()=r.requester_id and r.status in('PENDING','QUOTED','ACCEPTED') then
    update public.transport_requests set status='CANCELLED',updated_at=now() where id=r.id;return;
  elsif decision='DECLINED' and auth.uid()=r.carrier_id and logstar_private.current_app_role()='CARRIER' and r.status='PENDING' then
    update public.transport_requests set status='DECLINED',updated_at=now() where id=r.id;return;
  elsif decision='QUOTED' and auth.uid()=r.carrier_id and logstar_private.current_app_role()='CARRIER' and r.status='PENDING' then
    if price is null or price<=0 or price>1000000000000 or note is null or length(note)>1000 then raise exception 'Invalid quote' using errcode='23514';end if;
  elsif decision='ACCEPTED' and auth.uid()=r.requester_id and logstar_private.current_app_role() in('FARMER','BUYER') and r.status='QUOTED' then
    null;
  else raise exception 'Invalid transition' using errcode='23514';end if;
  select * into v from public.vehicles where id=r.vehicle_id for share;
  if not found or not logstar_private.valid_vehicle(v,r.quantity_kg,r.origin_province,r.destination_province,r.required_type,r.min_temperature_c,r.max_temperature_c)
    or r.pickup_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date
    or not exists(select 1 from public.profiles where id=r.requester_id and not is_suspended) then raise exception 'Shipment unavailable' using errcode='23514';end if;
  -- Do not accept a quote if its source was edited to no longer support the shipment.
  if r.agreement_id is null then
    perform 1 from public.lots where id=r.lot_id and farmer_id=r.requester_id and status='PUBLISHED'
      and quantity_kg>=r.quantity_kg and province=r.origin_province and r.pickup_date between harvest_start and harvest_end for share;
  else
    perform 1 from public.trade_agreements a join public.trade_connections c on c.id=a.connection_id
      where a.id=r.agreement_id and c.buyer_id=r.requester_id and a.quantity_kg>=r.quantity_kg and a.delivery_date=r.pickup_date for share of a,c;
  end if;
  if not found then raise exception 'Source unavailable' using errcode='23514';end if;
  update public.transport_requests set status=decision,quote_vnd=case when decision='QUOTED' then price else quote_vnd end,
    quote_note=case when decision='QUOTED' then btrim(note) else quote_note end,updated_at=now() where id=r.id;
end $$;

create function logstar_private.trade_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare c public.trade_connections;recipient uuid;prefix text;event_id text;title text;dest text;regroup boolean:=false;
begin
  if tg_table_name='trade_connections' then
    c:=new;
    if tg_op='UPDATE' and new.status=old.status then return new;end if;
    recipient:=case when auth.uid()=c.buyer_id then c.farmer_id else c.buyer_id end;
    title:=case when tg_op='INSERT' then 'Bạn có lời mời kết nối mới' when c.status='ACCEPTED' then 'Lời mời kết nối được chấp nhận' when c.status='DECLINED' then 'Lời mời kết nối bị từ chối' else 'Lời mời kết nối đã được hủy' end;
    event_id:='connection:'||c.id||':'||c.status;dest:='/invitations?connectionId='||c.id;
  else
    if tg_table_name='trade_reviews' then
      select t.* into c from public.trade_connections t join public.trade_agreements a on a.connection_id=t.id where a.id=new.agreement_id;
      recipient:=new.target_id;event_id:='review:'||new.id;title:='Bạn nhận được đánh giá giao dịch mới';dest:='/reviews';
    else
      select * into c from public.trade_connections where id=new.connection_id;
      recipient:=case when auth.uid()=c.buyer_id then c.farmer_id else c.buyer_id end;
      dest:='/negotiations?connectionId='||c.id;
      if tg_table_name='trade_messages' then
        recipient:=case when new.sender_id=c.buyer_id then c.farmer_id else c.buyer_id end;
        event_id:='message:'||c.id;title:='Bạn có tin nhắn mới từ đối tác';regroup:=true;
      elsif tg_table_name='trade_offers' then
        if tg_op='UPDATE' and new.status=old.status then return new;end if;
        event_id:='offer:'||new.id||':'||new.status;title:=case new.status when 'PENDING' then 'Bạn có đề nghị giao dịch mới' when 'ACCEPTED' then 'Đề nghị giao dịch được chấp nhận' when 'REJECTED' then 'Đề nghị giao dịch bị từ chối' when 'WITHDRAWN' then 'Đối tác đã rút đề nghị giao dịch' else 'Đã có thỏa thuận thay thế đề nghị' end;
      else
        if tg_op='INSERT' then return new;end if;
        if new.buyer_completed_at is not distinct from old.buyer_completed_at and new.farmer_completed_at is not distinct from old.farmer_completed_at then return new;end if;
        event_id:='agreement:'||new.id||':'||coalesce(new.buyer_completed_at::text,'')||':'||coalesce(new.farmer_completed_at::text,'');
        title:=case when new.status='COMPLETED' then 'Giao dịch hoàn tất, bạn có thể đánh giá' else 'Đối tác đã xác nhận hoàn tất, hãy kiểm tra và xác nhận' end;
      end if;
    end if;
  end if;
  prefix:=case when recipient=c.farmer_id then '/farmer' else '/buyer' end;
  perform logstar_private.notify(recipient,event_id,tg_table_name,title,prefix||dest,regroup);
  return new;
end $$;
create trigger notify_trade_connection after insert or update on public.trade_connections for each row execute function logstar_private.trade_notification();
create trigger notify_trade_message after insert on public.trade_messages for each row execute function logstar_private.trade_notification();
create trigger notify_trade_offer after insert or update on public.trade_offers for each row execute function logstar_private.trade_notification();
create trigger notify_trade_agreement after update on public.trade_agreements for each row execute function logstar_private.trade_notification();
create trigger notify_trade_review after insert on public.trade_reviews for each row execute function logstar_private.trade_notification();

create function logstar_private.transport_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;dest text;requester_role text;
begin
  if tg_op='UPDATE' and new.status=old.status then return new;end if;
  recipient:=case when auth.uid()=new.carrier_id then new.requester_id else new.carrier_id end;
  select lower(role::text) into requester_role from public.profiles where id=new.requester_id;
  dest:=case when recipient=new.carrier_id then '/carrier/requests' else '/'||requester_role||'/transport' end||'?requestId='||new.id;
  perform logstar_private.notify(recipient,'transport:'||new.id||':'||new.status,'transport',case new.status when 'PENDING' then 'Bạn có yêu cầu vận chuyển mới' when 'QUOTED' then 'Nhà xe đã gửi báo giá vận chuyển' when 'ACCEPTED' then 'Báo giá vận chuyển được chấp nhận' when 'DECLINED' then 'Nhà xe đã từ chối yêu cầu' else 'Yêu cầu vận chuyển đã được hủy' end,dest);
  return new;
end $$;
create trigger notify_transport after insert or update on public.transport_requests for each row execute function logstar_private.transport_notification();

-- Transactional matching events: product identity, dates, amount and a useful price fit.
-- No distance filter and no model invocation; existing search remains the source of ranking.
create function logstar_private.match_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare l public.lots;r public.buy_requests;version_key text;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if tg_op='UPDATE' then
    if tg_table_name='lots' then
      if row(new.status,new.fruit_type_id,new.variety_id,new.quantity_kg,new.price_vnd_per_kg,new.harvest_start,new.harvest_end)
        is not distinct from row(old.status,old.fruit_type_id,old.variety_id,old.quantity_kg,old.price_vnd_per_kg,old.harvest_start,old.harvest_end) then return new;end if;
    else
      if row(new.status,new.fruit_type_id,new.variety_id,new.target_quantity_kg,new.min_lot_quantity_kg,new.allow_partial,new.min_price_vnd_per_kg,new.max_price_vnd_per_kg,new.required_start,new.required_end)
        is not distinct from row(old.status,old.fruit_type_id,old.variety_id,old.target_quantity_kg,old.min_lot_quantity_kg,old.allow_partial,old.min_price_vnd_per_kg,old.max_price_vnd_per_kg,old.required_start,old.required_end) then return new;end if;
    end if;
  end if;
  -- A pair is notified once per direction; edits do not spam the same recipient.
  for l in select * from public.lots where status='PUBLISHED' and harvest_end>=today and (tg_table_name<>'lots' or id=new.id) loop
    for r in select * from public.buy_requests where status='OPEN' and required_end>=today
      and (tg_table_name<>'buy_requests' or id=new.id) and fruit_type_id=l.fruit_type_id
      and (variety_id is null or variety_id=l.variety_id) and required_start<=l.harvest_end and required_end>=l.harvest_start
      and (min_lot_quantity_kg is null or min_lot_quantity_kg<=l.quantity_kg)
      and (allow_partial or target_quantity_kg<=l.quantity_kg)
      and l.price_vnd_per_kg between min_price_vnd_per_kg and max_price_vnd_per_kg
    loop
      if not exists(select 1 from public.profiles where id=l.farmer_id and not is_suspended) or not exists(select 1 from public.profiles where id=r.buyer_id and not is_suspended) then continue;end if;
      if tg_table_name='buy_requests' then
        perform logstar_private.notify(l.farmer_id,'matching-request:'||r.id,'matching','Có nhu cầu thu mua phù hợp với lô của bạn','/farmer/matches?lotId='||l.id);
      else
        perform logstar_private.notify(r.buyer_id,'matching-lot:'||l.id,'matching','Có lô hàng phù hợp nhu cầu thu mua','/buyer/lots?requestId='||r.id);
      end if;
    end loop;
  end loop;
  return new;
end $$;
create index lots_matching_notification_idx on public.lots(fruit_type_id,harvest_end) where status='PUBLISHED';
create index requests_matching_notification_idx on public.buy_requests(fruit_type_id,required_end) where status='OPEN';
create trigger notify_matching_lot after insert or update on public.lots for each row execute function logstar_private.match_notification();
create trigger notify_matching_request after insert or update on public.buy_requests for each row execute function logstar_private.match_notification();

-- Explicit allowlist; internal helpers cannot be called by browser clients.
revoke all on function logstar_private.notify(uuid,text,text,text,text,boolean),logstar_private.valid_vehicle(public.vehicles,numeric,text,text,public.vehicle_type,numeric,numeric),
  logstar_private.trade_notification(),logstar_private.transport_notification(),logstar_private.match_notification() from public,anon,authenticated;
revoke all on function public.mark_notifications_read(uuid,timestamptz),public.my_review_summary(),public.my_transport_sources(),
  public.find_transport_vehicles(numeric,text,text,public.vehicle_type,numeric,numeric,integer),
  public.create_transport_request(uuid,uuid,uuid,numeric,text,text,text,text,date,public.vehicle_type,numeric,numeric),
  public.respond_transport_request(uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.mark_notifications_read(uuid,timestamptz),public.my_review_summary(),public.my_transport_sources(),
  public.find_transport_vehicles(numeric,text,text,public.vehicle_type,numeric,numeric,integer),
  public.create_transport_request(uuid,uuid,uuid,numeric,text,text,text,text,date,public.vehicle_type,numeric,numeric),
  public.respond_transport_request(uuid,text,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
