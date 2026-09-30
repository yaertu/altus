
-- Altus v6.1 advisor/performance hardening.

-- Cover foreign keys used by joins, deletes and audit queries.
create index if not exists courier_cancel_events_confirmed_by_idx on public.courier_cancel_events(confirmed_by);
create index if not exists courier_cancel_events_delivery_idx on public.courier_cancel_events(delivery_id);
create index if not exists courier_cancel_events_org_idx on public.courier_cancel_events(org_id);
create index if not exists courier_penalties_created_by_idx on public.courier_penalties(created_by);
create index if not exists courier_penalties_lifted_by_idx on public.courier_penalties(lifted_by);
create index if not exists courier_penalties_org_idx on public.courier_penalties(org_id);
create index if not exists courier_promotions_created_by_idx on public.courier_promotions(created_by);
create index if not exists courier_score_events_actor_idx on public.courier_score_events(actor_id);
create index if not exists courier_score_events_org_idx on public.courier_score_events(org_id);
create index if not exists deliveries_created_by_idx on public.deliveries(created_by);
create index if not exists deliveries_product_idx on public.deliveries(product_id);
create index if not exists delivery_events_actor_idx on public.delivery_events(actor_id);
create index if not exists delivery_proofs_uploaded_by_idx on public.delivery_proofs(uploaded_by);
create index if not exists notifications_delivery_idx on public.notifications(delivery_id);
create index if not exists notifications_org_idx on public.notifications(org_id);
create index if not exists product_media_product_idx on public.product_media(product_id);
create index if not exists push_subscriptions_org_idx on public.push_subscriptions(org_id);

-- Avoid duplicate permissive SELECT policies created by FOR ALL policies.
drop policy if exists products_admin_manage on public.products;
drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products for insert to authenticated
with check (private.current_role() = 'admin');
drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products for update to authenticated
using (private.current_role() = 'admin')
with check (private.current_role() = 'admin');
drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete on public.products for delete to authenticated
using (private.current_role() = 'admin');

drop policy if exists product_media_admin_manage on public.product_media;
drop policy if exists product_media_admin_insert on public.product_media;
create policy product_media_admin_insert on public.product_media for insert to authenticated
with check (org_id=private.current_org_id() and private.current_role()='admin');
drop policy if exists product_media_admin_update on public.product_media;
create policy product_media_admin_update on public.product_media for update to authenticated
using (org_id=private.current_org_id() and private.current_role()='admin')
with check (org_id=private.current_org_id() and private.current_role()='admin');
drop policy if exists product_media_admin_delete on public.product_media;
create policy product_media_admin_delete on public.product_media for delete to authenticated
using (org_id=private.current_org_id() and private.current_role()='admin');

drop policy if exists "courier_promotions_admin" on public.courier_promotions;
drop policy if exists "courier_promotions_admin_insert" on public.courier_promotions;
create policy "courier_promotions_admin_insert" on public.courier_promotions for insert to authenticated
with check(org_id=private.current_org_id() and private.current_role()='admin');
drop policy if exists "courier_promotions_admin_update" on public.courier_promotions;
create policy "courier_promotions_admin_update" on public.courier_promotions for update to authenticated
using(org_id=private.current_org_id() and private.current_role()='admin')
with check(org_id=private.current_org_id() and private.current_role()='admin');
drop policy if exists "courier_promotions_admin_delete" on public.courier_promotions;
create policy "courier_promotions_admin_delete" on public.courier_promotions for delete to authenticated
using(org_id=private.current_org_id() and private.current_role()='admin');

drop policy if exists "gamification_settings_admin" on public.gamification_settings;
drop policy if exists "gamification_settings_admin_insert" on public.gamification_settings;
create policy "gamification_settings_admin_insert" on public.gamification_settings for insert to authenticated
with check(org_id=private.current_org_id() and private.current_role()='admin');
drop policy if exists "gamification_settings_admin_update" on public.gamification_settings;
create policy "gamification_settings_admin_update" on public.gamification_settings for update to authenticated
using(org_id=private.current_org_id() and private.current_role()='admin')
with check(org_id=private.current_org_id() and private.current_role()='admin');
drop policy if exists "gamification_settings_admin_delete" on public.gamification_settings;
create policy "gamification_settings_admin_delete" on public.gamification_settings for delete to authenticated
using(org_id=private.current_org_id() and private.current_role()='admin');

drop policy if exists "courier_penalties_admin" on public.courier_penalties;
drop policy if exists "courier_penalties_admin_insert" on public.courier_penalties;
create policy "courier_penalties_admin_insert" on public.courier_penalties for insert to authenticated
with check(org_id=private.current_org_id() and private.current_role()='admin');
drop policy if exists "courier_penalties_admin_update" on public.courier_penalties;
create policy "courier_penalties_admin_update" on public.courier_penalties for update to authenticated
using(org_id=private.current_org_id() and private.current_role()='admin')
with check(org_id=private.current_org_id() and private.current_role()='admin');
drop policy if exists "courier_penalties_admin_delete" on public.courier_penalties;
create policy "courier_penalties_admin_delete" on public.courier_penalties for delete to authenticated
using(org_id=private.current_org_id() and private.current_role()='admin');

-- Wrap auth.uid() in scalar subqueries so it is evaluated once per statement.

drop policy if exists deliveries_read on public.deliveries;
create policy deliveries_read on public.deliveries for select to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or assigned_courier_id = (select auth.uid())
  )
);

drop policy if exists deliveries_update on public.deliveries;
create policy deliveries_update on public.deliveries for update to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or assigned_courier_id = (select auth.uid())
  )
)
with check (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or assigned_courier_id = (select auth.uid())
  )
);

drop policy if exists delivery_events_read on public.delivery_events;
create policy delivery_events_read on public.delivery_events for select to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and d.assigned_courier_id = (select auth.uid())
    )
  )
);

drop policy if exists delivery_events_insert on public.delivery_events;
create policy delivery_events_insert on public.delivery_events for insert to authenticated
with check (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and d.assigned_courier_id = (select auth.uid())
    )
  )
);

drop policy if exists delivery_proofs_read on public.delivery_proofs;
create policy delivery_proofs_read on public.delivery_proofs for select to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and d.assigned_courier_id = (select auth.uid())
    )
  )
);

drop policy if exists delivery_proofs_insert on public.delivery_proofs;
create policy delivery_proofs_insert on public.delivery_proofs for insert to authenticated
with check (
  org_id = private.current_org_id()
  and uploaded_by = (select auth.uid())
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and d.assigned_courier_id = (select auth.uid())
    )
  )
);

drop policy if exists delivery_proofs_delete on public.delivery_proofs;
create policy delivery_proofs_delete on public.delivery_proofs for delete to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager')
    or uploaded_by = (select auth.uid())
  )
);

drop policy if exists courier_presence_read on public.courier_presence;
create policy courier_presence_read on public.courier_presence for select to authenticated
using (
  org_id = private.current_org_id()
  and (
    private.current_role() in ('admin','store_manager','store_staff')
    or user_id = (select auth.uid())
  )
);

drop policy if exists courier_presence_own_insert on public.courier_presence;
create policy courier_presence_own_insert on public.courier_presence for insert to authenticated
with check (
  user_id = (select auth.uid())
  and org_id = private.current_org_id()
  and private.current_role() = 'courier'
);

drop policy if exists courier_presence_own_update on public.courier_presence;
create policy courier_presence_own_update on public.courier_presence for update to authenticated
using (user_id = (select auth.uid()) and org_id = private.current_org_id())
with check (user_id = (select auth.uid()) and org_id = private.current_org_id());

drop policy if exists push_subscriptions_own_read on public.push_subscriptions;
create policy push_subscriptions_own_read on public.push_subscriptions for select to authenticated
using (user_id=(select auth.uid()));

drop policy if exists push_subscriptions_own_insert on public.push_subscriptions;
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated
with check (user_id=(select auth.uid()) and org_id=private.current_org_id());

drop policy if exists push_subscriptions_own_update on public.push_subscriptions;
create policy push_subscriptions_own_update on public.push_subscriptions for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()) and org_id=private.current_org_id());

drop policy if exists push_subscriptions_own_delete on public.push_subscriptions;
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated
using (user_id=(select auth.uid()));

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated
using (user_id=(select auth.uid()));

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists "courier_profile_media_read" on public.courier_profile_media;
create policy "courier_profile_media_read" on public.courier_profile_media for select to authenticated
using(user_id=(select auth.uid()) or private.current_role() in ('admin','store_manager','store_staff','office','viewer'));

drop policy if exists "courier_profile_media_own_insert" on public.courier_profile_media;
create policy "courier_profile_media_own_insert" on public.courier_profile_media for insert to authenticated
with check(user_id=(select auth.uid()));

drop policy if exists "courier_profile_media_own_update" on public.courier_profile_media;
create policy "courier_profile_media_own_update" on public.courier_profile_media for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

drop policy if exists "courier_scores_read" on public.courier_scores;
create policy "courier_scores_read" on public.courier_scores for select to authenticated
using(user_id=(select auth.uid()) or (org_id=private.current_org_id() and private.current_role() in ('admin','store_manager','store_staff','office')));

drop policy if exists "courier_score_events_read" on public.courier_score_events;
create policy "courier_score_events_read" on public.courier_score_events for select to authenticated
using(courier_id=(select auth.uid()) or (org_id=private.current_org_id() and private.current_role() in ('admin','store_manager','store_staff','office')));

drop policy if exists "courier_cancel_events_read" on public.courier_cancel_events;
create policy "courier_cancel_events_read" on public.courier_cancel_events for select to authenticated
using(courier_id=(select auth.uid()) or (org_id=private.current_org_id() and private.current_role() in ('admin','store_manager')));

drop policy if exists "courier_penalties_read" on public.courier_penalties;
create policy "courier_penalties_read" on public.courier_penalties for select to authenticated
using(courier_id=(select auth.uid()) or (org_id=private.current_org_id() and private.current_role()='admin'));

drop policy if exists altus_realtime_receive on realtime.messages;
create policy altus_realtime_receive on realtime.messages for select to authenticated
using (
  realtime.messages.extension='broadcast'
  and (
    (select realtime.topic()) = ('courier:' || (select auth.uid())::text || ':deliveries')
    or (
      private.current_role() in ('admin','store_manager','store_staff')
      and (select realtime.topic()) in (
        'org:' || private.current_org_id()::text || ':deliveries',
        'org:' || private.current_org_id()::text || ':presence'
      )
    )
  )
);

notify pgrst, 'reload schema';
