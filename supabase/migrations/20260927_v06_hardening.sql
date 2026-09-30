-- yaaTeslimat v0.6 hardening
-- Mevcut kurulumları güvenli varsayılanlara taşır.

alter table public.deliveries
  alter column created_by set default auth.uid();

alter table public.delivery_events
  alter column actor_id set default auth.uid();

create index if not exists deliveries_priority_idx on public.deliveries(priority);
create index if not exists deliveries_updated_at_idx on public.deliveries(updated_at desc);
create index if not exists delivery_events_created_at_idx on public.delivery_events(created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'delivery_events_event_type_check'
      and conrelid = 'public.delivery_events'::regclass
  ) then
    alter table public.delivery_events
      add constraint delivery_events_event_type_check
      check (event_type in ('created','status','checklist','issue','system'));
  end if;
end $$;

-- Eski geniş politikalar kalmışsa mutlaka kaldır.
drop policy if exists "authenticated_read_staff" on public.staff;
drop policy if exists "authenticated_manage_staff" on public.staff;
drop policy if exists "authenticated_read_deliveries" on public.deliveries;
drop policy if exists "authenticated_manage_deliveries" on public.deliveries;
drop policy if exists "authenticated_read_events" on public.delivery_events;
drop policy if exists "authenticated_insert_events" on public.delivery_events;

-- Realtime publication idempotent kalsın.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='deliveries'
  ) then
    alter publication supabase_realtime add table public.deliveries;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='staff'
  ) then
    alter publication supabase_realtime add table public.staff;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='delivery_events'
  ) then
    alter publication supabase_realtime add table public.delivery_events;
  end if;
end $$;
