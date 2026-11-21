// ============================================================================
// aiService.test.ts
// Diese Tests prüfen die Kernlogik des AI-Dienstes (Nachrichtenaufbau, Fallback).
// Bu testler AI servisinin çekirdek mantığını doğrular (mesaj kurma, yedek model).
// ============================================================================

// Türkçe: Sadece tip bilgisini alıyoruz; modül yüklenmez (require ile yüklenir).
// Deutsch: Wir importieren nur Typen; das Modul wird per require geladen.
import type * as AiService from "./aiService";
import type { MessageBlock } from "../types";

describe("aiService - Unit Tests", () => {
  // Modul wird in jedem Test NEU geladen, damit wir die Proxy-URL setzen können.
  // Modül her testte YENİDEN yüklenir ki proxy URL'sini ayarlayabilelim.
  let aiService: typeof AiService;

  beforeEach(() => {
    jest.resetModules();
    process.env.REACT_APP_OPENROUTER_PROXY_URL = "http://test-proxy";
    aiService = require("./aiService");
  });

  // --------------------------------------------------------------------------
  // buildMessages
  // --------------------------------------------------------------------------
  describe("buildMessages", () => {
    // Türkçe: System prompt verilirse ilk mesaj olarak eklenir.
    // Deutsch: System-Prompt wird als erste Nachricht hinzugefügt.
    test("fügt den System-Prompt als erste Nachricht hinzu / system prompt'u ilk mesaj olarak ekler", () => {
      const result = aiService.buildMessages({
        systemPrompt: "Kısa cevap ver",
        messages: [],
      });

      expect(result[0]).toEqual({ role: "system", content: "Kısa cevap ver" });
    });

    // Türkçe: Sadece user ve assistant rolleri geçer; diğerleri elenir.
    // Deutsch: Nur user/assistant Rollen werden übernommen.
    test("filtert unbekannte Rollen heraus / sadece user ve assistant rollerini geçirir", () => {
      const result = aiService.buildMessages({
        messages: [
          { role: "user", content: "merhaba" },
          { role: "assistant", content: "selam" },
          { role: "system", content: "gizli" },
          { role: "", content: "boş" },
        ],
      });

      expect(result).toEqual([
        { role: "user", content: "merhaba" },
        { role: "assistant", content: "selam" },
      ]);
    });

    // Türkçe: userText string ise user rolünde eklenir.
    // Deutsch: userText wird als user-Rolle angehängt.
    test("hängt string userText als user an / string userText'i user olarak ekler", () => {
      const result = aiService.buildMessages({ userText: "naber" });

      expect(result[result.length - 1]).toEqual({ role: "user", content: "naber" });
    });

    // Türkçe: userText dizi (görsel blokları) ise olduğu gibi aktarılır.
    // Deutsch: Array userText (Bildblöcke) bleibt unverändert.
    test("lässt Array userText unverändert / dizi userText'i olduğu gibi bırakır", () => {
      const blocks: MessageBlock[] = [{ type: "image_url", image_url: { url: "data:..." } }];
      const result = aiService.buildMessages({ userText: blocks });

      expect(result[result.length - 1]).toEqual({ role: "user", content: blocks });
    });
  });

  // --------------------------------------------------------------------------
  // hasImageBlocks
  // --------------------------------------------------------------------------
  describe("hasImageBlocks", () => {
    // Türkçe: image_url bloğu varsa true döner.
    // Deutsch: true, wenn ein image_url-Block existiert.
    test("erkennt image_url Blöcke / image_url bloğunu tespit eder", () => {
      const yes = aiService.hasImageBlocks([
        { type: "text", text: "bak" },
        { type: "image_url", image_url: { url: "x" } },
      ]);
      expect(yes).toBe(true);
    });

    // Türkçe: Sadece metin varsa false döner.
    // Deutsch: false bei reinen Textblöcken.
    test("liefert false bei Textblöcken / sadece metin varsa false döner", () => {
      expect(aiService.hasImageBlocks([{ type: "text", text: "x" }])).toBe(false);
      expect(aiService.hasImageBlocks("metin")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // retriableStatus
  // --------------------------------------------------------------------------
  describe("retriableStatus", () => {
    // Türkçe: 429/5xx durumları yeniden denenebilir.
    // Deutsch: 429/5xx gelten als wiederholbar.
    test("gilt für 429 und 5xx als wiederholbar / 429 ve 5xx tekrar denenebilir", () => {
      expect(aiService.retriableStatus(429)).toBe(true);
      expect(aiService.retriableStatus(500)).toBe(true);
      expect(aiService.retriableStatus(503)).toBe(true);
    });

    // Türkçe: 400/401 yeniden denenmez.
    // Deutsch: 400/401 werden nicht wiederholt.
    test("gilt für 400/401 nicht als wiederholbar / 400 ve 401 tekrar denenmez", () => {
      expect(aiService.retriableStatus(400)).toBe(false);
      expect(aiService.retriableStatus(401)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // sendenChatMessage
  // --------------------------------------------------------------------------
  describe("sendenChatMessage", () => {
    // Türkçe: Başarılı yanıtta model içeriği geri döner.
    // Deutsch: Bei Erfolg wird der Modell-Inhalt zurückgegeben.
    test("gibt Inhalt bei Erfolg zurück / başarıda içeriği döndürür", async () => {
      (global.fetch as unknown as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "merhaba" } }] }),
        });

      const content = await aiService.sendenChatMessage({
        model: "auto",
        userText: "selam",
      });

      expect(content).toBe("merhaba");
    });

    // Türkçe: 429 alırsa yedek modele geçer ve yanıtı döner.
    // Deutsch: Bei 429 wird auf das Fallback-Modell gewechselt.
    test("wechselt bei 429 zum Fallback / 429'da yedek modele geçer", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: "rate limited" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "yedekten" } }] }),
        });

      (global.fetch as unknown as jest.Mock) = fetchMock;

      const content = await aiService.sendenChatMessage({
        model: "auto",
        userText: "selam",
      });

      expect(content).toBe("yedekten");
      // Türkçe: fetch en az 2 kez çağrıldı (ilk deneme + yedek).
      // Deutsch: fetch wurde mindestens 2x aufgerufen.
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    // Türkçe: 401 alırsa "geçersiz anahtar" hatası fırlatır.
    // Deutsch: Bei 401 wird ein Fehler "geçersiz" geworfen.
    test("wirft bei 401 einen Fehler / 401'de hata fırlatır", async () => {
      (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      await expect(
        aiService.sendenChatMessage({ model: "auto", userText: "selam" })
      ).rejects.toThrow("geçersiz");
    });

    // Türkçe: 402 alırsa "kredi yetersiz" hatası fırlatır.
    // Deutsch: Bei 402 wird ein Fehler "kredi" geworfen.
    test("wirft bei 402 einen Fehler / 402'de hata fırlatır", async () => {
      (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => ({}),
      });

      await expect(
        aiService.sendenChatMessage({ model: "auto", userText: "selam" })
      ).rejects.toThrow("kredi");
    });

    // Türkçe: İstek iptal edilirse (AbortError) "durduruldu" hatası fırlatır.
    // Deutsch: Bei AbortError wird ein "durduruldu" Fehler geworfen.
    test("wirft bei AbortError einen Fehler / AbortError'da hata fırlatır", async () => {
      const abortErr = new Error("aborted");
      abortErr.name = "AbortError";

      (global.fetch as unknown as jest.Mock) = jest
        .fn()
        .mockRejectedValueOnce(abortErr);

      await expect(
        aiService.sendenChatMessage({ model: "auto", userText: "selam" })
      ).rejects.toThrow("durduruldu");
    });
  });
});
