-- yaaTeslimat v1.8.4 - server-side Web Push configuration.
-- Key material is generated inside the Supabase Edge Function at runtime.
-- Client roles have no policies on this table.

create table if not exists public.web_push_config (
  id text primary key default 'default' check (id='default'),
  public_material text not null,
  server_material text not null,
  subject text not null default 'mailto:admin@yaateslimat.app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.web_push_config enable row level security;

revoke all on public.web_push_config from anon, authenticated;
grant all on public.web_push_config to service_role;
