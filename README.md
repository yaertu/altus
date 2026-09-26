# yaaTeslimat

Dükkan ve sevkiyat personeli için responsive teslimat operasyon uygulaması.

## v0.3 — Canlı Operasyon

- Premium, açık renkli ve daha kompakt responsive tema
- Dükkan görünümü / sevkiyatçı görünümü
- Supabase Auth oturumu ve rol temeli
- Dükkan → personel görev atama
- Supabase Realtime ile cihazlar arası canlı yenileme
- Teslimat durumu: Yeni → Atandı → Görüldü → Yolda → Tamamlandı / Sorun
- Zorunlu teslimat checklist'i
- Personel bazlı RLS temeli
- İşlem kayıtları / denetim izi
- PWA service worker
- Web Push abonelik altyapısı
- Telefonla arama ve Google Maps yol tarifi
- `yaaertu codeR` animasyonlu geliştirici kimliği
- Yerel çalışma modu: Supabase yapılandırılmazsa tarayıcı belleğiyle devam eder

## Kurulum

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm run start
```

## Supabase canlı bağlantı

1. Yeni bir Supabase projesi oluştur.
2. Önce `supabase/schema.sql`, ardından `supabase/migrations/20260926_realtime_auth_push.sql` dosyasını uygula.
3. Supabase Auth içinden dükkan kullanıcı hesabını oluştur.
4. `profiles` tablosuna bu kullanıcıyı `admin` veya `office` rolüyle ekle.
5. Vercel Environment Variables alanına aşağıdakileri ekle:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_REQUIRE_AUTH=true

NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
SUPABASE_SERVICE_ROLE_KEY=
```

> `SUPABASE_SERVICE_ROLE_KEY` ve `VAPID_PRIVATE_KEY` yalnız server environment değişkeni olarak tutulmalıdır; `NEXT_PUBLIC_` ile başlamamalıdır.

## Roller

- `admin`: tam yönetim
- `office`: dükkan operasyonu, teslimat/personel yönetimi
- `courier`: kendisine atanmış sevkiyatları görür
- `viewer`: operasyonu izler

Personelin Supabase Auth kullanıcısını `profiles` tablosunda `courier` yapıp `staff.user_id` alanıyla eşleştir.

## Web Push

Push route'u: `/api/push/send`

Yeni teslimat personele atandığında istemci bu endpoint'i çağırır. Endpoint:
- oturum tokenını doğrular,
- çağıranın `admin/office` olduğunu kontrol eder,
- ilgili personelin push aboneliklerini bulur,
- VAPID ile bildirimi yollar,
- süresi bitmiş abonelikleri temizler.

iOS'ta kullanıcı PWA'yı Ana Ekran'a eklemeli ve bildirim iznini uygulama içindeki kullanıcı aksiyonuyla açmalıdır.

## Güvenlik

Gerçek müşteri isimleri, telefonları ve adresleri kaynak koda eklenmez. Canlı veriler Supabase üzerinde tutulur. RLS politikaları kullanıcının rolüne ve personel eşleşmesine göre erişimi sınırlar.

## Geliştirici

**yaaertu codeR**
