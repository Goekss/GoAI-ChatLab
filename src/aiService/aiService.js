/**
 * OpenRouter API'sine doğrudan (client-side) istek gönderen servis.
 * Backend/proxy gerekmez; GitHub Pages gibi statik hostlarda da çalışır.
 *
 * API anahtarı önce kullanıcının tarayıcısından (localStorage) okunur,
 * yoksa derleme zamanı REACT_APP_OPENROUTER_API_KEY kullanılır.
 */

const OR_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY_STORAGE = "goai_openrouter_api_key";

export const AUTO_MODEL = "auto";
export const DEFAULT_MODEL = AUTO_MODEL;

export const MODEL_OPTIONS = [
  { id: AUTO_MODEL, label: "Otomatik (Auto) - Free" },
  { id: "minimax/minimax-m3.1-flash:free", label: "MiniMax M3.1 Flash - Free" },
  { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning - Free" },
  { id: "cohere/north-mini-code:free", label: "North Mini Code - Free" },
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B - Free" },
  { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B - Free" },
];

// Model silinir ya da yoğunluktan yanıt vermezse otomatik denenir (failover).
// Sıralama canlı testlere göre: önce yanıt veren modeller, sonra yoğun olabilenler.
const TEXT_FALLBACK = [
  "nvidia/nemotron-3.5-lightning:free",
  "minimax/minimax-m3.1-flash:free",
  "cohere/north-mini-code:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

const VISION_FALLBACK = [
  "minimax/minimax-m3.1-flash:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

export function getApiKey() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(API_KEY_STORAGE);
      if (stored && stored.trim()) return stored.trim();
    }
  } catch {
    /* yoksay */
  }
  return process.env.REACT_APP_OPENROUTER_API_KEY?.trim() || "";
}

export function saveApiKey(key) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(API_KEY_STORAGE, (key || "").trim());
    }
  } catch {
    /* yoksay */
  }
}

function buildMessages({ systemPrompt, messages, userText }) {
  const payload = [];

  if (systemPrompt?.trim()) {
    payload.push({ role: "system", content: systemPrompt.trim() });
  }

  for (const m of messages || []) {
    if ((m.role === "user" || m.role === "assistant") && m.content) {
      payload.push({ role: m.role, content: m.content });
    }
  }

  if (userText) {
    payload.push({
      role: "user",
      content:
        typeof userText === "string"
          ? userText
          : Array.isArray(userText)
          ? userText
          : JSON.stringify(userText),
    });
  }

  return payload;
}

function hasImageBlocks(userText) {
  return Array.isArray(userText) && userText.some((b) => b?.type === "image_url");
}

function retriableStatus(code) {
  return [404, 408, 429, 500, 502, 503, 504].includes(code);
}

export async function sendenChatMessage({ model, systemPrompt, messages, userText, signal }) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("Sunucu tarafında API anahtarı bulunamadı. Site yöneticisine başvurun veya Ayarlar'dan kendi anahtarınızı girin.");
  }

  const payloadMessages = buildMessages({ systemPrompt, messages, userText });
  const fallback = hasImageBlocks(userText) ? VISION_FALLBACK : TEXT_FALLBACK;
  const candidates = (model && model !== AUTO_MODEL ? [model, ...fallback] : fallback).filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  );

  let lastError = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(OR_API_URL, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: candidate, messages: payloadMessages }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        /* boş gövde */
      }

      if (response.status === 401) {
        throw new Error("API anahtarı geçersiz. Lütfen Ayarlar'dan anahtarı kontrol edin.");
      }
      if (response.status === 402) {
        throw new Error("OpenRouter hesabında kredi yetersiz.");
      }
      if (response.status === 403) {
        throw new Error("OpenRouter bu modeli engelledi (403).");
      }

      if (!response.ok) {
        const reason = data?.error?.message || `HTTP ${response.status}`;
        const canFailover =
          retriableStatus(response.status) && candidate !== candidates[candidates.length - 1];

        if (canFailover) {
          console.warn(`[failover] ${candidate} -> ${reason}; yedek model deneniyor.`);
          lastError = new Error(`${candidate} yanıt vermedi (${reason}).`);
          continue;
        }

        throw new Error(reason || `OpenRouter hatası: ${response.status}`);
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        const reason = "Model boş yanıt döndürdü.";
        if (candidate !== candidates[candidates.length - 1]) {
          lastError = new Error(`${candidate}: ${reason}`);
          continue;
        }
        throw new Error(reason);
      }

      return content;
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error("İşlem kullanıcı tarafından durduruldu.");
      }

      // Ağ kopması / DNS / fetch hatası: bir sonraki modele geç.
      if (err instanceof TypeError && candidate !== candidates[candidates.length - 1]) {
        console.warn(`[failover] ${candidate} ağ hatası; yedek model deneniyor.`);
        lastError = err;
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("OpenRouter isteği başarısız oldu.");
}
