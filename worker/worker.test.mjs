// ============================================================================
// worker.test.mjs
// Tests für den Cloudflare Worker (worker/worker.js).
// Cloudflare Worker'ı (worker/worker.js) için testler.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

const { default: worker } = await import("./worker.js");

// Türkçe: Worker'ın beklediği sahte ortam (env) nesnesi.
// Deutsch: Fake-env-Objekt, das der Worker erwartet.
function makeEnv(overrides = {}) {
  return {
    OPENROUTER_API_KEY: "test-key",
    ALLOWED_ORIGIN: "https://goekss.github.io",
    ...overrides,
  };
}

// Türkçe: /chat'e POST için geçerli bir istek oluşturur.
// Deutsch: Erstellt einen gültigen POST-Request für /chat.
function makeRequest({ origin = "https://goekss.github.io", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  return new Request("https://goekss.github.io/chat", {
    method: "POST",
    headers,
    body: body ?? JSON.stringify({ model: "test:free", messages: [{ role: "user", content: "hi" }] }),
  });
}

// ----------------------------------------------------------------------------
test("GET /health 200 döner / liefert 200", async () => {
  // Türkçe: Worker sağlık kontrolüne status:ok ile yanıt verir.
  // Deutsch: Der Worker antwortet auf den Healthcheck mit status:ok.
  const res = await worker.fetch(new Request("https://goekss.github.io/health"), makeEnv());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

// ----------------------------------------------------------------------------
test("ücretli model reddedilir (400) / bezahltes Modell wird abgelehnt (400)", async () => {
  // Türkçe: ':free' bitmeyen model 400 ile reddedilir.
  // Deutsch: Modell ohne ':free' wird mit 400 abgelehnt.
  const req = makeRequest({
    body: JSON.stringify({ model: "openai/gpt-4", messages: [{ role: "user", content: "hi" }] }),
  });
  const res = await worker.fetch(req, makeEnv());
  assert.equal(res.status, 400);
});

// ----------------------------------------------------------------------------
test("boş mesajlar reddedilir (400) / leere Nachrichten werden abgelehnt (400)", async () => {
  // Türkçe: messages boşsa 400 döner.
  // Deutsch: Leeres messages-Array ergibt 400.
  const req = makeRequest({ body: JSON.stringify({ model: "test:free", messages: [] }) });
  const res = await worker.fetch(req, makeEnv());
  assert.equal(res.status, 400);
});

// ----------------------------------------------------------------------------
test("izinsiz origin reddedilir (403) / fremde Origin wird abgelehnt (403)", async () => {
  // Türkçe: Farklı origin'den gelen istek 403 ile reddedilir.
  // Deutsch: Anfragen von fremden Origins werden mit 403 abgelehnt.
  const req = makeRequest({ origin: "http://evil.com" });
  const res = await worker.fetch(req, makeEnv());
  assert.equal(res.status, 403);
});

// ----------------------------------------------------------------------------
test("API anahtarı yoksa 500 döner / ohne API-Key 500", async () => {
  // Türkçe: env'de anahtar yoksa 500 döner.
  // Deutsch: Fehlt der Key im env, kommt 500.
  const res = await worker.fetch(makeRequest(), makeEnv({ OPENROUTER_API_KEY: undefined }));
  assert.equal(res.status, 500);
});

// ----------------------------------------------------------------------------
test("upstream'e max_price=0 gönderir / sendet max_price=0 an Upstream", async () => {
  // Türkçe: Upstream'e faturalama koruması (max_price=0) eklenir.
  // Deutsch: Der Upstream erhält den Abrechnungsschutz (max_price=0).
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
    const res = await worker.fetch(makeRequest(), makeEnv());
    assert.equal(res.status, 200);

    const upstreamBody = JSON.parse(capturedOptions.body);
    assert.deepEqual(upstreamBody.provider, { max_price: { prompt: 0, completion: 0 } });
    assert.ok(capturedOptions.headers.Authorization.startsWith("Bearer "));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
