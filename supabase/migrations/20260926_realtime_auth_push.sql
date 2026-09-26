-- yaaTeslimat v0.3: Auth + roller + canlı senkron + Web Push

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'courier' check (role in ('admin','office','courier','viewer')),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff add column if not exists user_id uuid unique references public.profiles(id) on delete set null;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

grant execute on function public.current_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.push_subscriptions enable row level security;

-- v0.2'deki geniş politikaları kaldır; aksi halde daha dar v0.3 kuralları etkisiz kalır.
drop policy if exists "authenticated_read_staff" on public.staff;
drop policy if exists "authenticated_manage_staff" on public.staff;
drop policy if exists "authenticated_read_deliveries" on public.deliveries;
drop policy if exists "authenticated_manage_deliveries" on public.deliveries;
drop policy if exists "authenticated_read_events" on public.delivery_events;
drop policy if exists "authenticated_insert_events" on public.delivery_events;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_role() in ('admin','office'));

drop policy if exists "profiles_manage" on public.profiles;
create policy "profiles_manage" on public.profiles for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "staff_read_v3" on public.staff;
create policy "staff_read_v3" on public.staff for select to authenticated
using (public.current_role() in ('admin','office','viewer') or user_id = auth.uid());

drop policy if exists "staff_manage_v3" on public.staff;
create policy "staff_manage_v3" on public.staff for all to authenticated
using (public.current_role() in ('admin','office'))
with check (public.current_role() in ('admin','office'));

drop policy if exists "deliveries_read_v3" on public.deliveries;
create policy "deliveries_read_v3" on public.deliveries for select to authenticated
using (
  public.current_role() in ('admin','office','viewer')
  or assignee_id in (select id from public.staff where user_id = auth.uid())
);

drop policy if exists "deliveries_insert_v3" on public.deliveries;
create policy "deliveries_insert_v3" on public.deliveries for insert to authenticated
with check (public.current_role() in ('admin','office'));

drop policy if exists "deliveries_update_v3" on public.deliveries;
create policy "deliveries_update_v3" on public.deliveries for update to authenticated
using (
  public.current_role() in ('admin','office')
  or assignee_id in (select id from public.staff where user_id = auth.uid())
)
with check (
  public.current_role() in ('admin','office')
  or assignee_id in (select id from public.staff where user_id = auth.uid())
);

drop policy if exists "deliveries_delete_v3" on public.deliveries;
create policy "deliveries_delete_v3" on public.deliveries for delete to authenticated
using (public.current_role() in ('admin','office'));

drop policy if exists "events_read_v3" on public.delivery_events;
create policy "events_read_v3" on public.delivery_events for select to authenticated
using (
  public.current_role() in ('admin','office','viewer')
  or delivery_id in (
    select d.id from public.deliveries d join public.staff s on s.id=d.assignee_id where s.user_id=auth.uid()
  )
);

drop policy if exists "events_insert_v3" on public.delivery_events;
create policy "events_insert_v3" on public.delivery_events for insert to authenticated
with check (true);

create policy "push_own_read" on public.push_subscriptions for select to authenticated using (user_id=auth.uid());
create policy "push_own_insert" on public.push_subscriptions for insert to authenticated with check (user_id=auth.uid());
create policy "push_own_update" on public.push_subscriptions for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "push_own_delete" on public.push_subscriptions for delete to authenticated using (user_id=auth.uid());

-- Realtime publication güvenli biçimde ekle.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='deliveries') then
    alter publication supabase_realtime add table public.deliveries;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='staff') then
    alter publication supabase_realtime add table public.staff;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='delivery_events') then
    alter publication supabase_realtime add table public.delivery_events;
  end if;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists deliveries_touch_updated_at on public.deliveries;
create trigger deliveries_touch_updated_at before update on public.deliveries
for each row execute function public.touch_updated_at();

-- İlk admin hesabını Supabase Auth üzerinden oluşturduktan sonra:
-- insert into public.profiles(id, full_name, role)
-- select id, 'Dükkan Yönetimi', 'admin' from auth.users where email='MAIL_ADRESINIZ';
