import { render, screen } from '@testing-library/react';
import App from './App';

// ESM-only kütüphaneler Jest tarafından transform edilemediği için mock'lanıyor.
jest.mock('react-markdown', () => {
  const React = require('react');
  return function MarkdownMock({ children }) {
    return React.createElement('div', null, children);
  };
});

jest.mock('rehype-highlight', () => function noop() {});

jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => { throw new Error('PDF not used in tests'); },
}));

// jsdom, Element.scrollTo implement etmediği için test ortamında polyfill'leniyor.
beforeAll(() => {
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = jest.fn();
  }
});

test('renders the app with Start Chat button', () => {
  render(<App />);
  expect(screen.getByText(/Start Chat/i)).toBeInTheDocument();
});
