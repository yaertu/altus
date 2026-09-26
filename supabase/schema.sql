-- yaaTeslimat v0.2 - Supabase temel şeması
-- Bu dosya gerçek müşteri verisi içermez.

create extension if not exists pgcrypto;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_name text not null,
  phone text not null,
  secondary_phone text,
  address text not null,
  district text,
  city text,
  delivery_date date not null,
  time_window text,
  assignee_id uuid references public.staff(id) on delete set null,
  assignee_name text,
  status text not null default 'new' check (status in ('new','assigned','seen','on_route','completed','issue')),
  priority text not null default 'normal' check (priority in ('normal','high','critical')),
  notes text,
  items jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '{"addressVerified":false,"customerCalled":false,"productLoaded":false,"modelChecked":false,"accessoriesChecked":false,"returnChecked":false}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references public.deliveries(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  event_type text not null,
  title text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists deliveries_delivery_date_idx on public.deliveries(delivery_date);
create index if not exists deliveries_assignee_id_idx on public.deliveries(assignee_id);
create index if not exists deliveries_status_idx on public.deliveries(status);
create index if not exists delivery_events_delivery_id_idx on public.delivery_events(delivery_id);

alter table public.staff enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;

-- İlk kurulum politikaları: yalnız oturum açmış kullanıcılar.
-- Canlıya geçerken dükkan/sevkiyatçı rollerine göre daha daraltılmalıdır.
create policy "authenticated_read_staff"
on public.staff for select
to authenticated
using (true);

create policy "authenticated_manage_staff"
on public.staff for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_deliveries"
on public.deliveries for select
to authenticated
using (true);

create policy "authenticated_manage_deliveries"
on public.deliveries for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_events"
on public.delivery_events for select
to authenticated
using (true);

create policy "authenticated_insert_events"
on public.delivery_events for insert
to authenticated
with check (true);

alter publication supabase_realtime add table public.deliveries;
alter publication supabase_realtime add table public.delivery_events;
