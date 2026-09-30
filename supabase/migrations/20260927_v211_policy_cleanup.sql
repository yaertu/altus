-- yaaTeslimat v2.1.1 - policy/performance cleanup for store settings/catalog

create index if not exists app_settings_updated_by_idx
  on public.app_settings(updated_by);

-- Split manage policies so SELECT has only the dedicated read policy.
drop policy if exists "app_settings_manage_v21" on public.app_settings;

create policy "app_settings_insert_v211"
on public.app_settings
for insert to authenticated
with check ((select private.current_role()) in ('admin','office'));

create policy "app_settings_update_v211"
on public.app_settings
for update to authenticated
using ((select private.current_role()) in ('admin','office'))
with check ((select private.current_role()) in ('admin','office'));

create policy "app_settings_delete_v211"
on public.app_settings
for delete to authenticated
using ((select private.current_role()) in ('admin','office'));

drop policy if exists "product_catalog_manage_v21" on public.product_catalog;

create policy "product_catalog_insert_v211"
on public.product_catalog
for insert to authenticated
with check ((select private.current_role()) in ('admin','office'));

create policy "product_catalog_update_v211"
on public.product_catalog
for update to authenticated
using ((select private.current_role()) in ('admin','office'))
with check ((select private.current_role()) in ('admin','office'));

create policy "product_catalog_delete_v211"
on public.product_catalog
for delete to authenticated
using ((select private.current_role()) in ('admin','office'));

-- The Web Push config is service-role only. A policy keeps the linter explicit;
-- service_role bypasses RLS, while client roles retain zero privileges.
drop policy if exists "web_push_config_service_v211" on public.web_push_config;
create policy "web_push_config_service_v211"
on public.web_push_config
for all to service_role
using (true)
with check (true);

-- Obsolete public RPCs from the earlier VAPID approach are no longer used.
drop function if exists public.get_vapid_public_key();
drop function if exists public.get_push_server_config();
