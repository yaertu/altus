# yaaTeslimat v0.6 — Truth / UX / Security Audit

Tarih: 27.09.2026

## Araştırma özeti

Yeni tema ve operasyon akışı üç kaynaktan beslendi:

- shadcn/ui dashboard + sidebar örnekleri: sade navigasyon, güçlü bilgi hiyerarşisi, ayrı section card yapısı.
- Güncel lojistik dashboard örnekleri: kritik metrikleri üste alma, priority alert alanı, canlı sevkiyat durumu ve dengeli whitespace.
- UX toplulukları: mobilde geniş tabloyu küçültmek yerine kart/stack görünümüne çevirmek; kritik aksiyonları progressive disclosure ile göstermek.

Kaynaklar:
- https://ui.shadcn.com/blocks
- https://ui.shadcn.com/blocks/sidebar
- https://dribbble.com/shots/27108935-LogiTrack-Logistics-Operations-Dashboard-UI
- https://www.reddit.com/r/UXDesign/comments/1b2znzv/
- https://www.reddit.com/r/UXDesign/comments/1gepsph/

## Kod audit bulguları ve düzeltmeler

### 1. Profil sorgusu admin/office hesaplarında birden fazla satır döndürebilirdi

Eski davranış:
`profiles.select(...).maybeSingle()`

Admin/office RLS başka profilleri de okuyabildiği için sorgu birden fazla satır döndürebilirdi.

Düzeltme:
- önce aktif Auth kullanıcısı okunuyor
- profil sorgusu `.eq("id", user.id)` ile sınırlandırılıyor

### 2. Cloud mutation hatalarında UI yanlış durumda kalabiliyordu

Etkilenen akışlar:
- teslimat durumu
- checklist
- personel atama
- teslimat silme

Düzeltme:
- optimistic değişiklikler cloud write başarısızsa rollback yapıyor
- false audit event üretimi azaltıldı
- delete işlemi cloud başarısından sonra UI'dan kaldırılıyor

### 3. Yerel modda teslimata atanmış isimler personel listesinde görünmüyordu

Eski localStorage kayıtlarında teslimat içinde personel adı varken `staff` dizisi boş olabiliyordu.

Düzeltme:
- yalnız yerel modda teslimat kayıtlarından personel dizini toparlanıyor
- mevcut atamalar personel dock'unda görünür hale geliyor
- canlı Supabase modunda sahte/derived staff ID kullanılmıyor

### 4. Sipariş numarası çakışma alanı gereksiz küçüktü

Eski son ek 100–999 aralığındaydı.

Düzeltme:
- tarih + zaman/random tabanlı kısa alfanümerik suffix kullanılıyor
- çakışma olasılığı ciddi biçimde azaltıldı
- DB unique constraint son güvenlik katmanı olmaya devam ediyor

### 5. Teslimat formu eksik adres/telefon kabul edebiliyordu

Yeni doğrulamalar:
- müşteri adı zorunlu
- telefon en az 10 rakam
- açık adres minimum anlamlı uzunluk
- ilçe zorunlu
- ürün zorunlu

### 6. Push endpoint relation lookup'u kırılgandı

Eski tek-query relation alias yerine:
- delivery -> assignee_id
- staff -> user_id
- push_subscriptions -> endpoint

şeklinde açık sorgu zinciri kullanılıyor.

Ek olarak:
- invalid JSON kontrolü
- profile aktiflik kontrolü
- admin/office yetki kontrolü
- expired push aboneliği temizleme
- müşteri PII'sini notification body'ye koymama

### 7. Base Supabase schema fazla geniş policy ile başlayabiliyordu

Yeni davranış:
- RLS açık
- base schema deny-by-default
- rol politikaları migration'dan geliyor
- eski geniş authenticated policy'ler hardening migration'da tekrar temizleniyor
- realtime publication ekleme işlemleri idempotent

### 8. Audit alanları Auth kullanıcısını otomatik yazmıyordu

Yeni:
- deliveries.created_by default auth.uid()
- delivery_events.actor_id default auth.uid()

### 9. Kullanılmayan demo data modülü kaldırıldı

`lib/demo-data.ts` silindi.
Gerçek müşteri verisinin kaynak koda girmemesi ilkesi korunuyor.

### 10. Web response hardening eksikti

Yeni `next.config.ts`:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera/microphone/geolocation kapalı
- service worker için no-cache

## Tema v0.6

Tema tamamen sıfırdan yazıldı.

Ana kararlar:
- koyu enterprise sidebar
- açık ve sakin ana çalışma alanı
- minimum yazı boyutları yükseltildi
- dev hero yerine kompakt operasyon özeti
- 4 kolonlu desktop kanban
- 2 kolon tablet
- 1 kolon mobile
- mobil bottom navigation
- modal/drawer aynı design token sistemini kullanıyor
- reduced-motion desteği
- keyboard focus-visible
- renkler yalnız durum/öncelik anlatmak için kullanılıyor

## Canlı operasyon mantığı

- geciken iş: tarih geçmiş veya bugünkü time-window bitmiş, durum tamamlanmamış/sorun değil
- görülmedi: assigned durumda 15 dakika+ değişiklik yok
- eksik bilgi: müşteri / telefon / adres / ilçe / ürün / personel kontrolleri
- kanban: Bekliyor / Yolda / Tamamlandı / Sorun
- desktop: drag/drop personel atama
- mobile: kart içi select ile atama

## Production'dan önce kalan zorunlu adım

yaaTeslimat için ayrı Supabase projesi oluşturulup environment değişkenleri Vercel'e tanımlanmalıdır. Mevcut bağlı Supabase hesabında yalnız `baypin` projesi görüldüğü için ona dokunulmamıştır.
