-- yaaTeslimat v1.8 - durable courier notification inbox
-- Every new/reassigned delivery creates a notification row for the linked courier.
-- Realtime delivers it immediately while the app is open; Web Push handles background delivery.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  kind text not null default 'assignment' check (kind in ('assignment','reassignment','system')),
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_own_read_v18" on public.notifications;
create policy "notifications_own_read_v18"
on public.notifications
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "notifications_own_update_v18" on public.notifications;
create policy "notifications_own_update_v18"
on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.create_assignment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
  product_name text;
  notification_kind text;
begin
  if new.assignee_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  select s.user_id
    into target_user
  from public.staff s
  where s.id = new.assignee_id
    and s.active = true;

  if target_user is null then
    return new;
  end if;

  product_name := coalesce(new.items -> 0 ->> 'product', 'Ürün');
  notification_kind := case when tg_op='INSERT' then 'assignment' else 'reassignment' end;

  insert into public.notifications(user_id, delivery_id, kind, title, body)
  values (
    target_user,
    new.id,
    notification_kind,
    case when tg_op='INSERT' then 'Yeni teslimat görevi' else 'Teslimat sana atandı' end,
    concat_ws(' • ',
      nullif(new.customer_name,''),
      nullif(product_name,''),
      nullif(new.district,''),
      nullif(new.time_window,'')
    )
  );

  return new;
end
$$;

revoke all on function private.create_assignment_notification() from public, anon, authenticated;

drop trigger if exists deliveries_assignment_notification on public.deliveries;
create trigger deliveries_assignment_notification
after insert or update of assignee_id on public.deliveries
for each row execute function private.create_assignment_notification();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
