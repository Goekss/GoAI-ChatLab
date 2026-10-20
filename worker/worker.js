// GoAI ChatLab — OpenRouter proxy (Cloudflare Worker)
// API anahtarı SADECE Worker'ın secret'ında (OPENROUTER_API_KEY) durur.
// Tarayıcıya asla inmez; istekler bu Worker üzerinden iletilir.

const UPSTREAM = "https://openrouter.ai/api/v1/chat/completions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname !== "/chat" || request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Proxy: OPENROUTER_API_KEY not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    try {
      const upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "Content-Type": request.headers.get("Content-Type") || "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: request.body,
      });

      const headers = new Headers(upstream.headers);
      headers.set("Access-Control-Allow-Origin", "*");

      // Gövde akışını olduğu gibi ilet (yüksek CPU maliyeti yok)
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Proxy upstream error" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  },
};
