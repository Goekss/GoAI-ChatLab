import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

test("Vercel entry serves both chat paths and forwards provider errors", async () => {
  process.env.VERCEL = "1";
  process.env.OPENROUTER_API_KEY = "test-key";
  const { default: app } = await import("../api/chat.mjs");
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const originalFetch = globalThis.fetch;
  const request = (route, model = "qwen/qwen3.8-27b:free") => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1", port: server.address().port,
      path: route, method: "POST", headers: { "Content-Type": "application/json" },
    }, res => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on("error", reject);
    req.end(JSON.stringify({ model, userText: "Hello" }));
  });
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(options.headers.Authorization, "Bearer test-key");
      assert.deepEqual(JSON.parse(options.body).provider.max_price, { prompt: 0, completion: 0 });
      assert.deepEqual(JSON.parse(options.body).messages, [{ role: "user", content: "Hello" }]);
      return Response.json({ choices: [{ message: { content: "Hi" } }] });
    };
    for (const route of ["/chat", "/api/chat"]) {
      const result = await request(route);
      assert.equal(result.status, 200);
      assert.equal(result.body.choices[0].message.content, "Hi");
    }
    for (const model of ["nvidia/nemotron-3.5-lightning:free", "inclusionai/ling-3.0-flash-sante:free"]) {
      assert.equal((await request("/chat", model)).status, 200);
    }
    globalThis.fetch = async () => { throw new Error("Blocked models must not call OpenRouter"); };
    for (const model of ["openrouter/auto", "openrouter/free", "qwen/qwen3.8-27b", "unknown:free"]) {
      assert.equal((await request("/chat", model)).status, 400);
    }
    globalThis.fetch = async () => Response.json({ error: { message: "Rate limited" } }, { status: 429 });
    assert.deepEqual(await request("/api/chat"), { status: 429, body: { error: "Rate limited" } });
    globalThis.fetch = async () => Response.json({ error: { message: "Provider failed" } });
    assert.equal((await request("/api/chat")).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise(resolve => server.close(resolve));
  }
});
