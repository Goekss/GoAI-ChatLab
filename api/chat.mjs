// Vercel Edge proxy — OpenRouter'a yalnızca ücretsiz (`:free`) modellerle istek iletir.
// API anahtarı Vercel ortam değişkeninde (OPENROUTER_API_KEY) tutulur; tarayıcıya asla inmez.

export const config = { runtime: "edge" };

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

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default async function handler(request) {
  const origin = request.headers.get("origin") || "";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  if (origin && origin !== ALLOWED_ORIGIN) {
    return json({ error: "Forbidden origin" }, 403, origin);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json({ error: "OPENROUTER_API_KEY not configured" }, 500, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const { model, messages } = body || {};

  if (typeof model !== "string" || !model.trim() || !model.endsWith(":free")) {
    return json({ error: "Only free models are allowed." }, 400, origin);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages must be a non-empty array." }, 400, origin);
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
    });

    // Yanıtı buffer'la (uygulama zaten tam JSON bekliyor, akış kullanmıyor).
    const text = await upstream.text();

    const headers = new Headers(upstream.headers);
    headers.set("Access-Control-Allow-Origin", origin || ALLOWED_ORIGIN);
    headers.set("Vary", "Origin");

    return new Response(text, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return json({ error: "Proxy upstream error" }, 502, origin);
  }
}