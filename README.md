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

SQL dosyalarını sırasıyla uygulayın:

1. `supabase/schema.sql`
2. `supabase/migrations/20260926_realtime_auth_push.sql`
3. `supabase/migrations/20260927_v06_hardening.sql`
4. `supabase/migrations/20260927_v06_courier_guard.sql`

Roller: `admin`, `office`, `courier`, `viewer`. RLS politikaları sevkiyatçının yalnız kendisine atanmış işleri görmesini ve izinli alanları güncellemesini sağlar.

## Güvenlik

- Müşteri bilgileri kaynak koda veya demo verisine yazılmaz.
- Push bildiriminde müşteri adı, adresi ve telefonu gösterilmez.
- Bulut güncellemesi başarısızsa arayüz değişikliği geri alınır.
- Müşteri adresi açık topluluk geocoder servislerine gönderilmez.
