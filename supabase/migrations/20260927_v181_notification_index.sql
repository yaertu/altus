-- yaaTeslimat v1.8.1 - notification lookup index
create index if not exists notifications_delivery_id_idx
  on public.notifications(delivery_id);
