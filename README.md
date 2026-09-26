# yaaTeslimat

Dükkan ve sevkiyat personeli için responsive teslimat operasyon uygulaması.

## v0.6 — Operasyon Merkezi

- Baştan yazılmış premium responsive tema
- Koyu operasyon sidebar + açık veri alanı
- Geciken teslimat uyarıları
- 15 dakikadan uzun süredir görülmeyen görev uyarıları
- Eksik adres / telefon / ilçe / ürün / personel kontrolü
- Bekliyor / Yolda / Tamamlandı / Sorun operasyon panosu
- Masaüstünde sürükle-bırak personel atama
- Mobilde kart içinden personel seçimi
- Yerel modda eski teslimat kayıtlarındaki personelleri otomatik toparlama
- Supabase Auth + rol tabanlı RLS
- Supabase Realtime canlı yenileme
- Optimistic UI rollback: bulut yazımı başarısızsa ekran eski değere döner
- İşlem kayıtları / denetim izi
- Zorunlu 6 adımlı teslimat checklist'i
- PWA service worker + kurulum rehberi
- Web Push abonelik ve görev bildirimi
- Telefonla arama + Google Maps yol tarifi
- `yaaertu codeR` geliştirici kimliği
- Supabase yoksa güvenli yerel çalışma modu

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

yaaTeslimat için **ayrı bir Supabase projesi** kullanılması önerilir.

SQL dosyalarını sırasıyla uygula:

1. `supabase/schema.sql`
2. `supabase/migrations/20260926_realtime_auth_push.sql`
3. `supabase/migrations/20260927_v06_hardening.sql`
4. `supabase/migrations/20260927_v06_courier_guard.sql`

Sonra:

1. Supabase Auth içinden dükkan kullanıcı hesabını oluştur.
2. `profiles` tablosuna kullanıcıyı `admin` veya `office` rolüyle ekle.
3. Sevkiyatçı kullanıcılarını Auth içinde oluştur.
4. Sevkiyatçıları `profiles.role = 'courier'` olarak tanımla.
5. `staff.user_id` ile ilgili Auth/Profile kullanıcısını eşleştir.
6. Vercel Environment Variables alanına aşağıdaki değerleri ekle.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_REQUIRE_AUTH=true

NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
SUPABASE_SERVICE_ROLE_KEY=
```

> `SUPABASE_SERVICE_ROLE_KEY` ve `VAPID_PRIVATE_KEY` yalnız server environment değişkenidir. Asla `NEXT_PUBLIC_` ile başlamamalıdır.

## Roller

- `admin`: tam yönetim
- `office`: dükkan operasyonu, teslimat/personel yönetimi
- `courier`: yalnız kendisine atanmış sevkiyatları görür/günceller
- `viewer`: operasyonu salt okunur izler

## Canlı operasyon davranışı

- Dükkan teslimat oluşturur.
- Personel atanınca durum `assigned` olur.
- Web Push yapılandırılmışsa personelin kayıtlı cihazına bildirim gider.
- Personel `Gördüm`, `Yola çıktım`, checklist ve `Teslim edildi` işlemlerini günceller.
- Realtime açık cihazlara yeni veriyi yayınlar.
- Bulut güncellemesi başarısız olursa istemci yanlış durumu ekranda bırakmaz; değişikliği geri alır.

## Güvenlik

- Temel şema RLS açık ve **deny-by-default** gelir.
- Eski geniş authenticated politikaları v0.6 migration'ında kaldırılır.
- `created_by` ve `actor_id` varsayılan olarak `auth.uid()` kullanır.
- Gerçek müşteri adı, telefon ve adresleri kaynak koda/demo fixture'larına yazılmaz.
- Push endpoint'i Bearer token ve `admin/office` rolü doğrular.
- Push bildiriminin kilit ekranı metninde müşteri adı/adres/telefon gösterilmez.

## Geliştirici

**yaaertu codeR**
