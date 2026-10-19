-- LogStar demo dataset v1, requested 2026-10-15.
-- Apply AFTER migrations and supabase/seed.sql. Intended for the shared demo project.
-- All identities, farms, requests and vehicles are fictional and labelled DEMO.
-- Auth rows are non-login placeholders: no password, confirmation or identities.
-- INSERT ONLY: stable IDs + ON CONFLICT DO NOTHING preserve edits on reruns.
begin;

-- Prevent concurrent runs from attempting the same reserved fixture set.
select pg_advisory_xact_lock(20261015, 1);

insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data) values
 ('71000000-0000-4000-8000-000000000001','farmer.minh-ut@seed.logstar.invalid','{"app_role":"FARMER","seed_batch":"logstar-demo-v1"}','{"full_name":"[DEMO] Nguyễn Minh Út","is_demo":true}'),
 ('71000000-0000-4000-8000-000000000002','farmer.an-phu@seed.logstar.invalid','{"app_role":"FARMER","seed_batch":"logstar-demo-v1"}','{"full_name":"[DEMO] Trần An Phú","is_demo":true}'),
 ('71000000-0000-4000-8000-000000000003','farmer.thanh-long@seed.logstar.invalid','{"app_role":"FARMER","seed_batch":"logstar-demo-v1"}','{"full_name":"[DEMO] Lê Thanh Bình","is_demo":true}'),
 ('71000000-0000-4000-8000-000000000004','buyer.van-dat@seed.logstar.invalid','{"app_role":"BUYER","seed_batch":"logstar-demo-v1"}','{"full_name":"[DEMO] Buyer Vạn Đạt","is_demo":true}'),
 ('71000000-0000-4000-8000-000000000005','buyer.an-binh@seed.logstar.invalid','{"app_role":"BUYER","seed_batch":"logstar-demo-v1"}','{"full_name":"[DEMO] Buyer An Bình","is_demo":true}'),
 ('71000000-0000-4000-8000-000000000006','carrier.minh-phat@seed.logstar.invalid','{"app_role":"CARRIER","seed_batch":"logstar-demo-v1"}','{"full_name":"[DEMO] Carrier Minh Phát","is_demo":true}')
on conflict (id) do nothing;

-- Never attach this demo dataset to an unrelated account with a colliding ID.
do $$
begin
  if (select count(*) from auth.users u join public.profiles p on p.id=u.id
      where u.id in ('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002',
        '71000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000004',
        '71000000-0000-4000-8000-000000000005','71000000-0000-4000-8000-000000000006')
        and u.raw_app_meta_data->>'seed_batch'='logstar-demo-v1'
        and u.email like '%@seed.logstar.invalid'
        and p.role::text=u.raw_app_meta_data->>'app_role') <> 6 then
    raise exception 'Reserved demo accounts conflict with existing data; nothing was changed';
  end if;
  if (select count(*) from public.fruit_types where code in ('durian','jackfruit','dragon_fruit')) <> 3
     or (select count(*) from public.fruit_varieties where code in ('ri6','monthong','thai','red_flesh','white_flesh')) <> 5 then
    raise exception 'Reference fruit catalog is missing; apply supabase/seed.sql first';
  end if;
end;
$$;

insert into public.farmer_profiles
 (user_id,farm_name,province,address,area_m2,tree_count,orchard_age_years,annual_yield_kg,cultivated_varieties,certifications,growing_area_code)
values
 ('71000000-0000-4000-8000-000000000001','[DEMO] Nhà vườn Minh Út','Đồng Nai','Khu canh tác mẫu Minh Út - địa chỉ minh họa',120000,2400,8,180000,array['Ri6','Monthong'],array['VietGAP'],'DEMO-DN-001'),
 ('71000000-0000-4000-8000-000000000002','[DEMO] Hợp tác xã An Phú','Lâm Đồng','Khu canh tác mẫu An Phú - địa chỉ minh họa',80000,1600,6,110000,array['Mít Thái','Ri6'],array['VietGAP','GlobalGAP'],'DEMO-LD-002'),
 ('71000000-0000-4000-8000-000000000003','[DEMO] Vườn Thanh Long Bình An','Tây Ninh','Khu canh tác mẫu Bình An - địa chỉ minh họa',50000,1200,5,90000,array['Ruột đỏ','Ruột trắng'],array['VietGAP'],'DEMO-TN-003')
on conflict (user_id) do nothing;

insert into public.buyer_profiles(user_id,organization_name,province,address) values
 ('71000000-0000-4000-8000-000000000004','[DEMO] Nông sản Vạn Đạt','Đồng Nai','Kho thu mua mẫu Vạn Đạt - địa chỉ minh họa'),
 ('71000000-0000-4000-8000-000000000005','[DEMO] Thu mua An Bình','Tây Ninh','Kho thu mua mẫu An Bình - địa chỉ minh họa')
on conflict (user_id) do nothing;

insert into public.carrier_profiles(user_id,company_name,province,address,service_provinces) values
 ('71000000-0000-4000-8000-000000000006','[DEMO] Vận tải Minh Phát','Đồng Nai','Bãi xe mẫu Minh Phát - địa chỉ minh họa',array['Đồng Nai','Lâm Đồng','Tây Ninh'])
on conflict (user_id) do nothing;

-- Resolve reference catalog by natural keys, not assumed UUIDs.
with fixtures(id,farmer_id,fruit_code,variety_code,title,grade,quantity_kg,price,harvest_start,harvest_end,province,certifications,packaging,selling_method,description,status) as (values
 ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','durian','ri6','[DEMO] Sầu riêng Ri6 loại A - 15 tấn','A',15000,65000,'2026-10-20','2026-10-28','Đồng Nai',array['VietGAP'],array['CARTON'],'BY_GRADE','Dữ liệu minh họa: lô khớp nhu cầu Ri6 của Buyer Vạn Đạt.','PUBLISHED'),
 ('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000001','durian','monthong','[DEMO] Sầu riêng Monthong - 12 tấn','A',12000,72000,'2026-10-24','2026-11-02','Đồng Nai',array['VietGAP'],array['PLASTIC_CRATE','CARTON'],'PARTIAL','Dữ liệu minh họa: giống Monthong để kiểm thử bộ lọc.','PUBLISHED'),
 ('72000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000002','jackfruit','thai','[DEMO] Mít Thái loại A - 8 tấn','A',8000,14000,'2026-10-18','2026-10-25','Lâm Đồng',array['VietGAP'],array['BULK','PLASTIC_CRATE'],'PARTIAL','Dữ liệu minh họa: lô mít đáp ứng một phần nhu cầu 12 tấn.','PUBLISHED'),
 ('72000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000003','dragon_fruit','red_flesh','[DEMO] Thanh long ruột đỏ - 10 tấn','A',10000,20000,'2026-10-22','2026-10-30','Tây Ninh',array['VietGAP'],array['CARTON'],'BY_GRADE','Dữ liệu minh họa: lô thanh long cho Buyer An Bình.','PUBLISHED'),
 ('72000000-0000-4000-8000-000000000005','71000000-0000-4000-8000-000000000002','durian','ri6','[DEMO] Ri6 dự kiến tháng 11 - bản nháp','B',6000,63000,'2026-11-05','2026-11-10','Lâm Đồng',array['VietGAP'],array['PLASTIC_CRATE'],'PARTIAL','Dữ liệu minh họa: DRAFT chỉ Farmer sở hữu được đọc.','DRAFT'),
 ('72000000-0000-4000-8000-000000000006','71000000-0000-4000-8000-000000000001','durian','ri6','[DEMO] Ri6 đợt đầu tháng - đã đóng','A',5000,68000,'2026-10-03','2026-10-08','Đồng Nai',array['VietGAP'],array['CARTON'],'BY_GRADE','Dữ liệu minh họa: CLOSED không xuất hiện trong tìm kiếm Buyer.','CLOSED')
)
insert into public.lots(id,farmer_id,fruit_type_id,variety_id,title,grade,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,certifications,packaging_options,selling_method,description,status)
select f.id::uuid,f.farmer_id::uuid,t.id,v.id,f.title,f.grade,f.quantity_kg,f.price,
 f.harvest_start::date,f.harvest_end::date,f.province,f.certifications,f.packaging,
 f.selling_method::public.trade_method,f.description,f.status::public.lot_status
from fixtures f join public.fruit_types t on t.code=f.fruit_code
join public.fruit_varieties v on v.fruit_type_id=t.id and v.code=f.variety_code
on conflict (id) do nothing;

with fixtures(lot_id,price_floor_vnd_per_kg,internal_notes) as (values
 ('72000000-0000-4000-8000-000000000001',60000,'[DEMO] Giá sàn nội bộ Farmer, không công khai cho Buyer.'),
 ('72000000-0000-4000-8000-000000000002',68000,'[DEMO] Giá sàn Monthong.'),
 ('72000000-0000-4000-8000-000000000003',12000,'[DEMO] Giá sàn mít Thái.'),
 ('72000000-0000-4000-8000-000000000004',18000,'[DEMO] Giá sàn thanh long.'),
 ('72000000-0000-4000-8000-000000000005',58000,'[DEMO] Ghi chú riêng của bản nháp.'),
 ('72000000-0000-4000-8000-000000000006',62000,'[DEMO] Dữ liệu lô đã đóng.')
)
insert into public.lot_private_details(lot_id,price_floor_vnd_per_kg,internal_notes)
select f.lot_id::uuid,f.price_floor_vnd_per_kg,f.internal_notes from fixtures f
where not exists (select 1 from public.lot_private_details d where d.lot_id=f.lot_id::uuid)
on conflict (lot_id) do nothing;

with fixtures(id,buyer_id,fruit_code,variety_code,title,grade,target_kg,min_lot_kg,min_price,max_price,required_start,required_end,provinces,quality,packaging,buying_method,transport_by,notes,status) as (values
 ('73000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000004','durian','ri6','[DEMO] Thu mua Ri6 - mục tiêu 50 tấn','A',50000,5000,60000,70000,'2026-10-20','2026-10-30',array['Đồng Nai','Lâm Đồng'],array['VietGAP'],array['CARTON'],'BY_GRADE','BUYER','Dữ liệu minh họa: chấp nhận lô nhỏ đáp ứng một phần nhu cầu.','OPEN'),
 ('73000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000004','jackfruit','thai','[DEMO] Thu mua mít Thái - 12 tấn','A',12000,3000,12000,18000,'2026-10-18','2026-10-26',array['Lâm Đồng'],array['VietGAP'],array['PLASTIC_CRATE','BULK'],'PARTIAL','UNDECIDED','Dữ liệu minh họa: khớp lô mít 8 tấn của HTX An Phú.','OPEN'),
 ('73000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000005','dragon_fruit','red_flesh','[DEMO] Thu mua thanh long ruột đỏ - 20 tấn','A',20000,5000,16000,22000,'2026-10-21','2026-10-31',array['Tây Ninh'],array['VietGAP'],array['CARTON'],'BY_GRADE','FARMER','Dữ liệu minh họa: khớp lô thanh long 10 tấn.','OPEN'),
 ('73000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000005','durian','monthong','[DEMO] Nhu cầu Monthong - bản nháp','A',10000,3000,70000,80000,'2026-11-01','2026-11-15',array['Đồng Nai'],array['VietGAP'],array['CARTON'],'PARTIAL','BUYER','Dữ liệu minh họa: DRAFT chỉ Buyer sở hữu được đọc.','DRAFT'),
 ('73000000-0000-4000-8000-000000000005','71000000-0000-4000-8000-000000000005','durian','ri6','[DEMO] Ri6 giữa tháng 11 - chưa có lô phù hợp','A',10000,3000,60000,65000,'2026-11-15','2026-11-20',array['Đồng Nai'],array['VietGAP'],array['CARTON'],'PARTIAL','UNDECIDED','Dữ liệu minh họa: kiểm thử empty state do thời gian không giao nhau.','OPEN')
)
insert into public.buy_requests(id,buyer_id,fruit_type_id,variety_id,title,grade,target_quantity_kg,min_lot_quantity_kg,allow_partial,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,preferred_provinces,quality_requirements,packaging_options,buying_method,transport_by,notes,status)
select f.id::uuid,f.buyer_id::uuid,t.id,v.id,f.title,f.grade,f.target_kg,f.min_lot_kg,true,
 f.min_price,f.max_price,f.required_start::date,f.required_end::date,f.provinces,
 f.quality,f.packaging,f.buying_method::public.trade_method,
 f.transport_by::public.transport_responsibility,f.notes,f.status::public.buy_request_status
from fixtures f join public.fruit_types t on t.code=f.fruit_code
join public.fruit_varieties v on v.fruit_type_id=t.id and v.code=f.variety_code
on conflict (id) do nothing;

insert into public.vehicles(id,carrier_id,license_plate,vehicle_type,capacity_kg,provinces,min_temperature_c,max_temperature_c) values
 ('74000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000006','DEMO-TRUCK-01','REFRIGERATED',15000,array['Đồng Nai','Lâm Đồng'],4,8),
 ('74000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000006','DEMO-TRUCK-02','TARPAULIN',8000,array['Đồng Nai','Tây Ninh'],null,null),
 ('74000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000006','DEMO-TRUCK-03','REFRIGERATED',5000,array['Đồng Nai','Tây Ninh','Lâm Đồng'],-5,5)
on conflict (id) do nothing;

commit;
