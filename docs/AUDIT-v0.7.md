# yaaTeslimat v0.7 — Redesign / UX / Responsive Audit

Tarih: 27.09.2026

## Görselde tespit edilen sorunlar

1. Dört eşit Kanban kolonu özellikle boş durumlarda ekranın büyük bölümünü anlamsız boş yüzey olarak bırakıyordu.
2. İlk kolondaki kartlar çok dar kaldığı için müşteri, ürün, personel ve uyarı bilgileri gereksiz sıkışıyordu.
3. Font ölçeği operasyon ekranı için küçüktü; müşteri/personel sahada hızlı bakışta bilgiyi ayırt etmekte zorlanabilirdi.
4. Üst alan global arama, görünüm teması ve kullanıcı bağlamını yeterince güçlü sunmuyordu.
5. Kritik KPI'lar ve günlük ilerleme aynı görsel ağırlıkta değildi.
6. Personel atama alanı geniş yatay şerit olarak fazla yer kaplıyordu.
7. Desktop düzen küçüldüğünde kolonları sadece daraltmak okunabilirliği bozuyordu.
8. Gündüz/gece teması gerçek state/persistence ile çalışmıyordu.
9. Açık/koyu mod renkleri semantic token sisteminden yönetilmiyordu.
10. Eski tema üst üste eklenen stillerle büyümüştü; yeni tasarımda tek CSS sistemi kullanılması gerekiyordu.

## Web / GitHub araştırmasından alınan tasarım ilkeleri

- shadcn/ui güncel Sidebar bileşeni sidebar'ın kontrollü/collapsible, themeable ve mobile sheet/offcanvas yaklaşımını öne çıkarıyor.
- shadcn/ui theming güncel olarak aynı semantic token setinin light ve dark modda override edilmesini öneriyor.
- shadcn dashboard blocks, navigation + section cards + data area ayrımını güçlü bir temel olarak kullanıyor.
- Güncel responsive dashboard örneklerinde desktop görünümü mobilde birebir küçültmek yerine section/card kompozisyonuna dönüştürülüyor.

Kaynaklar:
- https://ui.shadcn.com/docs/components/radix/sidebar
- https://ui.shadcn.com/docs/theming
- https://ui.shadcn.com/blocks
- https://github.com/Kiranism/next-shadcn-dashboard-starter
- https://github.com/horizon-ui/shadcn-nextjs-boilerplate

## v0.7 tasarım değişiklikleri

### App shell
- Sidebar artık floating panel.
- 1024px altında off-canvas drawer'a dönüşüyor.
- Mobil backdrop eklendi.
- Aktif menü semantic accent ile belirgin.

### Global top bar
- Global arama eklendi.
- Cmd/Ctrl + K kısayolu aktif.
- Gündüz / Gece toggle gerçek çalışıyor.
- Tema localStorage'da saklanıyor.
- Tema sekmeler arasında storage event ile senkron oluyor.
- İlk paint öncesi theme bootstrap script ile flash azaltıldı.
- Bildirim, bağlantı durumu ve kullanıcı özeti tek global bar içinde.

### Kontrol Merkezi
Eski geniş Kanban shell kaldırıldı.

Yeni yapı:
- günlük completion ring
- geciken / görülmedi / eksik bilgi metrik kartları
- iki kolonlu mission-control flow board
- ayrı sağ kontrol rail
- hızlı işlem kartı
- personel atama merkezi
- günün sağlık özeti

### Responsive
- >1500px: yoğun desktop yerleşimi
- 1180–1500px: kontrol rail aşağı iner, flow kartları genişler
- <=1024px: sidebar drawer + mobil bottom navigation
- <=760px: flow tek kolon, header daralır
- <=520px: arama gizlenir, KPI kartları tek kolon

## Light / Dark tema

Semantic token yaklaşımı kullanıldı:
- background
- surface / surface-2 / surface-3
- text / text-2 / muted
- line
- brand
- status color tokens
- sidebar tokens
- shadow tokens

`html[data-theme="dark"]` aynı bileşenleri ayrı CSS kopyaları olmadan yeniden temalandırıyor.

## Kod audit

- Eski commandHero / opsKanban / operationCard / attentionBar sınıfları kaldırıldı.
- Kullanılan component class'ları CSS ile karşılaştırıldı: eksik class = 0.
- Repo taramasında TODO / FIXME / console.log kalıntısı bulunmadı.
- Yerel moddaki teslimat personelleri operationalStaff ile dashboard'a geri kazandırılıyor.
- Global arama gerçekten Teslimatlar görünümüne bağlandı.
- Theme toggle persistence ve cross-tab sync eklendi.
- Theme color browser chrome ile güncelleniyor.
- Reduced motion desteği korunuyor.
- Form / modal / drawer / courier ekranları aynı light-dark token sistemine geçirildi.

## Canlı altyapı notu

Tema ve UI değişiklikleri Supabase bağlantısından bağımsızdır.
Supabase env değerleri yoksa uygulama Yerel modda çalışır.
Canlı Realtime/Auth/Push için yaaTeslimat'a ayrı Supabase projesi bağlanması gerekir.
