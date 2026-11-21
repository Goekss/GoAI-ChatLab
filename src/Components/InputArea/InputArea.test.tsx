// ============================================================================
// InputArea.test.tsx
// Diese Tests prüfen den Senden-Button und die Datei-Chips der Eingabe.
// Bu testler giriş alanının gönder butonunu ve dosya chip'lerini kontrol eder.
// ============================================================================

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InputArea from "./InputArea";

const noop = () => {};

// Testlerde gerçek File yerine basit sahte nesne kullanıyoruz.
// Statt echtem File nutzen wir ein einfaches Fake-Objekt.
function fakeFile(name: string, type: string): File {
  return { name, type } as unknown as File;
}

type InputAreaProps = React.ComponentProps<typeof InputArea>;

function renderInputArea(overrides: Partial<InputAreaProps> = {}) {
  const props: InputAreaProps = {
    input: "",
    setInput: jest.fn(),
    onSend: jest.fn(),
    onKeyDown: jest.fn(),
    canSend: false,
    stop: jest.fn(),
    isSending: false,
    onFilesSelected: jest.fn(),
    selectedFiles: [],
    onRemoveFile: jest.fn(),
    ...overrides,
  };

  return render(<InputArea {...props} />);
}

describe("InputArea - Component Tests", () => {
  // Türkçe: Metin yokken gönder butonu devre dışıdır.
  // Deutsch: Ohne Text ist der Senden-Button deaktiviert.
  test("deaktiviert Senden ohne Text / metin yokken gönder butonu kapalıdır", () => {
    const { container } = renderInputArea({ canSend: false, isSending: false });

    const btn = container.querySelector(".sendBtn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  // Türkçe: Metin varken gönder butonu aktifleşir.
  // Deutsch: Mit Text wird der Senden-Button aktiviert.
  test("aktiviert Senden mit Text / metin varken gönder butonu aktiftir", () => {
    const { container } = renderInputArea({ canSend: true, isSending: false });

    const btn = container.querySelector(".sendBtn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  // Türkçe: Seçilen dosyalar chip olarak gösterilir ve kaldırılabilir.
  // Deutsch: Ausgewählte Dateien werden als Chips angezeigt und können entfernt werden.
  test("zeigt Datei-Chips und ruft Entfernen auf / dosya chip'lerini gösterir ve kaldırır", () => {
    const onRemoveFile = jest.fn();
    renderInputArea({
      selectedFiles: [fakeFile("belge.pdf", "application/pdf")],
      onRemoveFile,
    });

    expect(screen.getByText("belge.pdf")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();

    fireEvent.click(screen.getByText("×"));
    expect(onRemoveFile).toHaveBeenCalledWith(0);
  });

  // Türkçe: Textarea, input değerini yansıtır (controlled).
  // Deutsch: Textarea spiegelt den Input-Wert wider (controlled).
  test("spiegelt den Input-Wert wider / input değerini yansıtır", () => {
    renderInputArea({ input: "selam dünya" });

    const textarea = screen.getByPlaceholderText("Schreiben Sie etwas ...") as HTMLTextAreaElement;
    expect(textarea.value).toBe("selam dünya");
  });
});
