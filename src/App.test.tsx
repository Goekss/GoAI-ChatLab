import { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { sendenChatMessage } from './aiService/aiService';

// ESM-only kütüphaneler Jest tarafından transform edilemediği için mock'lanıyor.
jest.mock('react-markdown', () => {
  const React = require('react');
  return function MarkdownMock({ children }: { children?: ReactNode }) {
    return React.createElement('div', null, children);
  };
});

jest.mock('rehype-highlight', () => function noop() {});

jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => { throw new Error('PDF not used in tests'); },
}));

// Türkçe: Gerçek API çağrısı yapmamak için AI servisini mock'luyoruz.
// Deutsch: Wir mocken den AI-Service, damit kein echter API-Aufruf stattfindet.
jest.mock('./aiService/aiService', () => ({
  AUTO_MODEL: 'auto',
  DEFAULT_MODEL: 'auto',
  MODEL_OPTIONS: [{ id: 'auto', label: 'Otomatik (Auto)' }],
  sendenChatMessage: jest.fn(),
}));

// jsdom, Element.scrollTo implement etmediği için test ortamında polyfill'leniyor.
beforeAll(() => {
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = jest.fn();
  }
});

// Türkçe: CRA mock'ları testler arasında sıfırladığı için (resetMocks) yanıtı her testten önce ayarlıyoruz.
// Deutsch: CRA setzt Mocks zurück (resetMocks), daher konfigurieren wir die Antwort vor jedem Test.
beforeEach(() => {
  (sendenChatMessage as jest.Mock).mockResolvedValue('test cevabı');
});

test('renders the app with Start Chat button', () => {
  render(<App />);
  expect(screen.getByText(/Start Chat/i)).toBeInTheDocument();
});

// Türkçe: Mesaj gönderilince AI servisi çağrılır ve yanıt gösterilir.
// Deutsch: Beim Senden wird der AI-Service aufgerufen und die Antwort angezeigt.
test('sends a message and shows the assistant reply', async () => {
  render(<App />);

  const textarea = screen.getByPlaceholderText('Schreiben Sie etwas ...');
  fireEvent.change(textarea, { target: { value: 'merhaba' } });

  const sendBtn = document.querySelector('.sendBtn') as HTMLButtonElement;
  fireEvent.click(sendBtn);

  expect(await screen.findByText('test cevabı')).toBeInTheDocument();
  expect(sendenChatMessage).toHaveBeenCalled();
});

// Türkçe: "Start Chat" mevcut sohbeti geçmişe kaydedip yeni sohbet açar.
// Deutsch: "Start Chat" speichert den Chat und öffnet einen neuen.
test('creates a new chat and keeps the old one in history', async () => {
  render(<App />);

  const textarea = screen.getByPlaceholderText('Schreiben Sie etwas ...');
  fireEvent.change(textarea, { target: { value: 'merhaba' } });
  fireEvent.click(document.querySelector('.sendBtn') as HTMLButtonElement);

  await screen.findByText('test cevabı');

  fireEvent.click(screen.getByText(/Start Chat/i));

  // Eski sohbet "merhaba" başlığıyla geçmişte görünür.
  // Der alte Chat erscheint mit dem Titel "merhaba" im Verlauf.
  expect(await screen.findByText('merhaba')).toBeInTheDocument();
});
