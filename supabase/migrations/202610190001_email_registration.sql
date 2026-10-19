begin;

-- Public signup may choose one ordinary role once, after email verification.
-- Existing accounts keep their administrator-assigned role. User metadata can
-- never select ADMIN or change a role after enrollment.
create or replace function public.complete_registration()
returns public.app_role language plpgsql security definer set search_path = '' as $$
declare assigned public.app_role; suspended boolean; requested text; confirmed timestamptz; account_email text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select p.role,p.is_suspended into assigned,suspended from public.profiles p
    where p.id=(select auth.uid()) for update;
  if not found or suspended then raise exception 'Account unavailable' using errcode='42501'; end if;
  if assigned is not null then return assigned; end if;
  select u.raw_user_meta_data->>'registration_role',u.email_confirmed_at,u.email
    into requested,confirmed,account_email from auth.users u where u.id=(select auth.uid());
  if confirmed is null or nullif(account_email,'') is null then
    raise exception 'Confirm your email before registration' using errcode='42501';
  end if;
  if requested is null or requested not in ('FARMER','BUYER','CARRIER') then
    raise exception 'Invalid registration role' using errcode='22023';
  end if;
  update public.profiles set role=requested::public.app_role where id=(select auth.uid()) and role is null
    returning role into assigned;
  return assigned;
end;
$$;
revoke all on function public.complete_registration() from public,anon;
grant execute on function public.complete_registration() to authenticated;
notify pgrst, 'reload schema';
commit;
