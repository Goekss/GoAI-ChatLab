# Vercel'e GitHub olmadan dağıtım

Komutları repo kökünde çalıştırın. Vercel CLI yerel dosyaları yüklediği için GitHub bağlantısı gerekmez.

```powershell
vercel login
vercel link
vercel env add OPENROUTER_API_KEY production
vercel env add OPENROUTER_API_KEY preview
vercel --prod
```

`vercel link` sırasında doğru hesabı/team'i seçin ve yeni proje oluşturun (veya mevcut projenizi seçin). Proje dizini `./` olmalı. CLI kurulu değilse komutlarda `vercel` yerine `npx vercel` kullanın. API anahtarını yalnızca `env add` komutunun istediği alana girin. `REACT_APP_` öneki eklemeyin; bu önek anahtarı tarayıcıya açar. Ortam değişkenini değiştirdiğinizde yeniden dağıtın.

`vercel.json`, React derlemesini `build` dizininden yayınlar ve `/chat` isteklerini `/api/chat` Function'ına yönlendirir. Sunucu bağımlılıkları kurulum sırasında ayrıca yüklenir. Proje ayarlarında Node.js 22.x veya 24.x kullanın. Function süresi 300 saniye, OpenRouter isteği zaman aşımı 280 saniyedir. `.vercelignore` yerel ortam dosyalarını yükleme dışında tutar; `server/.env` otomatik olarak canlıya taşınmaz.

Dağıtım sonrası CLI'ın verdiği adresi açıp kısa bir sohbet gönderin. Preview dağıtımı için `vercel` kullanın. Yerel doğrulama:

```powershell
npm ci
npm ci --prefix server
npm run build
node --test server/vercel.test.js
```

Yerel geliştirmede bir terminalde `npm start`, diğerinde `npm start --prefix server` çalıştırın. Docker/Hugging Face için mevcut `node server/server.js` girişi çalışmaya devam eder.

Vercel Function istek/yanıt boyutu sınırı 4.5 MB'dir. Görsellerin base64 içeriği ve sohbet geçmişi toplam istek boyutuna dahildir. Sınırı aşan isteklerde arayüz dosyaları küçültmeyi veya yeni sohbet açmayı önerir.

Kaynaklar: [CLI ile dağıtım](https://vercel.com/docs/cli/deploy), [Function sınırları](https://vercel.com/docs/functions/limitations).
