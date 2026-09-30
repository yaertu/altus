
-- Altus Sevkiyat modern production core
-- Fresh-project bootstrap for the current Next.js application.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- The project ships with a platform helper event-trigger function in public.
-- It is not an application RPC and must not be callable over the Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_color text not null default '#cf006f'
    check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  support_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  phone text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, code)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  full_name text not null default '',
  phone text,
  role text check (role in ('admin','store_manager','store_staff','courier')),
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_org_role_idx
  on public.profiles(org_id, role, is_active);
create index if not exists profiles_store_idx
  on public.profiles(store_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  category text not null default 'Genel',
  model text not null,
  title text not null,
  specs jsonb not null default '{}'::jsonb,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_category_model_idx
  on public.products(is_active, category, model);

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, product_id),
  unique(storage_path)
);

create index if not exists product_media_org_idx
  on public.product_media(org_id, product_id);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  tracking_no text not null unique
    default ('ALT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  tracking_token uuid not null unique default gen_random_uuid(),
  tracking_expires_at timestamptz not null default (now() + interval '90 days'),

  org_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  assigned_courier_id uuid references public.profiles(user_id) on delete set null,

  customer_name text not null check (char_length(trim(customer_name)) between 2 and 160),
  customer_phone text not null check (char_length(trim(customer_phone)) between 7 and 30),
  customer_address text not null check (char_length(trim(customer_address)) between 5 and 1000),
  district text,
  city text,
  latitude double precision,
  longitude double precision,
  location_source text,
  location_precision text,
  location_confirmed_at timestamptz,

  order_no text,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_model text,
  product_image_url text,
  quantity integer not null default 1 check (quantity between 1 and 100),

  floor_text text,
  has_elevator boolean,
  install_required boolean not null default false,
  old_product_pickup boolean not null default false,
  fragile boolean not null default false,
  requires_photo boolean not null default true,
  requires_signature boolean not null default true,

  scheduled_date date not null,
  time_window text not null,
  priority text not null default 'normal'
    check (priority in ('normal','priority','urgent')),
  status text not null default 'new'
    check (status in ('new','accepted','en_route','arrived','delivered','failed','cancelled')),
  notes text,
  failure_reason text,
  route_position integer check (route_position is null or route_position > 0),
  planned_service_minutes integer not null default 20
    check (planned_service_minutes between 1 and 480),

  last_event_lat double precision,
  last_event_lng double precision,
  last_event_accuracy_m double precision check (last_event_accuracy_m is null or last_event_accuracy_m >= 0),

  accepted_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  check (last_event_lat is null or last_event_lat between -90 and 90),
  check (last_event_lng is null or last_event_lng between -180 and 180)
);

create index if not exists deliveries_org_created_idx
  on public.deliveries(org_id, created_at desc);
create index if not exists deliveries_org_status_idx
  on public.deliveries(org_id, status, scheduled_date);
create index if not exists deliveries_store_idx
  on public.deliveries(store_id, scheduled_date);
create index if not exists deliveries_courier_idx
  on public.deliveries(assigned_courier_id, status, created_at desc);
create index if not exists deliveries_tracking_token_idx
  on public.deliveries(tracking_token);

create table if not exists public.delivery_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  event_type text not null
    check (event_type in ('created','assigned','status','issue','proof','system')),
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delivery_events_delivery_idx
  on public.delivery_events(delivery_id, created_at desc);
create index if not exists delivery_events_org_idx
  on public.delivery_events(org_id, created_at desc);

create table if not exists public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  proof_type text not null check (proof_type in ('photo','signature')),
  storage_path text not null unique,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 10485760)),
  created_at timestamptz not null default now()
);

create index if not exists delivery_proofs_delivery_idx
  on public.delivery_proofs(delivery_id, created_at desc);
create index if not exists delivery_proofs_org_idx
  on public.delivery_proofs(org_id, delivery_id);

create table if not exists public.courier_presence (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  availability text not null default 'offline'
    check (availability in ('offline','available','busy','break')),
  shift_started_at timestamptz,
  break_started_at timestamptz,
  last_heartbeat_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  heading_deg double precision,
  speed_mps double precision,
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  check (accuracy_m is null or accuracy_m >= 0),
  check (heading_deg is null or heading_deg between 0 and 360),
  check (speed_mps is null or speed_mps >= 0)
);

create index if not exists courier_presence_org_idx
  on public.courier_presence(org_id, availability, last_heartbeat_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id, updated_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  kind text not null default 'system',
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at)
  where read_at is null;

-- Internal helpers
create or replace function private.current_org_id()
returns uuid
language sql stable security definer set search_path=''
as $$
  select org_id from public.profiles where user_id = auth.uid() and is_active = true limit 1
$$;

create or replace function private.current_role()
returns text
language sql stable security definer set search_path=''
as $$
  select role from public.profiles where user_id = auth.uid() and is_active = true limit 1
$$;

create or replace function private.current_store_id()
returns uuid
language sql stable security definer set search_path=''
as $$
  select store_id from public.profiles where user_id = auth.uid() and is_active = true limit 1
$$;

revoke all on function private.current_org_id() from public, anon;
revoke all on function private.current_role() from public, anon;
revoke all on function private.current_store_id() from public, anon;
grant execute on function private.current_org_id() to authenticated, service_role;
grant execute on function private.current_role() to authenticated, service_role;
grant execute on function private.current_store_id() to authenticated, service_role;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create or replace function private.guard_delivery_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  r text;
begin
  r := private.current_role();

  if r = 'courier' then
    if old.assigned_courier_id is distinct from auth.uid() then
      raise exception 'Courier is not assigned to this delivery';
    end if;

    if new.tracking_no is distinct from old.tracking_no
      or new.tracking_token is distinct from old.tracking_token
      or new.tracking_expires_at is distinct from old.tracking_expires_at
      or new.org_id is distinct from old.org_id
      or new.store_id is distinct from old.store_id
      or new.created_by is distinct from old.created_by
      or new.assigned_courier_id is distinct from old.assigned_courier_id
      or new.customer_name is distinct from old.customer_name
      or new.customer_phone is distinct from old.customer_phone
      or new.customer_address is distinct from old.customer_address
      or new.district is distinct from old.district
      or new.city is distinct from old.city
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
      or new.location_source is distinct from old.location_source
      or new.location_precision is distinct from old.location_precision
      or new.location_confirmed_at is distinct from old.location_confirmed_at
      or new.order_no is distinct from old.order_no
      or new.product_id is distinct from old.product_id
      or new.product_name is distinct from old.product_name
      or new.product_model is distinct from old.product_model
      or new.product_image_url is distinct from old.product_image_url
      or new.quantity is distinct from old.quantity
      or new.floor_text is distinct from old.floor_text
      or new.has_elevator is distinct from old.has_elevator
      or new.install_required is distinct from old.install_required
      or new.old_product_pickup is distinct from old.old_product_pickup
      or new.fragile is distinct from old.fragile
      or new.requires_photo is distinct from old.requires_photo
      or new.requires_signature is distinct from old.requires_signature
      or new.scheduled_date is distinct from old.scheduled_date
      or new.time_window is distinct from old.time_window
      or new.priority is distinct from old.priority
      or new.notes is distinct from old.notes
      or new.route_position is distinct from old.route_position
      or new.planned_service_minutes is distinct from old.planned_service_minutes
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Courier may only update delivery status, failure reason and field location';
    end if;

    if new.status is distinct from old.status then
      if not (
        (old.status = 'new' and new.status in ('accepted','failed'))
        or (old.status = 'accepted' and new.status in ('en_route','failed'))
        or (old.status = 'en_route' and new.status in ('arrived','failed'))
        or (old.status = 'arrived' and new.status in ('delivered','failed'))
      ) then
        raise exception 'Invalid courier status transition: % -> %', old.status, new.status;
      end if;
    end if;
  end if;

  return new;
end
$$;
revoke all on function private.guard_delivery_update() from public, anon, authenticated;

create or replace function private.delivery_status_timestamps()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'accepted' and new.accepted_at is null then new.accepted_at = now(); end if;
    if new.status = 'en_route' and new.en_route_at is null then new.en_route_at = now(); end if;
    if new.status = 'arrived' and new.arrived_at is null then new.arrived_at = now(); end if;
    if new.status = 'delivered' and new.delivered_at is null then new.delivered_at = now(); end if;
    if new.status = 'failed' and new.failed_at is null then new.failed_at = now(); end if;
    if new.status <> 'failed' and old.status = 'failed' then
      new.failed_at = null;
      if new.status = 'new' then new.failure_reason = null; end if;
    end if;
  end if;
  return new;
end
$$;
revoke all on function private.delivery_status_timestamps() from public, anon, authenticated;

create or replace function private.log_delivery_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.delivery_events(org_id, delivery_id, actor_id, event_type, to_status, note)
    values(new.org_id, new.id, auth.uid(), 'created', new.status, 'Sevkiyat oluşturuldu');

    if new.assigned_courier_id is not null then
      insert into public.delivery_events(org_id, delivery_id, actor_id, event_type, to_status, note)
      values(new.org_id, new.id, auth.uid(), 'assigned', new.status, 'Sevkiyat personeline atandı');

      insert into public.notifications(org_id, user_id, delivery_id, kind, title, body)
      values(new.org_id, new.assigned_courier_id, new.id, 'assignment', 'Yeni sevkiyat görevi', 'Yeni bir teslimat görevi atandı.');
    end if;
    return new;
  end if;

  if new.assigned_courier_id is distinct from old.assigned_courier_id then
    insert into public.delivery_events(org_id, delivery_id, actor_id, event_type, from_status, to_status, note)
    values(new.org_id, new.id, auth.uid(), 'assigned', old.status, new.status, 'Sevkiyat personeli değiştirildi');

    if new.assigned_courier_id is not null then
      insert into public.notifications(org_id, user_id, delivery_id, kind, title, body)
      values(new.org_id, new.assigned_courier_id, new.id, 'assignment', 'Yeni sevkiyat görevi', 'Yeni bir teslimat görevi atandı.');
    end if;
  end if;

  if new.status is distinct from old.status then
    insert into public.delivery_events(org_id, delivery_id, actor_id, event_type, from_status, to_status, note, metadata)
    values(
      new.org_id, new.id, auth.uid(),
      case when new.status = 'failed' then 'issue' else 'status' end,
      old.status, new.status,
      case when new.status = 'failed' then coalesce(new.failure_reason, 'Teslimat sorunu bildirildi') else 'Teslimat durumu güncellendi' end,
      jsonb_build_object(
        'lat', new.last_event_lat,
        'lng', new.last_event_lng,
        'accuracy_m', new.last_event_accuracy_m
      )
    );
  end if;

  return new;
end
$$;
revoke all on function private.log_delivery_change() from public, anon, authenticated;

-- Broadcast the exact private topics used by the web/mobile clients.
create or replace function private.broadcast_delivery_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  row_org uuid := coalesce(new.org_id, old.org_id);
  old_courier uuid := old.assigned_courier_id;
  new_courier uuid := new.assigned_courier_id;
begin
  perform realtime.broadcast_changes(
    'org:' || row_org::text || ':deliveries',
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );

  if new_courier is not null then
    perform realtime.broadcast_changes(
      'courier:' || new_courier::text || ':deliveries',
      tg_op, tg_op, tg_table_name, tg_table_schema, new, old
    );
  end if;

  if old_courier is not null and old_courier is distinct from new_courier then
    perform realtime.broadcast_changes(
      'courier:' || old_courier::text || ':deliveries',
      tg_op, tg_op, tg_table_name, tg_table_schema, new, old
    );
  end if;

  return null;
end
$$;
revoke all on function private.broadcast_delivery_change() from public, anon, authenticated;

create or replace function private.broadcast_presence_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  row_org uuid := coalesce(new.org_id, old.org_id);
begin
  perform realtime.broadcast_changes(
    'org:' || row_org::text || ':presence',
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );
  return null;
end
$$;
revoke all on function private.broadcast_presence_change() from public, anon, authenticated;

drop trigger if exists organizations_touch_updated_at on public.organizations;
create trigger organizations_touch_updated_at
before update on public.organizations
for each row execute function private.touch_updated_at();

drop trigger if exists stores_touch_updated_at on public.stores;
create trigger stores_touch_updated_at
before update on public.stores
for each row execute function private.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row execute function private.touch_updated_at();

drop trigger if exists product_media_touch_updated_at on public.product_media;
create trigger product_media_touch_updated_at
before update on public.product_media
for each row execute function private.touch_updated_at();

drop trigger if exists deliveries_guard_update on public.deliveries;
create trigger deliveries_guard_update
before update on public.deliveries
for each row execute function private.guard_delivery_update();

drop trigger if exists deliveries_status_timestamps on public.deliveries;
create trigger deliveries_status_timestamps
before update on public.deliveries
for each row execute function private.delivery_status_timestamps();

drop trigger if exists deliveries_touch_updated_at on public.deliveries;
create trigger deliveries_touch_updated_at
before update on public.deliveries
for each row execute function private.touch_updated_at();

drop trigger if exists deliveries_event_log on public.deliveries;
create trigger deliveries_event_log
after insert or update of assigned_courier_id, status on public.deliveries
for each row execute function private.log_delivery_change();

drop trigger if exists deliveries_broadcast on public.deliveries;
create trigger deliveries_broadcast
after insert or update or delete on public.deliveries
for each row execute function private.broadcast_delivery_change();

drop trigger if exists courier_presence_touch_updated_at on public.courier_presence;
create trigger courier_presence_touch_updated_at
before update on public.courier_presence
for each row execute function private.touch_updated_at();

drop trigger if exists courier_presence_broadcast on public.courier_presence;
create trigger courier_presence_broadcast
after insert or update or delete on public.courier_presence
for each row execute function private.broadcast_presence_change();

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function private.touch_updated_at();

-- First-user bootstrap:
-- there is no public signup screen. The first Auth account created by the project owner
-- becomes the initial admin and receives a default organization + store.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  org_id_value uuid;
  store_id_value uuid;
  requested_org text;
  requested_store text;
  requested_role text;
  requested_name text;
  requested_phone text;
begin
  requested_org := nullif(new.raw_user_meta_data->>'org_id','');
  requested_store := nullif(new.raw_user_meta_data->>'store_id','');
  requested_role := nullif(new.raw_user_meta_data->>'role','');
  requested_name := coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,''),'@',1), '');
  requested_phone := nullif(new.raw_user_meta_data->>'phone','');

  if not exists (select 1 from public.profiles limit 1) then
    insert into public.organizations(name, brand_color)
    values('Altus Sevkiyat', '#cf006f')
    returning id into org_id_value;

    insert into public.stores(org_id, name, code, is_active)
    values(org_id_value, 'Merkez Mağaza', 'MERKEZ', true)
    returning id into store_id_value;

    insert into public.profiles(user_id, org_id, store_id, full_name, phone, role, is_active)
    values(new.id, org_id_value, store_id_value, requested_name, requested_phone, 'admin', true)
    on conflict(user_id) do nothing;

    return new;
  end if;

  if requested_org is not null
     and requested_org ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     and requested_role in ('admin','store_manager','store_staff','courier')
  then
    org_id_value := requested_org::uuid;

    if requested_store is not null
       and requested_store ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      store_id_value := requested_store::uuid;
    end if;

    insert into public.profiles(user_id, org_id, store_id, full_name, phone, role, is_active)
    values(new.id, org_id_value, store_id_value, requested_name, requested_phone, requested_role, true)
    on conflict(user_id) do update set
      org_id=excluded.org_id,
      store_id=excluded.store_id,
      full_name=excluded.full_name,
      phone=excluded.phone,
      role=excluded.role,
      is_active=true;
  end if;

  return new;
end
$$;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists altus_handle_new_auth_user on auth.users;
create trigger altus_handle_new_auth_user
after insert on auth.users
for each row execute function private.handle_new_auth_user();

-- RLS
alter table public.organizations enable row level security;
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;
alter table public.delivery_proofs enable row level security;
alter table public.courier_presence enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations
for select to authenticated
using (id = private.current_org_id());

drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update on public.organizations
for update to authenticated
using (id = private.current_org_id() and private.current_role() = 'admin')
with check (id = private.current_org_id() and private.current_role() = 'admin');

drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores
for select to authenticated
using (org_id = private.current_org_id());

drop policy if exists stores_admin_insert on public.stores;
create policy stores_admin_insert on public.stores
for insert to authenticated
with check (org_id = private.current_org_id() and private.current_role() = 'admin');

drop policy if exists stores_admin_update on public.stores;
create policy stores_admin_update on public.stores
for update to authenticated
using (org_id = private.current_org_id() and private.current_role() = 'admin')
with check (org_id = private.current_org_id() and private.current_role() = 'admin');

drop policy if exists stores_admin_delete on public.stores;
create policy stores_admin_delete on public.stores
for delete to authenticated
using (org_id = private.current_org_id() and private.current_role() = 'admin');

drop policy if exists profiles_read_org on public.profiles;
create policy profiles_read_org on public.profiles
for select to authenticated
using (org_id = private.current_org_id());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
for update to authenticated
using (org_id = private.current_org_id() and private.current_role() = 'admin')
with check (org_id = private.current_org_id() and private.current_role() = 'admin');

drop policy if exists products_read on public.products;
create policy products_read on public.products
for select to authenticated
using (is_active = true or private.current_role() = 'admin');

drop policy if exists products_admin_manage on public.products;
create policy products_admin_manage on public.products
for all to authenticated
using (private.current_role() = 'admin')
with check (private.current_role() = 'admin');

drop policy if exists product_media_read on public.product_media;
create policy product_media_read on public.product_media
for select to authenticated
using (org_id = private.current_org_id());

drop policy if exists product_media_admin_manage on public.product_media;
create policy product_media_admin_manage on public.product_media
for all to authenticated
using (org_id = private.current_org_id() and private.current_role() = 'admin')
with check (org_id = private.current_org_id() and private.current_role() = 'admin');

drop policy if exists deliveries_read on public.deliveries;
create policy deliveries_read on public.deliveries
for select to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or assigned_courier_id = auth.uid()
  )
);

drop policy if exists deliveries_insert on public.deliveries;
create policy deliveries_insert on public.deliveries
for insert to authenticated
with check (
  org_id = private.current_org_id()
  and private.current_role() in ('admin','store_manager','store_staff')
  and (
    private.current_role() in ('admin','store_manager')
    or store_id = private.current_store_id()
  )
);

drop policy if exists deliveries_update on public.deliveries;
create policy deliveries_update on public.deliveries
for update to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or assigned_courier_id = auth.uid()
  )
)
with check (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or assigned_courier_id = auth.uid()
  )
);

drop policy if exists deliveries_delete on public.deliveries;
create policy deliveries_delete on public.deliveries
for delete to authenticated
using (
  org_id = private.current_org_id()
  and private.current_role() in ('admin','store_manager')
);

drop policy if exists delivery_events_read on public.delivery_events;
create policy delivery_events_read on public.delivery_events
for select to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and d.assigned_courier_id = auth.uid()
    )
  )
);

drop policy if exists delivery_events_insert on public.delivery_events;
create policy delivery_events_insert on public.delivery_events
for insert to authenticated
with check (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and d.assigned_courier_id = auth.uid()
    )
  )
);

drop policy if exists delivery_proofs_read on public.delivery_proofs;
create policy delivery_proofs_read on public.delivery_proofs
for select to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and d.assigned_courier_id = auth.uid()
    )
  )
);

drop policy if exists delivery_proofs_insert on public.delivery_proofs;
create policy delivery_proofs_insert on public.delivery_proofs
for insert to authenticated
with check (
  org_id = private.current_org_id()
  and uploaded_by = auth.uid()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and d.assigned_courier_id = auth.uid()
    )
  )
);

drop policy if exists delivery_proofs_delete on public.delivery_proofs;
create policy delivery_proofs_delete on public.delivery_proofs
for delete to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager')
    or uploaded_by = auth.uid()
  )
);

drop policy if exists courier_presence_read on public.courier_presence;
create policy courier_presence_read on public.courier_presence
for select to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or user_id = auth.uid()
  )
);

drop policy if exists courier_presence_own_insert on public.courier_presence;
create policy courier_presence_own_insert on public.courier_presence
for insert to authenticated
with check (
  user_id = auth.uid()
  and org_id = private.current_org_id()
  and private.current_role() = 'courier'
);

drop policy if exists courier_presence_own_update on public.courier_presence;
create policy courier_presence_own_update on public.courier_presence
for update to authenticated
using (user_id = auth.uid() and org_id = private.current_org_id())
with check (user_id = auth.uid() and org_id = private.current_org_id());

drop policy if exists push_subscriptions_own_read on public.push_subscriptions;
create policy push_subscriptions_own_read on public.push_subscriptions
for select to authenticated
using (user_id = auth.uid());

drop policy if exists push_subscriptions_own_insert on public.push_subscriptions;
create policy push_subscriptions_own_insert on public.push_subscriptions
for insert to authenticated
with check (user_id = auth.uid() and org_id = private.current_org_id());

drop policy if exists push_subscriptions_own_update on public.push_subscriptions;
create policy push_subscriptions_own_update on public.push_subscriptions
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and org_id = private.current_org_id());

drop policy if exists push_subscriptions_own_delete on public.push_subscriptions;
create policy push_subscriptions_own_delete on public.push_subscriptions
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications
for select to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Realtime private-topic authorization.
drop policy if exists altus_realtime_receive on realtime.messages;
create policy altus_realtime_receive on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    (select realtime.topic()) = ('courier:' || auth.uid()::text || ':deliveries')
    or (
      private.current_role() in ('admin','store_manager','store_staff')
      and (select realtime.topic()) in (
        'org:' || private.current_org_id()::text || ':deliveries',
        'org:' || private.current_org_id()::text || ':presence'
      )
    )
  )
);

-- Storage buckets
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('delivery-proofs','delivery-proofs',false,10485760,array['image/jpeg','image/png','image/webp','image/heic','image/heif']::text[]),
  ('product-media','product-media',true,6291456,array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists delivery_proofs_storage_read on storage.objects;
create policy delivery_proofs_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[1] = private.current_org_id()::text
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or (
      (storage.foldername(name))[3] = auth.uid()::text
      and exists (
        select 1 from public.deliveries d
        where d.id::text = (storage.foldername(name))[2]
          and d.assigned_courier_id = auth.uid()
          and d.org_id = private.current_org_id()
      )
    )
  )
);

drop policy if exists delivery_proofs_storage_insert on storage.objects;
create policy delivery_proofs_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[1] = private.current_org_id()::text
  and (storage.foldername(name))[3] = auth.uid()::text
  and exists (
    select 1 from public.deliveries d
    where d.id::text = (storage.foldername(name))[2]
      and d.org_id = private.current_org_id()
      and (
        private.current_role() in ('admin','store_manager','store_staff')
        or d.assigned_courier_id = auth.uid()
      )
  )
);

drop policy if exists delivery_proofs_storage_update on storage.objects;
create policy delivery_proofs_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[1] = private.current_org_id()::text
  and (storage.foldername(name))[3] = auth.uid()::text
)
with check (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[1] = private.current_org_id()::text
  and (storage.foldername(name))[3] = auth.uid()::text
);

drop policy if exists delivery_proofs_storage_delete on storage.objects;
create policy delivery_proofs_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[1] = private.current_org_id()::text
  and (
    private.current_role() in ('admin','store_manager')
    or (storage.foldername(name))[3] = auth.uid()::text
  )
);

drop policy if exists product_media_storage_read on storage.objects;
create policy product_media_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = private.current_org_id()::text
);

drop policy if exists product_media_storage_insert on storage.objects;
create policy product_media_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = private.current_org_id()::text
  and private.current_role() = 'admin'
);

drop policy if exists product_media_storage_update on storage.objects;
create policy product_media_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = private.current_org_id()::text
  and private.current_role() = 'admin'
)
with check (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = private.current_org_id()::text
  and private.current_role() = 'admin'
);

drop policy if exists product_media_storage_delete on storage.objects;
create policy product_media_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = private.current_org_id()::text
  and private.current_role() = 'admin'
);

-- Explicit Data API grants. RLS is the row-level authorization boundary.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.stores to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_media to authenticated;
grant select, insert, update, delete on public.deliveries to authenticated;
grant select, insert on public.delivery_events to authenticated;
grant select, insert, delete on public.delivery_proofs to authenticated;
grant select, insert, update on public.courier_presence to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, update on public.notifications to authenticated;

grant usage, select on sequence public.delivery_events_id_seq to authenticated;

notify pgrst, 'reload schema';
