-- yaaTeslimat v0.6 - courier write guard + event policy hardening

create or replace function public.guard_courier_delivery_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.current_role();

  if role_name = 'courier' then
    -- Sevkiyatçı yalnız durum/checklist akışını güncelleyebilir.
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

    -- Sevkiyatçı durum akışını geriye saramaz / keyfi statü yazamaz.
    if new.status is distinct from old.status then
      if not (
        (old.status = 'assigned' and new.status in ('seen','issue'))
        or (old.status = 'seen' and new.status in ('on_route','issue'))
        or (old.status = 'on_route' and new.status in ('completed','issue'))
        or (old.status = new.status)
      ) then
        raise exception 'Invalid courier status transition: % -> %', old.status, new.status;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists deliveries_guard_courier_update on public.deliveries;
create trigger deliveries_guard_courier_update
before update on public.deliveries
for each row execute function public.guard_courier_delivery_update();

drop policy if exists "events_insert_v3" on public.delivery_events;
create policy "events_insert_v3"
on public.delivery_events
for insert
to authenticated
with check (
  public.current_role() in ('admin','office')
  or (
    public.current_role() = 'courier'
    and delivery_id in (
      select d.id
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = auth.uid()
    )
  )
);

revoke execute on function public.guard_courier_delivery_update() from public;
grant execute on function public.guard_courier_delivery_update() to authenticated;
