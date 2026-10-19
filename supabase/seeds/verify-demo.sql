-- Read-only summary of the reserved LogStar demo dataset, not all user records.
select 'profiles' as dataset, count(*) as records from public.profiles where id::text like '71000000-%'
union all select 'farmer_profiles',count(*) from public.farmer_profiles where user_id::text like '71000000-%'
union all select 'buyer_profiles',count(*) from public.buyer_profiles where user_id::text like '71000000-%'
union all select 'carrier_profiles',count(*) from public.carrier_profiles where user_id::text like '71000000-%'
union all select 'marketplace_profiles',count(*) from public.marketplace_profiles where user_id::text like '71000000-%'
union all select 'lots',count(*) from public.lots where id::text like '72000000-%'
union all select 'lot_private_details',count(*) from public.lot_private_details where lot_id::text like '72000000-%'
union all select 'buy_requests',count(*) from public.buy_requests where id::text like '73000000-%'
union all select 'vehicles',count(*) from public.vehicles where id::text like '74000000-%';

-- Three positive pairs and one empty-state request. This checks candidate inputs;
-- actual weighted scoring remains TypeScript work from the TDD.
select r.title as request, count(l.id) as candidate_lots
from public.buy_requests r
left join public.lots l on l.status='PUBLISHED'
  and l.id::text like '72000000-%'
  and l.fruit_type_id=r.fruit_type_id
  and (r.variety_id is null or l.variety_id=r.variety_id)
  and l.harvest_start<=r.required_end and l.harvest_end>=r.required_start
  and l.price_vnd_per_kg between r.min_price_vnd_per_kg and r.max_price_vnd_per_kg
  and (r.min_lot_quantity_kg is null or l.quantity_kg>=r.min_lot_quantity_kg)
where r.id::text like '73000000-%' and r.status='OPEN'
group by r.id,r.title order by r.id;
