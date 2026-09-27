-- yaaTeslimat v1.2 - security/performance hardening + auth profile bootstrap
-- Moves helper functions out of the exposed public API schema, tightens grants,
-- optimizes RLS auth lookups and adds missing FK indexes.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and active = true
$$;

revoke all on function private.current_role() from public, anon;
grant execute on function private.current_role() to authenticated, service_role;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

drop trigger if exists deliveries_touch_updated_at on public.deliveries;
create trigger deliveries_touch_updated_at
before update on public.deliveries
for each row execute function private.touch_updated_at();

create or replace function private.guard_courier_delivery_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_name text;
begin
  role_name := private.current_role();

  if role_name = 'courier' then
    if new.order_no is distinct from old.order_no
      or new.customer_name is distinct from old.customer_name
      or new.phone is distinct from old.phone
      or new.secondary_phone is distinct from old.secondary_phone
      or new.address is distinct from old.address
      or new.district is distinct from old.district
      or new.city is distinct from old.city
      or new.delivery_date is distinct from old.delivery_date
      or new.time_window is distinct from old.time_window
      or new.assignee_id is distinct from old.assignee_id
      or new.assignee_name is distinct from old.assignee_name
      or new.priority is distinct from old.priority
      or new.notes is distinct from old.notes
      or new.items is distinct from old.items
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Courier may only update delivery status and checklist';
    end if;

    if new.status is distinct from old.status then
      if not (
        (old.status = 'assigned' and new.status in ('seen','issue'))
        or (old.status = 'seen' and new.status in ('on_route','issue'))
        or (old.status = 'on_route' and new.status in ('completed','issue'))
        or old.status = new.status
      ) then
        raise exception 'Invalid courier status transition: % -> %', old.status, new.status;
      end if;
    end if;
  end if;

  return new;
end
$$;

revoke all on function private.guard_courier_delivery_update() from public, anon, authenticated;

drop trigger if exists deliveries_guard_courier_update on public.deliveries;
create trigger deliveries_guard_courier_update
before update on public.deliveries
for each row execute function private.guard_courier_delivery_update();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, phone, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'courier',
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    true
  )
  on conflict (id) do nothing;
  return new;
end
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Profiles
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.current_role()) in ('admin','office')
);

drop policy if exists "profiles_manage" on public.profiles;
create policy "profiles_manage"
on public.profiles for all to authenticated
using ((select private.current_role()) = 'admin')
with check ((select private.current_role()) = 'admin');

-- Staff
drop policy if exists "staff_read_v3" on public.staff;
create policy "staff_read_v3"
on public.staff for select to authenticated
using (
  (select private.current_role()) in ('admin','office','viewer')
  or user_id = (select auth.uid())
);

drop policy if exists "staff_manage_v3" on public.staff;
create policy "staff_manage_v3"
on public.staff for all to authenticated
using ((select private.current_role()) in ('admin','office'))
with check ((select private.current_role()) in ('admin','office'));

-- Deliveries
drop policy if exists "deliveries_read_v3" on public.deliveries;
create policy "deliveries_read_v3"
on public.deliveries for select to authenticated
using (
  (select private.current_role()) in ('admin','office','viewer')
  or assignee_id in (
    select id from public.staff where user_id = (select auth.uid())
  )
);

drop policy if exists "deliveries_insert_v3" on public.deliveries;
create policy "deliveries_insert_v3"
on public.deliveries for insert to authenticated
with check ((select private.current_role()) in ('admin','office'));

drop policy if exists "deliveries_update_v3" on public.deliveries;
create policy "deliveries_update_v3"
on public.deliveries for update to authenticated
using (
  (select private.current_role()) in ('admin','office')
  or assignee_id in (
    select id from public.staff where user_id = (select auth.uid())
  )
)
with check (
  (select private.current_role()) in ('admin','office')
  or assignee_id in (
    select id from public.staff where user_id = (select auth.uid())
  )
);

drop policy if exists "deliveries_delete_v3" on public.deliveries;
create policy "deliveries_delete_v3"
on public.deliveries for delete to authenticated
using ((select private.current_role()) in ('admin','office'));

-- Delivery events
drop policy if exists "events_read_v3" on public.delivery_events;
create policy "events_read_v3"
on public.delivery_events for select to authenticated
using (
  (select private.current_role()) in ('admin','office','viewer')
  or delivery_id in (
    select d.id
    from public.deliveries d
    join public.staff s on s.id = d.assignee_id
    where s.user_id = (select auth.uid())
  )
);

drop policy if exists "events_insert_v3" on public.delivery_events;
create policy "events_insert_v3"
on public.delivery_events for insert to authenticated
with check (
  (select private.current_role()) in ('admin','office')
  or (
    (select private.current_role()) = 'courier'
    and delivery_id in (
      select d.id
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = (select auth.uid())
    )
  )
);

-- Push subscriptions
drop policy if exists "push_own_read" on public.push_subscriptions;
create policy "push_own_read"
on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "push_own_insert" on public.push_subscriptions;
create policy "push_own_insert"
on public.push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "push_own_update" on public.push_subscriptions;
create policy "push_own_update"
on public.push_subscriptions for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "push_own_delete" on public.push_subscriptions;
create policy "push_own_delete"
on public.push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

-- Delivery proof metadata
drop policy if exists "delivery_proofs_read_v11" on public.delivery_proofs;
create policy "delivery_proofs_read_v11"
on public.delivery_proofs for select to authenticated
using (
  (select private.current_role()) in ('admin','office','viewer')
  or delivery_id in (
    select d.id
    from public.deliveries d
    join public.staff s on s.id = d.assignee_id
    where s.user_id = (select auth.uid())
  )
);

drop policy if exists "delivery_proofs_insert_v11" on public.delivery_proofs;
create policy "delivery_proofs_insert_v11"
on public.delivery_proofs for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select private.current_role()) in ('admin','office')
    or delivery_id in (
      select d.id
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "delivery_proofs_delete_v11" on public.delivery_proofs;
create policy "delivery_proofs_delete_v11"
on public.delivery_proofs for delete to authenticated
using (
  (select private.current_role()) in ('admin','office')
  or (
    created_by = (select auth.uid())
    and delivery_id in (
      select d.id
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = (select auth.uid())
    )
  )
);

-- Private storage object policies
drop policy if exists "delivery_proofs_storage_read_v11" on storage.objects;
create policy "delivery_proofs_storage_read_v11"
on storage.objects for select to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (
    (select private.current_role()) in ('admin','office','viewer')
    or (storage.foldername(name))[1] in (
      select d.id::text
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "delivery_proofs_storage_insert_v11" on storage.objects;
create policy "delivery_proofs_storage_insert_v11"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (
    (select private.current_role()) in ('admin','office')
    or (storage.foldername(name))[1] in (
      select d.id::text
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "delivery_proofs_storage_delete_v11" on storage.objects;
create policy "delivery_proofs_storage_delete_v11"
on storage.objects for delete to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (
    (select private.current_role()) in ('admin','office')
    or (
      (storage.foldername(name))[2] = (select auth.uid())::text
      and (storage.foldername(name))[1] in (
        select d.id::text
        from public.deliveries d
        join public.staff s on s.id = d.assignee_id
        where s.user_id = (select auth.uid())
      )
    )
  )
);

create index if not exists deliveries_created_by_idx
  on public.deliveries(created_by);

create index if not exists delivery_events_actor_id_idx
  on public.delivery_events(actor_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

-- Remove obsolete public helper functions from the exposed API schema.
drop function if exists public.guard_courier_delivery_update();
drop function if exists public.touch_updated_at();
drop function if exists public.current_role();

-- Supabase-created event trigger helper should not be directly callable through API roles.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
