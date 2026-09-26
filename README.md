# yaaTeslimat

Dükkan ve sevkiyat personeli için responsive teslimat operasyon uygulaması.

## v0.2

- Beyaz / açık operasyon teması
- İşlevsel sol menü
- Dükkan görünümü ve sevkiyatçı görünümü
- Yeni teslimat oluşturma
- Personel ekleme ve görev atama
- Müşteri rehberi
- Günlük planlama
- Zorunlu teslimat checklist'i
- Telefonla arama ve Google Maps yol tarifi kısayolları
- İşlem geçmişi
- PWA / service worker / bildirim izni
- `yaaertu codeR` animasyonlu geliştirici kimliği
- Mobil, tablet ve masaüstü responsive arayüz

## Kurulum

```bash
npm install
npm run dev
```

Production kontrolü:

```bash
npm run build
```

## Veri katmanı

Arayüz Supabase bağlantısı olmadan da yerel tarayıcı hafızasıyla çalışır. Çoklu cihaz senkronizasyonu için `.env.example` içindeki Supabase değişkenlerini tanımlayıp `supabase/schema.sql` şemasını kullanın.

> Gerçek müşteri isimleri, telefonları ve adresleri kaynak koda eklenmemelidir.

## Geliştirici

**yaaertu codeR**
