-- yaaTeslimat v0.6 - güvenli temel şema
-- Gerçek müşteri verisi içermez.
-- RLS açık gelir; erişim politikaları migration dosyasında rol bazlı olarak tanımlanır.

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
  status text not null default 'new'
    check (status in ('new','assigned','seen','on_route','completed','issue')),
  priority text not null default 'normal'
    check (priority in ('normal','high','critical')),
  notes text,
  items jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '{"addressVerified":false,"customerCalled":false,"productLoaded":false,"modelChecked":false,"accessoriesChecked":false,"returnChecked":false}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references public.deliveries(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  actor_name text,
  event_type text not null
    check (event_type in ('created','status','checklist','issue','system')),
  title text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  proof_type text not null check (proof_type in ('photo','signature')),
  storage_path text not null unique,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 10485760)),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists deliveries_delivery_date_idx on public.deliveries(delivery_date);
create index if not exists deliveries_assignee_id_idx on public.deliveries(assignee_id);
create index if not exists deliveries_status_idx on public.deliveries(status);
create index if not exists deliveries_priority_idx on public.deliveries(priority);
create index if not exists deliveries_updated_at_idx on public.deliveries(updated_at desc);
create index if not exists delivery_events_delivery_id_idx on public.delivery_events(delivery_id);
create index if not exists delivery_events_created_at_idx on public.delivery_events(created_at desc);
create index if not exists delivery_proofs_delivery_id_idx on public.delivery_proofs(delivery_id, created_at desc);

alter table public.staff enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;
alter table public.delivery_proofs enable row level security;

-- Güvenli varsayılan: burada geniş "authenticated can do everything" politikası yoktur.
-- Rol politikaları migration dosyalarında oluşturulur. Delivery proof Storage politikaları için 20260927_v11_delivery_proofs.sql uygulanmalıdır.

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
    where pubname='supabase_realtime' and schemaname='public' and tablename='delivery_events'
  ) then
    alter publication supabase_realtime add table public.delivery_events;
  end if;
end $$;
