// ============================================================================
// server.test.mjs
// Integrationstests für den Express-Server (Sicherheit & Routen).
// Express sunucusu için entegrasyon testleri (güvenlik ve rotalar).
// Not: Bu testler Node'un kendi test runner'ıyla (node --test) çalışır.
// Hinweis: Diese Tests laufen mit dem nativen Node-Testrunner (node --test).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

// server.js import edilmeden ÖNCE ortam değişkenlerini ayarlıyoruz;
// çünkü server.js bu değerleri modül yüklenirken okur.
// Wir setzen die Umgebungsvariablen VOR dem Import, da server.js
// diese Werte beim Laden liest.
process.env.OPENROUTER_API_KEY = "test-key";
// Rate limit'i yüksek tutuyoruz ki diğer testler 429'a takılmasın.
// Wir setzen das Rate-Limit hoch, damit andere Tests nicht auf 429 laufen.
process.env.RATE_LIMIT_MAX = "1000";

const { default: app, isFreeModel } = await import("../server/server.js");

// ----------------------------------------------------------------------------
// isFreeModel (Unit)
// ----------------------------------------------------------------------------
test("isFreeModel: ':free' modelleri kabul eder / akzeptiert :free-Modelle", () => {
  // ':free' ile biten model güvenli (ücretsiz) kabul edilir.
  // Modelle mit Endung ':free' gelten als sicher (kostenlos).
  assert.equal(isFreeModel("google/gemini:free"), true);
  assert.equal(isFreeModel("openai/gpt-4"), false);
  assert.equal(isFreeModel(""), false);
  assert.equal(isFreeModel(123), false);
});

// ----------------------------------------------------------------------------
// /health
// ----------------------------------------------------------------------------
test("GET /health 200 döner / liefert 200", async () => {
  // Sağlık kontrolü uygulamanın ayakta olduğunu bildirir.
  // Der Healthcheck meldet, dass die App läuft.
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
});

// ----------------------------------------------------------------------------
// /chat - ücretsiz model zorunluluğu
// ----------------------------------------------------------------------------
test("/chat ücretli modeli reddeder (400) / lehnt bezahltes Modell ab (400)", async () => {
  // Türkçe: Ücretli model gönderilirse 400 ile reddedilir (faturalama koruması).
  // Deutsch: Bezahlte Modelle werden mit 400 abgelehnt (Abrechnungsschutz).
  const res = await request(app)
    .post("/chat")
    .send({ model: "openai/gpt-4", messages: [{ role: "user", content: "hi" }] });

  assert.equal(res.status, 400);
});

// ----------------------------------------------------------------------------
// /chat - boş mesaj dizisi
// ----------------------------------------------------------------------------
test("/chat boş mesajları reddeder (400) / lehnt leere Nachrichten ab (400)", async () => {
  // Mesaj dizisi boşsa 400 döner; upstream'e çöp istek gitmez.
  // Leeres messages-Array wird mit 400 abgelehnt.
  const res = await request(app)
    .post("/chat")
    .send({ model: "test:free", messages: [] });

  assert.equal(res.status, 400);
});

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------
test("CORS: izinli origin'e başlık ekler / setzt Header für erlaubte Origin", async () => {
  // İzinli origin'e Access-Control-Allow-Origin başlığı eklenir.
  // Für erlaubte Origins wird der CORS-Header gesetzt.
  const res = await request(app)
    .post("/chat")
    .set("Origin", "https://goekss.github.io")
    .send({ model: "openai/gpt-4", messages: [{ role: "user", content: "hi" }] });

  assert.equal(res.headers["access-control-allow-origin"], "https://goekss.github.io");
});

test("CORS: izinsiz origin'e başlık EKLEMEZ / setzt keinen Header für fremde Origin", async () => {
  // İzinsiz origin'e CORS başlığı eklenmez (tarayıcı engeller).
  // Für fremde Origins wird kein CORS-Header gesetzt (Browser blockiert).
  const res = await request(app)
    .post("/chat")
    .set("Origin", "http://evil.com")
    .send({ model: "openai/gpt-4", messages: [{ role: "user", content: "hi" }] });

  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

// ----------------------------------------------------------------------------
// API anahtarı eksik
// ----------------------------------------------------------------------------
test("API anahtarı yoksa 500 döner / liefert 500 ohne API-Key", async () => {
  // Anahtar yoksa sunucu 500 ile hata bildirir (proxy çalışamaz).
  // Ohne Key antwortet der Server mit 500.
  process.env.OPENROUTER_API_KEY = "";
  const { default: appNoKey } = await import(`../server/server.js?nokey=${Date.now()}`);

  const res = await request(appNoKey)
    .post("/chat")
    .send({ model: "test:free", messages: [{ role: "user", content: "hi" }] });

  assert.equal(res.status, 500);
  process.env.OPENROUTER_API_KEY = "test-key";
});

// ----------------------------------------------------------------------------
// Upstream isteği (max_price = 0 koruması)
// ----------------------------------------------------------------------------
test("upstream'e max_price=0 gönderir / sendet max_price=0 an Upstream", async () => {
  // Faturalama kötüye kullanımını önlemek için upstream'e max_price=0 gider.
  // Zum Schutz vor Abrechnungsmissbrauch wird max_price=0 gesendet.
  const originalFetch = globalThis.fetch;
  let capturedOptions = null;

  globalThis.fetch = async (_url, options) => {
    capturedOptions = options;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const res = await request(app)
      .post("/chat")
      .send({ model: "test:free", messages: [{ role: "user", content: "hi" }] });

    assert.equal(res.status, 200);
    assert.equal(res.body.choices[0].message.content, "ok");

    const body = JSON.parse(capturedOptions.body);
    assert.deepEqual(body.provider, { max_price: { prompt: 0, completion: 0 } });
    assert.ok(capturedOptions.headers.Authorization.startsWith("Bearer "));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ----------------------------------------------------------------------------
// Rate limiter (Unit - taze modül ile)
// ----------------------------------------------------------------------------
test("rateLimiter: limit aşınca 429 döner / liefert 429 nach Limit", async () => {
  // Aynı IP limiti aşarsa 4. istekte 429 döner.
  // Überschreitet eine IP das Limit, kommt beim 4. Request 429.
  process.env.RATE_LIMIT_MAX = "3";
  const { rateLimiter } = await import(`../server/server.js?ratelimit=${Date.now()}`);

  const req = { headers: { "x-forwarded-for": "10.0.0.99" }, socket: {} };
  let statusCode = null;
  let nextCalls = 0;
  const res = {
    status(code) {
      statusCode = code;
      return { json: () => {} };
    },
  };
  const next = () => {
    nextCalls += 1;
  };

  // İlk 3 istek geçer.
  // Die ersten 3 Anfragen passieren.
  rateLimiter(req, res, next);
  rateLimiter(req, res, next);
  rateLimiter(req, res, next);
  assert.equal(nextCalls, 3);

  // 4. istek reddedilir.
  // Der 4. Request wird abgelehnt.
  rateLimiter(req, res, next);
  assert.equal(statusCode, 429);

  process.env.RATE_LIMIT_MAX = "1000";
});
