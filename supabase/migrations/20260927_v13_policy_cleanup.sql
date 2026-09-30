-- yaaTeslimat v1.3 - remove overlapping permissive SELECT policies

drop policy if exists "profiles_manage" on public.profiles;

create policy "profiles_admin_insert"
on public.profiles
for insert
to authenticated
with check ((select private.current_role()) = 'admin');

create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using ((select private.current_role()) = 'admin')
with check ((select private.current_role()) = 'admin');

create policy "profiles_admin_delete"
on public.profiles
for delete
to authenticated
using ((select private.current_role()) = 'admin');

drop policy if exists "staff_manage_v3" on public.staff;

create policy "staff_manage_insert_v13"
on public.staff
for insert
to authenticated
with check ((select private.current_role()) in ('admin','office'));

create policy "staff_manage_update_v13"
on public.staff
for update
to authenticated
using ((select private.current_role()) in ('admin','office'))
with check ((select private.current_role()) in ('admin','office'));

create policy "staff_manage_delete_v13"
on public.staff
for delete
to authenticated
using ((select private.current_role()) in ('admin','office'));
