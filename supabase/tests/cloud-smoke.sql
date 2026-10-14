-- Run only AFTER schema deployment. All synthetic fixtures are rolled back by
-- an intentional subtransaction exception; this creates NO persistent accounts.
-- Does not upload files or modify Storage system tables.
do $smoke$
declare checks integer := 0; changed integer;
begin
  begin
    insert into auth.users(id, raw_app_meta_data, raw_user_meta_data) values
      ('99000000-0000-4000-8000-000000000001','{"app_role":"FARMER"}','{"full_name":"Schema test Farmer"}'),
      ('99000000-0000-4000-8000-000000000002','{"app_role":"BUYER"}','{"full_name":"Schema test Buyer"}'),
      ('99000000-0000-4000-8000-000000000003','{"app_role":"BUYER"}','{"full_name":"Schema test Buyer 2"}'),
      ('99000000-0000-4000-8000-000000000004','{}','{"role":"ADMIN","app_role":"ADMIN"}');
    if (select role from public.profiles where id='99000000-0000-4000-8000-000000000004') is not null then
      raise exception 'User metadata escalated role';
    end if; checks := checks + 1;

    insert into public.farmer_profiles(user_id,farm_name,province)
    values ('99000000-0000-4000-8000-000000000001','Schema test Farm','Dong Nai');
    insert into public.buyer_profiles(user_id,organization_name,province) values
      ('99000000-0000-4000-8000-000000000002','Schema test Buyer','Dong Nai'),
      ('99000000-0000-4000-8000-000000000003','Schema test Buyer 2','Dong Nai');
    insert into public.lots(id,farmer_id,fruit_type_id,title,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,status) values
      ('99100000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Published schema test',15000,65000,'2026-10-15','2026-10-20','Dong Nai','PUBLISHED'),
      ('99100000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Draft schema test',12000,65000,'2026-10-15','2026-10-20','Dong Nai','DRAFT');
    insert into public.lot_private_details(lot_id,price_floor_vnd_per_kg)
      values ('99100000-0000-4000-8000-000000000001',60000);
    insert into public.buy_requests(id,buyer_id,fruit_type_id,title,target_quantity_kg,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,status) values
      ('99200000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Open schema test',50000,60000,70000,'2026-10-15','2026-10-20','OPEN'),
      ('99200000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Draft schema test',50000,60000,70000,'2026-10-15','2026-10-20','DRAFT');

    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000002',true);
    perform set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
    if (select count(*) from public.profiles) <> 1 then raise exception 'Profile ownership failed'; end if; checks := checks + 1;
    if (select count(*) from public.lots where id in ('99100000-0000-4000-8000-000000000001','99100000-0000-4000-8000-000000000002')) <> 1 then raise exception 'Buyer lot visibility failed'; end if; checks := checks + 1;
    if exists(select 1 from public.lot_private_details where lot_id='99100000-0000-4000-8000-000000000001') then raise exception 'Private floor exposed'; end if; checks := checks + 1;
    if exists(select 1 from public.farmer_profiles) then raise exception 'Private Farmer profile exposed'; end if; checks := checks + 1;
    if not exists(select 1 from public.marketplace_profiles where user_id='99000000-0000-4000-8000-000000000001') then raise exception 'Safe Farmer identity unavailable'; end if; checks := checks + 1;
    begin
      update public.profiles set role='ADMIN' where id='99000000-0000-4000-8000-000000000002';
      raise exception 'Role mutation was allowed';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin
      update public.buy_requests set buyer_id='99000000-0000-4000-8000-000000000003' where id='99200000-0000-4000-8000-000000000001';
      raise exception 'Request owner mutation was allowed';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin
      update public.buy_requests set target_quantity_kg=-1 where id='99200000-0000-4000-8000-000000000001';
      raise exception 'Negative demand was allowed';
    exception when check_violation then checks := checks + 1; end;

    perform set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000003',true);
    perform set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
    if exists(select 1 from public.buy_requests where id in ('99200000-0000-4000-8000-000000000001','99200000-0000-4000-8000-000000000002')) then raise exception 'Other Buyer requests exposed'; end if; checks := checks + 1;
    update public.buy_requests set title='Hacked' where id='99200000-0000-4000-8000-000000000001';
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'Other Buyer request was modified'; end if; checks := checks + 1;

    perform set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true);
    perform set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    if (select count(*) from public.lots where id in ('99100000-0000-4000-8000-000000000001','99100000-0000-4000-8000-000000000002')) <> 2 then raise exception 'Farmer own lots unavailable'; end if; checks := checks + 1;
    if (select count(*) from public.buy_requests where id in ('99200000-0000-4000-8000-000000000001','99200000-0000-4000-8000-000000000002')) <> 1 then raise exception 'Farmer request visibility failed'; end if; checks := checks + 1;
    if not logstar_private.can_upload_lot_image('99000000-0000-4000-8000-000000000001/99100000-0000-4000-8000-000000000001/test.jpg') then raise exception 'Valid image upload path denied'; end if; checks := checks + 1;
    if logstar_private.can_upload_lot_image('99000000-0000-4000-8000-000000000003/99100000-0000-4000-8000-000000000001/test.jpg') then raise exception 'Forged image path allowed'; end if; checks := checks + 1;
    begin
      update public.lot_private_details set price_floor_vnd_per_kg=66000 where lot_id='99100000-0000-4000-8000-000000000001';
      raise exception 'Invalid negotiation floor allowed';
    exception when check_violation then checks := checks + 1; end;
    execute 'reset role';

    -- Force all fixture writes and role settings above to roll back.
    raise exception using errcode='ZX001',message='Intentional fixture rollback';
  exception when sqlstate 'ZX001' then null;
  end;
  if checks <> 16 then raise exception 'Expected 16 checks; got %', checks; end if;
  if exists(select 1 from auth.users where id in ('99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000003','99000000-0000-4000-8000-000000000004')) then
    raise exception 'Fixture rollback failed';
  end if;
end;
$smoke$;
select 'PASS: 16 security checks; all temporary fixtures rolled back' as cloud_smoke_result;
