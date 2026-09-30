-- Altus Sevkiyat v6.0 - courier growth, promotions, avatar and fair discipline
-- Safe to rerun. New public tables use RLS. Trigger helpers stay in private schema.

do $
begin
  if to_regclass('public.profiles') is null then
    raise exception 'v6 preflight: public.profiles bulunamadı';
  end if;
  if to_regclass('public.deliveries') is null then
    raise exception 'v6 preflight: public.deliveries bulunamadı';
  end if;
  if to_regclass('public.organizations') is null then
    raise exception 'v6 preflight: public.organizations bulunamadı';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='user_id') then
    raise exception 'v6 preflight: profiles.user_id bulunamadı';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='org_id') then
    raise exception 'v6 preflight: profiles.org_id bulunamadı';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role') then
    raise exception 'v6 preflight: profiles.role bulunamadı';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_active') then
    raise exception 'v6 preflight: profiles.is_active bulunamadı';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='deliveries' and column_name='assigned_courier_id') then
    raise exception 'v6 preflight: deliveries.assigned_courier_id bulunamadı; eski assignee_id şemasına migration uygulanamaz';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='deliveries' and column_name='status') then
    raise exception 'v6 preflight: deliveries.status bulunamadı';
  end if;
end $;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_role()
returns text language sql stable security definer set search_path=''
as $ select role::text from public.profiles where user_id=auth.uid() limit 1 $;
revoke all on function private.current_role() from public,anon;
grant execute on function private.current_role() to authenticated,service_role;

create table if not exists public.courier_profile_media(
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  avatar_url text,
  updated_at timestamptz not null default now()
);
alter table public.courier_profile_media enable row level security;

create table if not exists public.courier_scores(
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  points integer not null default 0 check(points>=0),
  delivered_count integer not null default 0 check(delivered_count>=0),
  failed_count integer not null default 0 check(failed_count>=0),
  courier_cancel_count integer not null default 0 check(courier_cancel_count>=0),
  streak_days integer not null default 0 check(streak_days>=0),
  last_delivery_date date,
  suspended_reason text,
  updated_at timestamptz not null default now()
);
create index if not exists courier_scores_org_idx on public.courier_scores(org_id,points desc);
alter table public.courier_scores add column if not exists last_delivery_date date;
alter table public.courier_scores enable row level security;

create table if not exists public.courier_score_events(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  courier_id uuid not null references public.profiles(user_id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  points_delta integer not null,
  event_key text not null,
  reason text,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(delivery_id,event_key)
);
create index if not exists courier_score_events_user_idx on public.courier_score_events(courier_id,created_at desc);
alter table public.courier_score_events enable row level security;

create table if not exists public.courier_promotions(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check(char_length(title) between 3 and 100),
  description text not null default '',
  target_type text not null check(target_type in ('deliveries','selected_products','points')),
  target_count integer not null check(target_count>0),
  reward_amount numeric(10,2),
  reward_label text,
  product_ids uuid[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  theme text not null default 'magenta',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);
create index if not exists courier_promotions_active_idx on public.courier_promotions(org_id,is_active,starts_at,ends_at);
alter table public.courier_promotions enable row level security;

create table if not exists public.gamification_settings(
  org_id uuid primary key references public.organizations(id) on delete cascade,
  daily_cancel_limit integer not null default 5 check(daily_cancel_limit between 1 and 50),
  auto_suspend boolean not null default true,
  accepted_points integer not null default 5,
  arrived_points integer not null default 10,
  delivered_points integer not null default 100,
  courier_cancel_points integer not null default -75,
  updated_at timestamptz not null default now()
);
alter table public.gamification_settings enable row level security;

create table if not exists public.courier_cancel_events(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  courier_id uuid not null references public.profiles(user_id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  reason text not null,
  confirmed_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists courier_cancel_events_day_idx on public.courier_cancel_events(courier_id,created_at desc);
create unique index if not exists courier_cancel_events_delivery_once_idx on public.courier_cancel_events(courier_id,delivery_id) where delivery_id is not null;
alter table public.courier_cancel_events enable row level security;

create table if not exists public.courier_penalties(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  courier_id uuid not null references public.profiles(user_id) on delete cascade,
  reason text not null,
  points_delta integer not null default 0,
  suspended boolean not null default false,
  status text not null default 'active' check(status in ('active','lifted')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  lifted_by uuid references auth.users(id) on delete set null,
  lift_note text,
  created_at timestamptz not null default now(),
  lifted_at timestamptz
);
create index if not exists courier_penalties_user_idx on public.courier_penalties(courier_id,created_at desc);
alter table public.courier_penalties enable row level security;

create or replace function private.current_org_id()
returns uuid language sql stable security definer set search_path=''
as $$ select org_id from public.profiles where user_id=auth.uid() limit 1 $$;
revoke all on function private.current_org_id() from public,anon;
grant execute on function private.current_org_id() to authenticated,service_role;

drop policy if exists "courier_profile_media_read" on public.courier_profile_media;
create policy "courier_profile_media_read" on public.courier_profile_media for select to authenticated
using(user_id=auth.uid() or private.current_role() in ('admin','store_manager','store_staff','office','viewer'));

drop policy if exists "courier_profile_media_own_insert" on public.courier_profile_media;
create policy "courier_profile_media_own_insert" on public.courier_profile_media for insert to authenticated
with check(user_id=auth.uid());

drop policy if exists "courier_profile_media_own_update" on public.courier_profile_media;
create policy "courier_profile_media_own_update" on public.courier_profile_media for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists "courier_scores_read" on public.courier_scores;
create policy "courier_scores_read" on public.courier_scores for select to authenticated
using(user_id=auth.uid() or (org_id=private.current_org_id() and private.current_role() in ('admin','store_manager','store_staff','office')));

drop policy if exists "courier_score_events_read" on public.courier_score_events;
create policy "courier_score_events_read" on public.courier_score_events for select to authenticated
using(courier_id=auth.uid() or (org_id=private.current_org_id() and private.current_role() in ('admin','store_manager')));

drop policy if exists "courier_score_events_admin_insert" on public.courier_score_events;
create policy "courier_score_events_admin_insert" on public.courier_score_events for insert to authenticated
with check(org_id=private.current_org_id() and private.current_role()='admin');

drop policy if exists "courier_promotions_read" on public.courier_promotions;
create policy "courier_promotions_read" on public.courier_promotions for select to authenticated
using(org_id=private.current_org_id());

drop policy if exists "courier_promotions_admin" on public.courier_promotions;
create policy "courier_promotions_admin" on public.courier_promotions for all to authenticated
using(org_id=private.current_org_id() and private.current_role()='admin')
with check(org_id=private.current_org_id() and private.current_role()='admin');

drop policy if exists "gamification_settings_read" on public.gamification_settings;
create policy "gamification_settings_read" on public.gamification_settings for select to authenticated
using(org_id=private.current_org_id());

drop policy if exists "gamification_settings_admin" on public.gamification_settings;
create policy "gamification_settings_admin" on public.gamification_settings for all to authenticated
using(org_id=private.current_org_id() and private.current_role()='admin')
with check(org_id=private.current_org_id() and private.current_role()='admin');

drop policy if exists "courier_cancel_events_read" on public.courier_cancel_events;
create policy "courier_cancel_events_read" on public.courier_cancel_events for select to authenticated
using(courier_id=auth.uid() or (org_id=private.current_org_id() and private.current_role() in ('admin','store_manager')));

drop policy if exists "courier_cancel_events_admin_insert" on public.courier_cancel_events;
create policy "courier_cancel_events_admin_insert" on public.courier_cancel_events for insert to authenticated
with check(org_id=private.current_org_id() and private.current_role()='admin');

drop policy if exists "courier_penalties_read" on public.courier_penalties;
create policy "courier_penalties_read" on public.courier_penalties for select to authenticated
using(courier_id=auth.uid() or (org_id=private.current_org_id() and private.current_role()='admin'));

drop policy if exists "courier_penalties_admin" on public.courier_penalties;
create policy "courier_penalties_admin" on public.courier_penalties for all to authenticated
using(org_id=private.current_org_id() and private.current_role()='admin')
with check(org_id=private.current_org_id() and private.current_role()='admin');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('courier-avatars','courier-avatars',true,6291456,array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "courier_avatar_own_insert_v6" on storage.objects;
create policy "courier_avatar_own_insert_v6" on storage.objects for insert to authenticated
with check(bucket_id='courier-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "courier_avatar_own_update_v6" on storage.objects;
create policy "courier_avatar_own_update_v6" on storage.objects for update to authenticated
using(bucket_id='courier-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='courier-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "courier_avatar_own_delete_v6" on storage.objects;
create policy "courier_avatar_own_delete_v6" on storage.objects for delete to authenticated
using(bucket_id='courier-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function private.apply_courier_score_event()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.courier_scores(user_id,org_id,points,updated_at)
  values(new.courier_id,new.org_id,greatest(0,new.points_delta),now())
  on conflict(user_id) do update
    set points=greatest(0,public.courier_scores.points+new.points_delta),
        updated_at=now();
  return new;
end $$;
revoke all on function private.apply_courier_score_event() from public,anon,authenticated;
drop trigger if exists courier_score_event_apply_v6 on public.courier_score_events;
create trigger courier_score_event_apply_v6 after insert on public.courier_score_events for each row execute function private.apply_courier_score_event();

create or replace function private.reward_delivery_status_v6()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  cfg public.gamification_settings%rowtype;
  pts integer:=0;
  key text:=null;
  event_id uuid;
begin
  if new.assigned_courier_id is null or new.status is not distinct from old.status then return new; end if;

  select * into cfg from public.gamification_settings where org_id=new.org_id;
  if not found then
    cfg.accepted_points:=5;
    cfg.arrived_points:=10;
    cfg.delivered_points:=100;
  end if;

  if new.status='accepted' then
    pts:=coalesce(cfg.accepted_points,5); key:='delivery_accepted';
  elsif new.status='arrived' then
    pts:=coalesce(cfg.arrived_points,10); key:='delivery_arrived';
  elsif new.status='delivered' then
    pts:=coalesce(cfg.delivered_points,100); key:='delivery_delivered';
  elsif new.status='failed' then
    pts:=0; key:='delivery_failed';
  end if;

  if key is not null then
    insert into public.courier_score_events(org_id,courier_id,delivery_id,points_delta,event_key,reason,actor_id)
    values(new.org_id,new.assigned_courier_id,new.id,pts,key,'Teslimat durum puanı',auth.uid())
    on conflict(delivery_id,event_key) do nothing
    returning id into event_id;
  end if;

  if event_id is not null and new.status='delivered' then
    insert into public.courier_scores(
      user_id,org_id,delivered_count,streak_days,last_delivery_date,updated_at
    )
    values(new.assigned_courier_id,new.org_id,1,1,current_date,now())
    on conflict(user_id) do update set
      delivered_count=public.courier_scores.delivered_count+1,
      streak_days=case
        when public.courier_scores.last_delivery_date=current_date then public.courier_scores.streak_days
        when public.courier_scores.last_delivery_date=current_date-1 then public.courier_scores.streak_days+1
        else 1
      end,
      last_delivery_date=current_date,
      updated_at=now();
  elsif event_id is not null and new.status='failed' then
    insert into public.courier_scores(user_id,org_id,failed_count,updated_at)
    values(new.assigned_courier_id,new.org_id,1,now())
    on conflict(user_id) do update set
      failed_count=public.courier_scores.failed_count+1,
      updated_at=now();
  end if;

  return new;
end $$;
revoke all on function private.reward_delivery_status_v6() from public,anon,authenticated;
drop trigger if exists deliveries_growth_reward_v6 on public.deliveries;
create trigger deliveries_growth_reward_v6 after update of status on public.deliveries for each row execute function private.reward_delivery_status_v6();

create or replace function private.process_courier_cancel_v6()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  cfg public.gamification_settings%rowtype;
  daily_count integer;
  penalty integer;
  score_event_id uuid;
begin
  select * into cfg from public.gamification_settings where org_id=new.org_id;
  penalty:=coalesce(cfg.courier_cancel_points,-75);

  insert into public.courier_score_events(org_id,courier_id,delivery_id,points_delta,event_key,reason,actor_id)
  values(new.org_id,new.courier_id,new.delivery_id,penalty,'courier_cancel_confirmed',new.reason,new.confirmed_by)
  on conflict(delivery_id,event_key) do nothing
  returning id into score_event_id;

  if score_event_id is not null then
    insert into public.courier_scores(user_id,org_id,courier_cancel_count,updated_at)
    values(new.courier_id,new.org_id,1,now())
    on conflict(user_id) do update set
      courier_cancel_count=public.courier_scores.courier_cancel_count+1,
      updated_at=now();
  end if;

  select count(*) into daily_count
  from public.courier_cancel_events
  where courier_id=new.courier_id
    and created_at>=date_trunc('day',now())
    and created_at<date_trunc('day',now())+interval '1 day';

  if coalesce(cfg.auto_suspend,true) and daily_count>=coalesce(cfg.daily_cancel_limit,5) then
    update public.profiles set is_active=false where user_id=new.courier_id;
    update public.courier_scores
      set suspended_reason='Günlük kurye kaynaklı iptal sınırı aşıldı. Yönetici incelemesi gerekli.',
          updated_at=now()
      where user_id=new.courier_id;
  end if;

  return new;
end $$;
revoke all on function private.process_courier_cancel_v6() from public,anon,authenticated;
drop trigger if exists courier_cancel_guard_v6 on public.courier_cancel_events;
create trigger courier_cancel_guard_v6 after insert on public.courier_cancel_events for each row execute function private.process_courier_cancel_v6();

create or replace function private.notify_courier_promotion_v6()
returns trigger language plpgsql security definer set search_path=''
as $
declare reward_text text;
begin
  if to_regclass('public.notifications') is null then return new; end if;
  if new.is_active is not true then return new; end if;
  if tg_op='UPDATE' and old.is_active is true then return new; end if;

  reward_text:=coalesce(
    nullif(new.reward_label,''),
    case when coalesce(new.reward_amount,0)>0 then trim(to_char(new.reward_amount,'FM999999990D00'))||' ₺ ek ödül' else 'Özel ödül' end
  );

  insert into public.notifications(user_id,kind,title,body)
  select p.user_id,'system','Yeni ek kazanç hedefi',
         concat_ws(' • ',new.title,reward_text)
  from public.profiles p
  where p.org_id=new.org_id
    and p.role='courier'
    and p.is_active=true;

  return new;
end $;
revoke all on function private.notify_courier_promotion_v6() from public,anon,authenticated;
drop trigger if exists courier_promotion_notify_v6 on public.courier_promotions;
create trigger courier_promotion_notify_v6
after insert or update of is_active on public.courier_promotions
for each row execute function private.notify_courier_promotion_v6();

create or replace function private.notify_courier_account_state_v6()
returns trigger language plpgsql security definer set search_path=''
as $
begin
  if new.role<>'courier' or new.is_active is not distinct from old.is_active then return new; end if;
  if to_regclass('public.notifications') is null then return new; end if;

  insert into public.notifications(user_id,kind,title,body)
  values(
    new.user_id,
    'system',
    case when new.is_active then 'Kurye hesabın yeniden açıldı' else 'Kurye hesabın incelemeye alındı' end,
    case when new.is_active
      then 'Yönetici incelemesi tamamlandı. Görev ekranına yeniden erişebilirsin.'
      else 'Yeni görev işlemleri durduruldu. Profil ekranından hesap durumunu ve ceza notunu görebilirsin.'
    end
  );
  return new;
end $;
revoke all on function private.notify_courier_account_state_v6() from public,anon,authenticated;
drop trigger if exists courier_account_state_notify_v6 on public.profiles;
create trigger courier_account_state_notify_v6
after update of is_active on public.profiles
for each row execute function private.notify_courier_account_state_v6();

insert into public.gamification_settings(org_id)
select id from public.organizations on conflict(org_id) do nothing;

insert into public.courier_scores(user_id,org_id)
select user_id,org_id from public.profiles where role='courier' and org_id is not null
on conflict(user_id) do nothing;


-- Explicit Data API grants. RLS remains the authorization boundary.
grant select,insert,update on public.courier_profile_media to authenticated;
grant select on public.courier_scores to authenticated;
grant select,insert on public.courier_score_events to authenticated;
grant select,insert,update,delete on public.courier_promotions to authenticated;
grant select,insert,update on public.gamification_settings to authenticated;
grant select,insert on public.courier_cancel_events to authenticated;
grant select,insert,update on public.courier_penalties to authenticated;
