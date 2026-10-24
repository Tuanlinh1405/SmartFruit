-- Storage uploads require a persisted draft. Only complete, photographed lots
-- may be published. Deferred checks allow atomic SQL imports with their photos.
begin;
do $$ begin
  if exists(select 1 from public.lots l where l.status='PUBLISHED'
    and not exists(select 1 from public.lot_images i where i.lot_id=l.id)) then
    raise exception 'Attach photos to existing published lots before applying this migration' using errcode='23514';
  end if;
end $$;

alter table public.lots add column image_count smallint not null default 0
  constraint lot_image_count_range check(image_count between 0 and 8);
alter table public.lot_images add column is_ai_generated boolean not null default false;
update public.lots l set image_count=(select count(*) from public.lot_images i where i.lot_id=l.id);
-- These filenames belong exclusively to the generated seed assets, never user uploads.
update public.lot_images set is_ai_generated=true
where storage_path ~ '/ai-seed-20261024-(ri6|monthong|jackfruit_thai|dragon_red|dragon_white)-[0-9a-f]{10}\.jpg$';

create function logstar_private.initialize_lot_image_count()
returns trigger language plpgsql set search_path='' as $$
begin new.image_count:=0; return new; end $$;
create trigger initialize_lot_image_count before insert on public.lots
for each row execute function logstar_private.initialize_lot_image_count();

create function logstar_private.sync_lot_image_count()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Updating the parent serializes concurrent image deletions, including at
  -- repeatable-read isolation. A count obtained only with SELECT could go stale.
  if tg_op='INSERT' then
    update public.lots set image_count=image_count+1 where id=new.lot_id;
    return new;
  else
    update public.lots set image_count=image_count-1 where id=old.lot_id;
    return old;
  end if;
end $$;
create trigger sync_lot_image_count after insert or delete on public.lot_images
for each row execute function logstar_private.sync_lot_image_count();

create function logstar_private.protect_lot_image_identity()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.lot_id is distinct from old.lot_id then
    raise exception 'Image cannot change lots' using errcode='42501';
  end if;
  if new.storage_path is distinct from old.storage_path then new.is_ai_generated:=false; end if;
  return new;
end $$;
create trigger protect_lot_image_identity before update on public.lot_images
for each row execute function logstar_private.protect_lot_image_identity();

create function logstar_private.require_published_lot_photo()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.lots where id=new.id and status='PUBLISHED' and image_count=0) then
    raise exception 'Published lots require at least one product photo'
      using errcode='23514',constraint='published_lot_requires_image';
  end if;
  return null;
end $$;
create constraint trigger published_lot_requires_image after insert or update on public.lots
deferrable initially deferred for each row execute function logstar_private.require_published_lot_photo();

-- New columns deliberately receive no INSERT/UPDATE grants for clients.
-- Existing column-scoped grants leave image_count and provenance server-owned.
revoke all on function logstar_private.initialize_lot_image_count(),
  logstar_private.sync_lot_image_count(),logstar_private.protect_lot_image_identity(),
  logstar_private.require_published_lot_photo() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
