// Vercel Node.js serverless proxy — OpenRouter'a yalnızca ücretsiz (`:free`) modellerle istek iletir.
// API anahtarı Vercel ortam değişkeninde (OPENROUTER_API_KEY) tutulur; tarayıcıya asla inmez.
// maxDuration: 60 — LLM yanıtları yavaş olabildiği için Edge'in 25 sn limiti yerine Node runtime kullanılır.

export const config = { maxDuration: 60 };

const UPSTREAM = "https://openrouter.ai/api/v1/chat/completions";
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "https://goekss.github.io";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function send(res, status, origin, body) {
  res.writeHead(status, { "Content-Type": "application/json", ...corsHeaders(origin) });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 10_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  if (req.method !== "POST") {
    return send(res, 405, origin, { error: "Method not allowed" });
  }

  if (origin && origin !== ALLOWED_ORIGIN) {
    return send(res, 403, origin, { error: "Forbidden origin" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return send(res, 500, origin, { error: "OPENROUTER_API_KEY not configured" });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, origin, { error: "Invalid JSON body" });
  }

  const { model, messages } = body || {};

  if (typeof model !== "string" || !model.trim() || !model.endsWith(":free")) {
    return send(res, 400, origin, { error: "Only free models are allowed." });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return send(res, 400, origin, { error: "messages must be a non-empty array." });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        provider: { max_price: { prompt: 0, completion: 0 } },
      }),
      signal: AbortSignal.timeout(59_000),
    });

    const text = await upstream.text();

    const headers = new Headers(upstream.headers);
    headers.set("Access-Control-Allow-Origin", origin || ALLOWED_ORIGIN);
    headers.set("Vary", "Origin");

    res.writeHead(upstream.status, Object.fromEntries(headers.entries()));
    return res.end(text);
  } catch {
    return send(res, 502, origin, { error: "Proxy upstream error" });
  }
}