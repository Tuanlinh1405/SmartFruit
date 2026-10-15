-- Reference catalog only. Safe to rerun; does not create demo accounts or overwrite names.
begin;
insert into public.fruit_types(id, code, name) values
 ('10000000-0000-4000-8000-000000000001','durian','Sầu riêng'),
 ('10000000-0000-4000-8000-000000000002','jackfruit','Mít'),
 ('10000000-0000-4000-8000-000000000003','dragon_fruit','Thanh long')
on conflict (code) do nothing;

insert into public.fruit_varieties(id, fruit_type_id, code, name)
select v.id::uuid, t.id, v.code, v.name
from (values
 ('20000000-0000-4000-8000-000000000001','durian','ri6','Ri6'),
 ('20000000-0000-4000-8000-000000000002','durian','monthong','Monthong'),
 ('20000000-0000-4000-8000-000000000003','jackfruit','thai','Mít Thái'),
 ('20000000-0000-4000-8000-000000000004','dragon_fruit','red_flesh','Ruột đỏ'),
 ('20000000-0000-4000-8000-000000000005','dragon_fruit','white_flesh','Ruột trắng')
) as v(id, type_code, code, name)
join public.fruit_types t on t.code = v.type_code
on conflict (fruit_type_id, code) do nothing;
-- A fresh install seeds catalog AFTER migrations; initialize matching aliases
-- here too, while retaining compatibility with projects without hybrid search.
do $$ begin
  if to_regclass('public.fruit_type_aliases') is not null then
    insert into public.fruit_type_aliases(fruit_type_id, alias)
      select id, name from public.fruit_types on conflict do nothing;
    insert into public.fruit_variety_aliases(variety_id, alias)
      select id, name from public.fruit_varieties on conflict do nothing;
  end if;
end $$;
commit;
