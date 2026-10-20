import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)), quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildPath = path.join(__dirname, "../build");
const indexPath = path.join(buildPath, "index.html");

const app = express();

// CORS: yalnızca kendi frontend originlerimize izin ver (varsayılan: yerel dev + GitHub Pages).
// Aynı origin'den gelen isteklerde Origin başlığı bulunmaz, bu yüzden `!origin` durumuna izin verilir.
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ORIGIN || "http://localhost:3000,https://goekss.github.io")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Basit bellek-içi istek sınırlayıcı (IP başına) — açık relay kötüye kullanımını sınırlar.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 30;
const rateHits = new Map();

function rateLimiter(req, res, next) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const now = Date.now();
  const hits = (rateHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateHits.set(ip, hits);
  if (hits.length > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }
  next();
}

const API_KEY = process.env.OPENROUTER_API_KEY;

// Yalnızca ücretsiz (`:free`) modellere izin verilir.
// Ek güvence: provider.max_price = 0 ile faturalama kötüye kullanımı engellenir.
function isFreeModel(model) {
  return typeof model === "string" && model.trim().length > 0 && model.endsWith(":free");
}

// Build varsa static yayınla
if (!process.env.VERCEL && fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
}

app.post(["/chat", "/api/chat"], rateLimiter, async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured on server" });
    }
    const { model, systemPrompt, messages = [], userText } = req.body;
    if (!isFreeModel(model)) {
      return res.status(400).json({ error: "Only free models are allowed." });
    }
    const payloadMessages = [];

    if (systemPrompt?.trim()) {
      payloadMessages.push({
        role: "system",
        content: systemPrompt.trim(),
      });
    }

    for (const m of messages) {
      if (m.role === "user" || m.role === "assistant") {
        payloadMessages.push({
          role: m.role,
          content: m.content,
        });
      }
    }

    if (userText) {
      payloadMessages.push({
        role: "user",
        content: typeof userText === "string" ? userText : JSON.stringify(userText),
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: payloadMessages,
        provider: { max_price: { prompt: 0, completion: 0 } },
      }),
      signal: AbortSignal.timeout(280_000),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return res.status(response.ok ? 502 : response.status).json({
        error: data?.error?.message || "OpenRouter API fehlerhaft",
      });
    }

    const assistantMessage = data.choices?.[0]?.message?.content || "No response";
    res.json({ choices: [{ message: { content: assistantMessage } }] });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Sadece build varsa SPA fallback (Express 5 uyumlu middleware)
if (!process.env.VERCEL && fs.existsSync(indexPath)) {
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/chat")) return next();
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(indexPath);
  });
}

export default app;

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
