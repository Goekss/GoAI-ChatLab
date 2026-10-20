// GoAI ChatLab — OpenRouter proxy (Cloudflare Worker)
// API anahtarı SADECE Worker'ın secret'ında (OPENROUTER_API_KEY) durur.
// Tarayıcıya asla inmez; istekler bu Worker üzerinden iletilir.

const UPSTREAM = "https://openrouter.ai/api/v1/chat/completions";

// Yalnızca ücretsiz (`:free`) modellere izin verilir; ücretli modeller anında reddedilir.
// Ek güvence olarak OpenRouter'a `provider.max_price: 0` gönderilir: model ücretli olsa
// bile istek yine de reddedilir (faturalama kötüye kullanımı imkansız hale gelir).
const ALLOWED_ORIGIN = "https://goekss.github.io";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname !== "/chat" || request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Tarayıcı kaynaklı isteklerde yalnızca kendi frontend'imize izin ver.
    if (origin && origin !== allowedOrigin) {
      return new Response(JSON.stringify({ error: "Forbidden origin" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Proxy: OPENROUTER_API_KEY not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const { model, messages } = body || {};

    if (typeof model !== "string" || !model.trim() || !model.endsWith(":free")) {
      return new Response(JSON.stringify({ error: "Only free models are allowed." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages must be a non-empty array." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        }
      );
    }

    try {
      // İstemcinin gönderdiği ham gövdeyi DEĞİL, temizlenmiş/doğrulanmış bir gövdeyi ilet.
      // Böylece saldırgan model, provider, max_price gibi alanları değiştiremez.
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

      const headers = new Headers(upstream.headers);
      headers.set("Access-Control-Allow-Origin", origin || allowedOrigin);
      headers.set("Vary", "Origin");

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Proxy upstream error" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
  },
};