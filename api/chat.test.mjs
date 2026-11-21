// ============================================================================
// chat.test.mjs
// Unit-Tests für den Vercel-Serverless-Handler (api/chat.mjs).
// Vercel serverless handler'ı (api/chat.mjs) için birim testleri.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

// Handler varsayılan olarak dışa aktarılır.
// Der Handler wird als Default-Export exportiert.
const { default: handler } = await import("./chat.mjs");

// Türkçe: Sahte istek nesnesi; readBody'nin beklediği on() olaylarını sağlar.
// Deutsch: Fake-Request, das die on()-Ereignisse für readBody bereitstellt.
function fakeReq({ method, origin = "", body = "" } = {}) {
  return {
    method,
    headers: { origin },
    on(event, cb) {
      if (event === "data" && body) cb(body);
      if (event === "end") cb();
      return this;
    },
    destroy() {},
  };
}

// Türkçe: Sahte yanıt nesnesi; writeHead/end çağrılarını yakalar.
// Deutsch: Fake-Response, das writeHead/end-Aufrufe abfängt.
function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(status, headers) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
      return this;
    },
    end(data) {
      this.body = data;
      return this;
    },
  };
}

// Türkçe: Geçerli bir ücretsiz model ve dolu mesaj listesi.
// Deutsch: Ein gültiges Free-Modell mit gefüllter Nachrichtenliste.
const VALID_BODY = JSON.stringify({
  model: "test:free",
  messages: [{ role: "user", content: "hi" }],
});

// ----------------------------------------------------------------------------
test("OPTIONS 204 döner / liefert 204", async () => {
  // Türkçe: Tarayıcı ön kontrol (preflight) isteği başarıyla cevaplanır.
  // Deutsch: Der Preflight-Request wird erfolgreich beantwortet.
  const res = fakeRes();
  await handler(fakeReq({ method: "OPTIONS" }), res);
  assert.equal(res.statusCode, 204);
});

// ----------------------------------------------------------------------------
test("GET /health 200 döner / liefert 200", async () => {
  // Türkçe: Healthcheck yanıtı status:ok içerir.
  // Deutsch: Der Healthcheck antwortet mit status:ok.
  const res = fakeRes();
  await handler(fakeReq({ method: "GET" }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { status: "ok" });
});

// ----------------------------------------------------------------------------
test("ücretli model reddedilir (400) / bezahltes Modell wird abgelehnt (400)", async () => {
  // Türkçe: ':free' bitmeyen model 400 ile reddedilir.
  // Deutsch: Modelle ohne ':free' werden mit 400 abgelehnt.
  process.env.OPENROUTER_API_KEY = "test-key";
  const res = fakeRes();
  await handler(
    fakeReq({
      method: "POST",
      origin: "https://goekss.github.io",
      body: JSON.stringify({ model: "openai/gpt-4", messages: [{ role: "user", content: "hi" }] }),
    }),
    res
  );
  assert.equal(res.statusCode, 400);
});

// ----------------------------------------------------------------------------
test("boş mesajlar reddedilir (400) / leere Nachrichten werden abgelehnt (400)", async () => {
  // Türkçe: messages boşsa 400 döner.
  // Deutsch: Leeres messages-Array ergibt 400.
  process.env.OPENROUTER_API_KEY = "test-key";
  const res = fakeRes();
  await handler(
    fakeReq({
      method: "POST",
      origin: "https://goekss.github.io",
      body: JSON.stringify({ model: "test:free", messages: [] }),
    }),
    res
  );
  assert.equal(res.statusCode, 400);
});

// ----------------------------------------------------------------------------
test("izinsiz origin reddedilir (403) / fremde Origin wird abgelehnt (403)", async () => {
  // Türkçe: Farklı bir origin'den gelen istek 403 ile reddedilir.
  // Deutsch: Anfragen von fremden Origins werden mit 403 abgelehnt.
  const res = fakeRes();
  await handler(
    fakeReq({ method: "POST", origin: "http://evil.com", body: VALID_BODY }),
    res
  );
  assert.equal(res.statusCode, 403);
});

// ----------------------------------------------------------------------------
test("API anahtarı yoksa 500 döner / ohne API-Key 500", async () => {
  // Türkçe: Anahtar tanımsızsa 500 döner.
  // Deutsch: Ohne API-Key kommt 500.
  const previous = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  const res = fakeRes();
  await handler(
    fakeReq({ method: "POST", origin: "https://goekss.github.io", body: VALID_BODY }),
    res
  );
  assert.equal(res.statusCode, 500);

  process.env.OPENROUTER_API_KEY = previous;
});

// ----------------------------------------------------------------------------
test("upstream'e max_price=0 gönderir / sendet max_price=0 an Upstream", async () => {
  // Upstream'e faturalama koruması (max_price=0) eklenir.
  //  Der Upstream erhält den Abrechnungsschutz (max_price=0).
  process.env.OPENROUTER_API_KEY = "test-key";
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
    const res = fakeRes();
    await handler(
      fakeReq({ method: "POST", origin: "https://goekss.github.io", body: VALID_BODY }),
      res
    );

    assert.equal(res.statusCode, 200);
    const upstreamBody = JSON.parse(capturedOptions.body);
    assert.deepEqual(upstreamBody.provider, { max_price: { prompt: 0, completion: 0 } });
    assert.ok(capturedOptions.headers.Authorization.startsWith("Bearer "));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
