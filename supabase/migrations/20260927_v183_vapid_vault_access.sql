-- yaaTeslimat v1.8.3 - secure VAPID configuration access
-- VAPID secrets are stored separately in Supabase Vault and are NOT committed to source control.

create or replace function public.get_vapid_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='yaateslimat_vapid_public'
  limit 1
$$;

revoke all on function public.get_vapid_public_key() from public, anon;
grant execute on function public.get_vapid_public_key() to authenticated, service_role;

create or replace function public.get_push_server_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'publicKey', max(decrypted_secret) filter (where name='yaateslimat_vapid_public'),
    'privateKey', max(decrypted_secret) filter (where name='yaateslimat_vapid_private'),
    'subject', max(decrypted_secret) filter (where name='yaateslimat_vapid_subject')
  )
  from vault.decrypted_secrets
  where name in ('yaateslimat_vapid_public','yaateslimat_vapid_private','yaateslimat_vapid_subject')
$$;

revoke all on function public.get_push_server_config() from public, anon, authenticated;
grant execute on function public.get_push_server_config() to service_role;
