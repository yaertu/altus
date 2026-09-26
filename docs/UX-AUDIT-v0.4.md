# yaaTeslimat v0.4 — UX / Teknik Audit

Tarih: 26.09.2026

## Amaç

Dükkan personeli teslimatı hızlı oluştursun; sevkiyatçı telefonda yalnız gerekli işi görsün; ekranlar masaüstü, tablet ve telefonda aynı mantıkla çalışsın.

## v0.4 ile düzeltilen UX sorunları

- Masaüstündeki geniş boşluklar azaltıldı ve içerik alanı operasyon yoğunluğuna göre sıkılaştırıldı.
- Kontrol merkezi dört basit aksiyona ayrıldı: İş ekle → Personel seç → Gönder → Takip et.
- Yeni teslimat formu 4 küçük adıma bölündü.
- Ürün seçimi için tek dokunuşluk hızlı ürün seçenekleri eklendi.
- Mobilde sabit alt navigasyon eklendi.
- Sevkiyatçı görünümündeki işlem sırası netleştirildi: Ara → Yol tarifi → Kontrol → Teslim.
- Durum, öncelik ve checklist görsel hiyerarşisi güçlendirildi.
- Manrope değişken fontu ve responsive font ölçekleri eklendi.
- 390px, 620px, 760px, 860px ve 1180px davranışları ayrı optimize edildi.
- İnternet kesilince kullanıcıya doğrudan “İnternet yok” durumu gösteriliyor.

## Görsel araç entegrasyonu

Ürün ve operasyon ikonları Iconify public SVG API üzerinden istek anında yükleniyor. Uygulamada ağ hatası durumunda genel paket ikonuna fallback uygulanıyor. Service Worker, Iconify ikonlarını mümkün olduğunda cache'leyerek tekrar yüklemeleri azaltıyor.

Kaynak:
- https://iconify.design/docs/api/
- https://github.com/iconify/website/blob/main/docs/api/svg.md

## PWA

- Manifest'e app id, scope, kategoriler ve kısayollar eklendi.
- “Yeni Teslimat” PWA shortcut'ı doğrudan teslimat formunu açıyor.
- “Bugünkü Teslimatlar” shortcut'ı ilgili ekrana geçiyor.
- Android/desktop için beforeinstallprompt desteği var.
- iOS için uygulama içinde Ana Ekrana Ekle yönlendirmesi gösteriliyor.
- Push izni yalnız kullanıcı aksiyonuyla isteniyor.

Saha deneyimlerinde iOS tarafında uygulamanın Home Screen'e kurulması push için önemli bir kullanım noktası olmaya devam ediyor. Bu nedenle kurulum rehberi kullanıcıya Ayarlar ekranında gösteriliyor.

## Realtime / güvenlik

Mevcut v0.3 yapı:
- Supabase Auth
- Rol bazlı RLS
- admin / office / courier / viewer
- courier yalnız atanmış satırları okuyacak şekilde politika temeli
- Realtime Postgres Changes
- push abonelikleri
- server-side push gönderimi

Supabase'in güncel dokümantasyonu daha büyük ölçeklerde Broadcast yaklaşımını öneriyor. Bu uygulamanın mevcut küçük saha ekibi senaryosunda Postgres Changes daha az karmaşık başlangıç çözümü; cihaz sayısı ve değişiklik hacmi büyürse Broadcast'a geçiş planlanmalı.

Kaynak:
- https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- https://supabase.com/docs/guides/realtime/authorization

## Sonraki production adımları

1. yaaTeslimat için ayrı Supabase projesi oluştur.
2. schema + v0.3 migration'ı uygula.
3. Dükkan ve sevkiyatçı Auth kullanıcılarını oluştur.
4. profiles rollerini ve staff.user_id eşleştirmelerini yap.
5. Vercel environment değişkenlerini tanımla.
6. VAPID anahtarlarını ekle.
7. Android Chrome, iOS PWA ve Windows Edge üzerinde gerçek cihaz testi yap.
8. Canlı veride RLS test senaryoları çalıştır.
9. Gerekirse Realtime Broadcast'a geçir.

## Veri güvenliği notu

Gerçek müşteri adı, telefon ve açık adresleri GitHub kaynak koduna veya demo fixture'larına yazılmamalıdır. Canlı müşteri bilgileri yalnız yetkili veritabanında tutulmalıdır.
