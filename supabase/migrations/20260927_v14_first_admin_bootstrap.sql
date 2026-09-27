-- yaaTeslimat v1.4 - bootstrap the first administrator on a fresh project.
-- Safe guard: only promotes when exactly one profile exists and no admin exists.

do $$
declare
  profile_count integer;
  admin_count integer;
begin
  select count(*) into profile_count from public.profiles;
  select count(*) into admin_count from public.profiles where role='admin';

  if profile_count = 1 and admin_count = 0 then
    update public.profiles
    set role='admin', active=true
    where id = (select id from public.profiles order by created_at asc limit 1);
  end if;
end $$;
