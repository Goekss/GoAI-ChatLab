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

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const API_KEY = process.env.OPENROUTER_API_KEY;
const FREE_MODELS = new Set([
  "qwen/qwen3.8-27b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "inclusionai/ling-3.0-flash-sante:free",
]);

// Build varsa static yayınla
if (!process.env.VERCEL && fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
}

app.post(["/chat", "/api/chat"], async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured on server" });
    }
    const { model, systemPrompt, messages = [], userText } = req.body;
    if (!FREE_MODELS.has(model)) {
      return res.status(400).json({ error: "Only the three approved free models are allowed." });
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
