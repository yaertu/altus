-- yaaTeslimat v1.8.2 - ensure the initial store account is administrator.
-- Guarded: runs only when there is exactly one profile and no admin/office profile.

do $$
declare
  profile_count integer;
  manager_count integer;
begin
  select count(*) into profile_count from public.profiles;
  select count(*) into manager_count from public.profiles where role in ('admin','office');

  if profile_count = 1 and manager_count = 0 then
    update public.profiles
    set role='admin', active=true
    where id=(select id from public.profiles order by created_at asc limit 1);
  end if;
end $$;
