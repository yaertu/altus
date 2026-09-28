# ALTUS Teslimat mobil paketleri

Web uygulaması mobilde Capacitor kabuğu içinde `https://altuss.vercel.app` adresini açar. Böylece mağaza ile sevkiyatçı her zaman aynı canlı sürümü kullanır.

## Android APK

```powershell
npm run mobile:sync
npm run android:apk
```

Çıktı: `android/app/build/outputs/apk/debug/app-debug.apk`

## iOS IPA

```bash
npm run mobile:sync
npm run ios:open
```

Mac üzerinde Xcode ile `Product > Archive > Distribute App` adımlarını tamamlayın. Apple sertifikası ve provisioning profile olmadan imzalı `.ipa` üretilemez.
