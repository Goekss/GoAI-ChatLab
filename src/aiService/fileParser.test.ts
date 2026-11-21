// ============================================================================
// fileParser.test.ts
// Diese Tests prüfen die Datei-zu-Text Konvertierung (PDF/Excel/Word/Routing).
// Bu testler dosyadan metne dönüşümü doğrular (PDF/Excel/Word/yönlendirme).
// ============================================================================

// Ağır kütüphaneleri mock'luyoruz; gerçek PDF/Excel/Word motoruna ihtiyacımız yok.
// Wir mocken die schweren Bibliotheken; die echten Engines brauchen wir nicht.
jest.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  version: "5.0.0",
  getDocument: jest.fn(),
}));

jest.mock("xlsx", () => ({
  read: jest.fn(),
  utils: {
    sheet_to_csv: jest.fn(),
  },
}));

jest.mock("mammoth", () => ({
  extractRawText: jest.fn(),
}));

import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { parseFile, extractPdfText, extractExcelText, extractWordText } from "./fileParser";

// Türkçe: CRA, testler arasında mock'ları sıfırladığı için (resetMocks) davranışları
// her testten ÖNCE burada belirliyoruz.
// Deutsch: CRA setzt Mocks zwischen Tests zurück (resetMocks), daher legen wir das
// Verhalten hier VOR jedem Test fest.
beforeEach(() => {
  (pdfjsLib.getDocument as jest.Mock).mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: jest.fn(() =>
        Promise.resolve({
          getTextContent: jest.fn(() =>
            Promise.resolve({ items: [{ str: "Merhaba" }, { str: "Dünya" }] })
          ),
        })
      ),
    }),
  });

  (XLSX.read as jest.Mock).mockReturnValue({ SheetNames: ["Sayfa1"], Sheets: { Sayfa1: {} } });
  (XLSX.utils.sheet_to_csv as jest.Mock).mockReturnValue("a,b\n1,2");
  (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: "word içeriği" });
});

// Testlerde gerçek File nesnesi yerine basit sahte bir nesne kullanıyoruz.
// Statt echtes File nutzen wir ein einfaches Fake-Objekt.
function fakeFile(name: string, type: string): File {
  return {
    name,
    type,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  } as unknown as File;
}

describe("fileParser - Unit Tests", () => {
  // --------------------------------------------------------------------------
  // parseFile (Yönlendirme / Routing)
  // --------------------------------------------------------------------------
  describe("parseFile", () => {
    // Türkçe: PDF dosyası PDF parser'ına yönlendirilir ve metin döner.
    // Deutsch: PDF-Dateien werden an den PDF-Parser geleitet.
    test("leitet PDF an den PDF-Parser / PDF'i PDF parser'ına yönlendirir", async () => {
      const text = await parseFile(fakeFile("dosya.pdf", "application/pdf"));
      expect(text).toContain("Merhaba Dünya");
    });

    // Türkçe: CSV/Excel dosyası Excel parser'ına yönlendirilir.
    // Deutsch: CSV/Excel wird an den Excel-Parser geleitet.
    test("leitet CSV an den Excel-Parser / CSV'yi Excel parser'ına yönlendirir", async () => {
      const text = await parseFile(fakeFile("veri.csv", "text/csv"));
      expect(text).toContain("Sayfa1");
      expect(text).toContain("a,b");
    });

    // Türkçe: Word (.docx) dosyası Word parser'ına yönlendirilir.
    // Deutsch: Word (.docx) wird an den Word-Parser geleitet.
    test("leitet DOCX an den Word-Parser / DOCX'i Word parser'ına yönlendirir", async () => {
      const text = await parseFile(
        fakeFile("belge.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      );
      expect(text).toBe("word içeriği");
    });

    // Türkçe: Resim dosyaları için null döner (görselleri AI kendisi okur).
    // Deutsch: Bilddateien liefern null zurück (KI liest Bilder selbst).
    test("liefert null für Bilder / resimler için null döner", async () => {
      const result = await parseFile(fakeFile("foto.png", "image/png"));
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // extractPdfText
  // --------------------------------------------------------------------------
  describe("extractPdfText", () => {
    // Türkçe: PDF sayfalarındaki metinler birleştirilir.
    // Deutsch: Text aus PDF-Seiten wird zusammengefügt.
    test("fügt PDF-Seitentext zusammen / PDF sayfa metinlerini birleştirir", async () => {
      const text = await extractPdfText(fakeFile("a.pdf", "application/pdf"));
      expect(text).toContain("Merhaba Dünya");
      expect(pdfjsLib.getDocument).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // extractExcelText
  // --------------------------------------------------------------------------
  describe("extractExcelText", () => {
    // Türkçe: Excel sayfası CSV benzeri metne çevrilir.
    // Deutsch: Excel-Tabelle wird in CSV-ähnlichen Text umgewandelt.
    test("wandelt Excel in CSV-ähnlichen Text / Excel'i CSV benzeri metne çevirir", async () => {
      const text = await extractExcelText(fakeFile("a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
      expect(text).toContain("--- Sayfa: Sayfa1 ---");
      expect(XLSX.read).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // extractWordText
  // --------------------------------------------------------------------------
  describe("extractWordText", () => {
    // Türkçe: Word dosyasının ham metni döner.
    // Deutsch: Rohtext des Word-Dokuments wird zurückgegeben.
    test("liefert Word-Rohtext / Word ham metnini döner", async () => {
      const text = await extractWordText(fakeFile("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
      expect(text).toBe("word içeriği");
      expect(mammoth.extractRawText).toHaveBeenCalled();
    });
  });
});
