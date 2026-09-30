-- yaaTeslimat v1.1 - secure delivery proof storage
-- Photo + customer signature metadata and private Supabase Storage bucket.

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

create index if not exists delivery_proofs_delivery_id_idx
  on public.delivery_proofs(delivery_id, created_at desc);

create index if not exists delivery_proofs_created_by_idx
  on public.delivery_proofs(created_by);

alter table public.delivery_proofs enable row level security;

drop policy if exists "delivery_proofs_read_v11" on public.delivery_proofs;
create policy "delivery_proofs_read_v11"
on public.delivery_proofs
for select
to authenticated
using (
  public.current_role() in ('admin','office','viewer')
  or delivery_id in (
    select d.id
    from public.deliveries d
    join public.staff s on s.id = d.assignee_id
    where s.user_id = auth.uid()
  )
);

drop policy if exists "delivery_proofs_insert_v11" on public.delivery_proofs;
create policy "delivery_proofs_insert_v11"
on public.delivery_proofs
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.current_role() in ('admin','office')
    or delivery_id in (
      select d.id
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = auth.uid()
    )
  )
);

drop policy if exists "delivery_proofs_delete_v11" on public.delivery_proofs;
create policy "delivery_proofs_delete_v11"
on public.delivery_proofs
for delete
to authenticated
using (
  public.current_role() in ('admin','office')
  or (
    created_by = auth.uid()
    and delivery_id in (
      select d.id
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = auth.uid()
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-proofs',
  'delivery-proofs',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "delivery_proofs_storage_read_v11" on storage.objects;
create policy "delivery_proofs_storage_read_v11"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (
    public.current_role() in ('admin','office','viewer')
    or (storage.foldername(name))[1] in (
      select d.id::text
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = auth.uid()
    )
  )
);

drop policy if exists "delivery_proofs_storage_insert_v11" on storage.objects;
create policy "delivery_proofs_storage_insert_v11"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    public.current_role() in ('admin','office')
    or (storage.foldername(name))[1] in (
      select d.id::text
      from public.deliveries d
      join public.staff s on s.id = d.assignee_id
      where s.user_id = auth.uid()
    )
  )
);

drop policy if exists "delivery_proofs_storage_delete_v11" on storage.objects;
create policy "delivery_proofs_storage_delete_v11"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (
    public.current_role() in ('admin','office')
    or (
      (storage.foldername(name))[2] = auth.uid()::text
      and (storage.foldername(name))[1] in (
        select d.id::text
        from public.deliveries d
        join public.staff s on s.id = d.assignee_id
        where s.user_id = auth.uid()
      )
    )
  )
);
