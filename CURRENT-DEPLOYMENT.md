# Çorlu Altus — Tek Güncel Kaynak

Bu klasör uygulamanın güncel ve kanonik çalışma kopyasıdır.

## Canlı sistem

- Site: <https://corlualtus.vercel.app>
- Sağlık kontrolü: <https://corlualtus.vercel.app/api/health>
- Uygulama sürümü: `6.1.0`
- Vercel projesi: `polyhanx-8541/corlualtus`
- Production deployment: `dpl_BMd2edxd86h4WcwFVYqeLr8c1p79`

## Kaynak kod

- GitHub: <https://github.com/yaertu/altus>
- Pull request: <https://github.com/yaertu/altus/pull/3>
- Dal: `feature/courier-growth-v6`
- Commit: `4b345895e92d358d035bdf304f2c93e4006e5aa7`

## Supabase

- Production project ref: `mfpecvflsludooresdlq`
- Kullanıcı: `polyhanx@gmail.com`
- Rol: `admin`
- Durum: `active`
- Organizasyon / mağaza: `Altus Sevkiyat / Merkez Mağaza`

Parola bu dosyada veya kaynak kodda tutulmaz. Girişte, doğru Supabase projesinde hesabı oluştururken belirlenen parola kullanılır.

## Doğrulama

30 Eylül 2026 tarihinde aşağıdakiler doğrulandı:

- `npm run typecheck` geçti.
- `npm run build` geçti.
- `/api/health` yanıtı: `status=ok`, `database=ok`, `version=6.1.0`.
- GitHub `verify` kontrolü geçti.

`npm run audit:source` ve `npm run preflight` komutları package.json içinde tanımlı, ancak ilgili `scripts/*.mjs` dosyaları GitHub dalında bulunmuyor. Uygulamanın typecheck ve production build kontrolleri bundan etkilenmiyor.
