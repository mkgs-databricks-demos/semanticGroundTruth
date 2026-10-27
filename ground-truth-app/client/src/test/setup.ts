// client/src/test/setup.ts — jsdom setup for client component tests
// Session 26 · Build 4 · wave 4-0. Loaded by the `client` vitest project only.
//
// * jest-dom matchers (toBeInTheDocument, toHaveTextContent, ...)
// * axe matcher (toHaveNoViolations) from vitest-axe
// * stubs for browser APIs jsdom does not implement (matchMedia, ResizeObserver)
// * unmount rendered trees after each test

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

afterEach(() => {
  cleanup();
});

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof globalThis.ResizeObserver !== 'function') {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}
