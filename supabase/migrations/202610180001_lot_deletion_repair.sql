begin;

-- The object INSERT and final lot DELETE take conflicting locks on the same lot.
-- A pending upload cannot insert metadata after its lot has been deleted.
create or replace function logstar_private.can_upload_lot_image(object_name text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select logstar_private.current_app_role()) is distinct from 'FARMER'::public.app_role
     or object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}\.(jpg|jpeg|png|webp)$'
     or split_part(object_name,'/',1) <> (select auth.uid())::text then return false; end if;
  perform 1 from public.lots where id::text = split_part(object_name,'/',2)
    and farmer_id = (select auth.uid()) for key share;
  return found;
end;
$$;

create or replace function logstar_private.prevent_lot_delete_with_files()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.lot_images where lot_id = old.id)
     or exists(select 1 from storage.objects where bucket_id = 'lot-images'
       and split_part(name,'/',1) = old.farmer_id::text and split_part(name,'/',2) = old.id::text) then
    raise exception 'Clean up lot images through Storage before deleting the lot' using errcode = '23514';
  end if;
  return old;
end;
$$;
drop trigger if exists prevent_lot_delete_with_files on public.lots;
create trigger prevent_lot_delete_with_files before delete on public.lots
for each row execute function logstar_private.prevent_lot_delete_with_files();

create or replace function public.replace_lot_image(image_id uuid, new_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_lot uuid;
begin
  if (select logstar_private.current_app_role()) is distinct from 'FARMER'::public.app_role then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  select i.lot_id into target_lot from public.lot_images i join public.lots l on l.id = i.lot_id
    where i.id = image_id and l.farmer_id = (select auth.uid());
  if target_lot is null then raise exception 'Access denied' using errcode = '42501'; end if;
  perform 1 from public.lots where id = target_lot and farmer_id = (select auth.uid()) for update;
  if not found then raise exception 'Access denied' using errcode = '42501'; end if;
  -- Existing validation trigger checks file existence and the exact owner/lot folder.
  update public.lot_images set storage_path = new_path where id = image_id and lot_id = target_lot;
  if not found then raise exception 'Image no longer exists' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.delete_empty_lot(lot_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select logstar_private.current_app_role()) is distinct from 'FARMER'::public.app_role then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  perform 1 from public.lots where id = lot_id and farmer_id = (select auth.uid()) for update;
  if not found then raise exception 'Access denied' using errcode = '42501'; end if;
  -- The DELETE trigger refuses linked images and unlinked Storage objects alike.
  delete from public.lots where id = lot_id and farmer_id = (select auth.uid());
end;
$$;
-- Check every connection status, including cancelled/declined invitations.
-- Locking the lot conflicts with open_trade_connection's FOR SHARE lock.
create or replace function public.prepare_lot_deletion(lot_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select logstar_private.current_app_role()) is distinct from 'FARMER'::public.app_role then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  perform 1 from public.lots where id = lot_id and farmer_id = (select auth.uid()) for update;
  if not found then raise exception 'Access denied' using errcode = '42501'; end if;
  if exists(select 1 from public.trade_connections c where c.lot_id = prepare_lot_deletion.lot_id) then
    raise exception 'Lot has connection history; close it instead' using errcode = '23503';
  end if;
  update public.lots set status = 'CLOSED' where id = lot_id;
end;
$$;
revoke all on function public.prepare_lot_deletion(uuid) from public, anon;
grant execute on function public.prepare_lot_deletion(uuid) to authenticated;
revoke all on function public.replace_lot_image(uuid,text), public.delete_empty_lot(uuid) from public, anon;
grant execute on function public.replace_lot_image(uuid,text), public.delete_empty_lot(uuid) to authenticated;
revoke all on function logstar_private.prevent_lot_delete_with_files() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;


