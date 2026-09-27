-- yaaTeslimat v2.1 - store identity + Altus product catalog
-- Adds shared branding/settings and an initial official Altus model catalog.

create table if not exists public.app_settings (
  id text primary key default 'default' check (id='default'),
  store_name text not null default 'ALTUS Mağazası',
  store_subtitle text not null default 'Teslimat & Servis',
  store_phone text,
  store_address text,
  store_city text not null default 'İstanbul',
  logo_url text,
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

insert into public.app_settings(id)
values ('default')
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_read_v21" on public.app_settings;
create policy "app_settings_read_v21"
on public.app_settings for select to authenticated
using (true);

drop policy if exists "app_settings_manage_v21" on public.app_settings;
create policy "app_settings_manage_v21"
on public.app_settings for all to authenticated
using ((select private.current_role()) in ('admin','office'))
with check ((select private.current_role()) in ('admin','office'));

create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'ALTUS',
  category text not null,
  model text not null,
  product_name text not null,
  source_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand,model)
);

create index if not exists product_catalog_category_idx
  on public.product_catalog(category, active);
create index if not exists product_catalog_model_idx
  on public.product_catalog(model);

alter table public.product_catalog enable row level security;

drop policy if exists "product_catalog_read_v21" on public.product_catalog;
create policy "product_catalog_read_v21"
on public.product_catalog for select to authenticated
using (active=true or (select private.current_role()) in ('admin','office'));

drop policy if exists "product_catalog_manage_v21" on public.product_catalog;
create policy "product_catalog_manage_v21"
on public.product_catalog for all to authenticated
using ((select private.current_role()) in ('admin','office'))
with check ((select private.current_role()) in ('admin','office'));

insert into public.product_catalog(brand,category,model,product_name,source_url) values
('ALTUS','Buzdolabı','AL 375 X','No-Frost Buzdolabı','https://www.altus.com.tr/urunler/no-frost-buzdolabi'),
('ALTUS','Buzdolabı','AL 380 X','No-Frost Buzdolabı','https://www.altus.com.tr/urunler/no-frost-buzdolabi'),
('ALTUS','Buzdolabı','ALK 474 X','No-Frost Buzdolabı','https://www.altus.com.tr/urunler/no-frost-buzdolabi'),
('ALTUS','Buzdolabı','ALK 471 XE','No-Frost Buzdolabı','https://www.altus.com.tr/urunler/beyaz-esya-buzdolabi'),
('ALTUS','Buzdolabı','AL BZ 3630 X','No-Frost Buzdolabı','https://www.altus.com.tr/urunler/beyaz-esya-buzdolabi'),
('ALTUS','Buzdolabı','AL 366 BE','Statik Buzdolabı','https://www.altus.com.tr/urunler/statik-buzdolabi'),
('ALTUS','Buzdolabı','AL 355 BE','Statik Buzdolabı','https://www.altus.com.tr/urunler/statik-buzdolabi'),
('ALTUS','Mini Buzdolabı','AL 306 B','Mini Buzdolabı','https://www.altus.com.tr/urunler/mini-buzdolabi'),
('ALTUS','Derin Dondurucu','AL 2451 E','Sandık Tipi Derin Dondurucu','https://www.altus.com.tr/urunler/beyaz-esya-derin-dondurucu'),
('ALTUS','Derin Dondurucu','AL 2360 JE','Joker Tipi Derin Dondurucu','https://www.altus.com.tr/urunler/beyaz-esya-derin-dondurucu'),
('ALTUS','Derin Dondurucu','AL 2205 E','Sandık Tipi Derin Dondurucu','https://www.altus.com.tr/urunler/beyaz-esya-derin-dondurucu'),
('ALTUS','Çamaşır Makinesi','AL CM 121460 D','Çamaşır Makinesi','https://www.altus.com.tr/urunler/beyaz-esya-camasir-makinesi'),
('ALTUS','Çamaşır Makinesi','AL CM 101254 D','Çamaşır Makinesi','https://www.altus.com.tr/urunler/beyaz-esya-camasir-makinesi'),
('ALTUS','Çamaşır Makinesi','AL CM 91254 D','Çamaşır Makinesi','https://www.altus.com.tr/urunler/beyaz-esya-camasir-makinesi'),
('ALTUS','Çamaşır Makinesi','AL CM 91050 D','Çamaşır Makinesi','https://www.altus.com.tr/urunler/beyaz-esya-camasir-makinesi'),
('ALTUS','Çamaşır Makinesi','AL CM 81050','Çamaşır Makinesi','https://www.altus.com.tr/urunler/beyaz-esya-camasir-makinesi'),
('ALTUS','Bulaşık Makinesi','AL 404 MP','Bulaşık Makinesi','https://www.altus.com.tr/urunler/bulasik-makinesi/bulasik-makinesi-al-404-mp'),
('ALTUS','Bulaşık Makinesi','AL 413 P','Bulaşık Makinesi','https://www.altus.com.tr/urunler/bulasik-makinesi/bulasik-makinesi-al-413-p'),
('ALTUS','Kurutma Makinesi','AL KM 1160','Isı Pompalı Kurutma Makinesi','https://www.altus.com.tr/urunler/beyaz-esya-kurutma-makinesi'),
('ALTUS','Kurutma Makinesi','AL KM 1054','Isı Pompalı Kurutma Makinesi','https://www.altus.com.tr/urunler/beyaz-esya-kurutma-makinesi'),
('ALTUS','Kurutma Makinesi','AL KM 954','Isı Pompalı Kurutma Makinesi','https://www.altus.com.tr/urunler/beyaz-esya-kurutma-makinesi'),
('ALTUS','Mikrodalga Fırın','ALMD 15','Mikrodalga Fırın','https://www.altus.com.tr/urunler/mikrodalga-firin/mikrodalga-firin-almd-15'),
('ALTUS','Mikrodalga Fırın','ALMD 20','Mikrodalga Fırın','https://www.altus.com.tr/urunler/mikrodalga-firin/mikrodalga-firin-almd-20'),
('ALTUS','Mikrodalga Fırın','ALMD 25','Mikrodalga Fırın','https://www.altus.com.tr/urunler/mikrodalga-firin/mikrodalga-firin-almd-25'),
('ALTUS','Televizyon','AL43 FHD 6523','Android TV','https://www.altus.com.tr/urunler/televizyon'),
('ALTUS','Televizyon','AL43 UHD 9823','Google TV','https://www.altus.com.tr/urunler/televizyon'),
('ALTUS','Televizyon','AL43 UHD 7523','Android TV','https://www.altus.com.tr/urunler/televizyon'),
('ALTUS','Süpürge','AL 606 SP','Toz Torbasız Süpürge','https://www.altus.com.tr/urunler/kucuk-ev-aletleri-supurge'),
('ALTUS','Süpürge','AL 617','Şarjlı Dikey Süpürge','https://www.altus.com.tr/urunler/sarjli-dikey-supurge'),
('ALTUS','Süpürge','AL 6824 DS','Şarjlı Dikey Süpürge','https://www.altus.com.tr/urunler/sarjli-dikey-supurge'),
('ALTUS','Klima','ALK 9070','Klima','https://www.altus.com.tr/urunler/klima/klima-alk-9070')
on conflict (brand,model) do update
set category=excluded.category,
    product_name=excluded.product_name,
    source_url=excluded.source_url,
    active=true,
    updated_at=now();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'store-assets',
  'store-assets',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/svg+xml']::text[]
)
on conflict (id) do update
set public=true,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "store_assets_insert_v21" on storage.objects;
create policy "store_assets_insert_v21"
on storage.objects for insert to authenticated
with check (
  bucket_id='store-assets'
  and (select private.current_role()) in ('admin','office')
);

drop policy if exists "store_assets_update_v21" on storage.objects;
create policy "store_assets_update_v21"
on storage.objects for update to authenticated
using (
  bucket_id='store-assets'
  and (select private.current_role()) in ('admin','office')
)
with check (
  bucket_id='store-assets'
  and (select private.current_role()) in ('admin','office')
);

drop policy if exists "store_assets_delete_v21" on storage.objects;
create policy "store_assets_delete_v21"
on storage.objects for delete to authenticated
using (
  bucket_id='store-assets'
  and (select private.current_role()) in ('admin','office')
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
