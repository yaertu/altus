# ALTUS Teslimat

Mağaza personeli ve sevkiyatçı için canlı teslimat operasyon sistemi. Aynı ürün web, Android ve iOS kabuğunda çalışır.

## v2.4

- Mağaza için dört adımlı sipariş girişi: müşteri, adres, ürün, personel
- Sevkiyatçı için sıradaki-durak odaklı mobil ekran
- Müşteri, telefon, açık adres, kısa tarif, ürün/model ve büyük işlem tuşları
- Google Maps rota ve isteğe bağlı uygulama içi canlı konum
- Teslim edildi, kurulum yapıldı veya servis kuracak sonuçları
- Kurye notu, zorunlu kontrol listesi ve mağazaya anlık Supabase senkronu
- ALTUS renkleri, sade responsive arayüz ve animasyonlu `yaaertu codeR` imzası

## Web

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Canlı adres: <https://altuss.vercel.app>

## Android ve iOS

Capacitor projeleri `android/` ve `ios/` klasörlerindedir.

```bash
npm run mobile:sync
npm run android:apk
```

Detaylı mobil derleme notu: [`docs/MOBILE-BUILD.md`](docs/MOBILE-BUILD.md)

## Ortam değişkenleri

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_REQUIRE_AUTH=true

NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
SUPABASE_SERVICE_ROLE_KEY=

# Uygulama içi canlı rota için; domain kısıtlı tarayıcı anahtarı kullanın.
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` ve `VAPID_PRIVATE_KEY` yalnız sunucu ortamında tutulmalıdır.

## Supabase

Production proje ref'i: `mfpecvflsludooresdlq`.

Yeni/fresh bir Supabase projesinde migration sırası:

1. `supabase/migrations/20260930_v50_modern_core.sql`
2. `supabase/migrations/20260930_v60_courier_growth.sql`
3. `supabase/migrations/20260930_v61_advisor_hardening.sql`

v50 modern çekirdeği oluşturur: organizasyon, mağaza, profil, ürün kataloğu, teslimat, kanıt, bildirim, presence, RLS, Storage ve private Realtime Broadcast yetkilendirmesi.

v60 kurye gelişim katmanını ekler: avatar, XP/rütbe, promosyon, puan olayları, iptal/ceza ve otomatik askıya alma akışları.

v61 FK indexlerini ve RLS performans/policy hardening ayarlarını uygular.

Edge Functions kaynakları `supabase/functions/` altındadır:

- `public-health`
- `public-tracking`
- `create-user`
- `invite-user`

`public-health` ve `public-tracking` public endpoint olarak deploy edilir; kullanıcı yönetim fonksiyonları JWT doğrulaması gerektirir.

İlk Auth kullanıcısı oluşturulduğunda DB trigger otomatik olarak varsayılan organizasyon + merkez mağazayı oluşturur ve bu ilk kullanıcıyı `admin` yapar. Sonraki kullanıcılar Admin panelindeki create/invite akışından oluşturulur.

## Güvenlik

- Müşteri bilgileri kaynak koda veya demo verisine yazılmaz.
- Push bildiriminde müşteri adı, adresi ve telefonu gösterilmez.
- Bulut güncellemesi başarısızsa arayüz değişikliği geri alınır.
- Müşteri adresi açık topluluk geocoder servislerine gönderilmez.
