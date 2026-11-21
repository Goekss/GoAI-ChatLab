// ============================================================================
// ChatBox.test.tsx
// Diese Tests prüfen, ob ChatBox Nachrichten, Dateien und Animationen anzeigt.
// Bu testler ChatBox'ın mesajları, dosyaları ve animasyonu gösterdiğini kontrol eder.
// ============================================================================

import React, { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import ChatBox from "./ChatBox";
import { ChatMessage } from "../../types";

// react-markdown ESM olduğu için Jest'te mock'luyoruz.
// react-markdown ist ESM, daher mocken wir es in Jest.
jest.mock("react-markdown", () => {
  const React = require("react");
  return function MarkdownMock({ children }: { children?: ReactNode }) {
    return React.createElement("div", null, children);
  };
});

jest.mock("rehype-highlight", () => function noop() {});

// Boş bir ref; bileşen sadece <div> üzerine bağlar.
// Ein leerer Ref; die Komponente bindet ihn nur an das <div>.
const emptyRef: React.RefObject<HTMLDivElement | null> = { current: null };

describe("ChatBox - Component Tests", () => {
  // Türkçe: Kullanıcı mesajı düz metin olarak gösterilir.
  // Deutsch: User-Nachricht wird als Klartext angezeigt.
  test("zeigt User-Nachricht an / kullanıcı mesajını gösterir", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "merhaba" }];

    render(<ChatBox messages={messages} chatRef={emptyRef} />);

    expect(screen.getByText("merhaba")).toBeInTheDocument();
  });

  // Türkçe: Asistan mesajı markdown olarak gösterilir (mock).
  // Deutsch: Assistenten-Nachricht wird als Markdown angezeigt (Mock).
  test("zeigt Assistenten-Markdown an / asistan markdown'ını gösterir", () => {
    const messages: ChatMessage[] = [{ role: "assistant", content: "**kalın**" }];

    render(<ChatBox messages={messages} chatRef={emptyRef} />);

    expect(screen.getByText("**kalın**")).toBeInTheDocument();
  });

  // Türkçe: Asistan içeriği boşken "thinking" animasyonu görünür.
  // Deutsch: Bei leerem Assistenten-Inhalt erscheint die Thinking-Animation.
  test("zeigt Thinking-Animation bei leerer Antwort / boş yanıtta thinking animasyonu gösterir", () => {
    const messages: ChatMessage[] = [{ role: "assistant", content: "" }];

    const { container } = render(<ChatBox messages={messages} chatRef={emptyRef} />);

    expect(container.querySelector(".thinking")).toBeInTheDocument();
  });

  // Türkçe: Ekli dosyalar chip olarak listelenir.
  // Deutsch: Angehängte Dateien werden als Chips aufgelistet.
  test("zeigt Datei-Chips an / dosya chip'lerini gösterir", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: "dosya",
        files: [{ name: "belge.pdf", type: "application/pdf", url: "" }],
      },
    ];

    render(<ChatBox messages={messages} chatRef={emptyRef} />);

    expect(screen.getByText("belge.pdf")).toBeInTheDocument();
  });
});
