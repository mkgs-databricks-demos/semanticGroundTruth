// server/routes/health.test.ts — the contract /health route must not be shadowed by AppKit's
// Session 40 · Wave 4-8
//
// AppKit's server plugin registers GET /health ({ status: 'ok' }) before
// appkit.server.extend() callbacks run. Express answers with the first match,
// so the live app served AppKit's body and the contract fields were missing.

import type { Application } from 'express';
import { describe, expect, it } from 'vitest';
import { removeEarlierHealthRoutes } from './health';

interface Layer {
  name: string;
  route?: { path: string; methods: Record<string, boolean> };
}

function fakeApp(stack: Layer[]): Application {
  return { _router: { stack } } as unknown as Application;
}

describe('removeEarlierHealthRoutes', () => {
  it('removes an earlier GET /health route and keeps every other layer in order', () => {
    const stack: Layer[] = [
      { name: 'jsonParser' },
      { name: 'bound dispatch', route: { path: '/health', methods: { get: true } } },
      { name: 'router' },
      { name: 'bound dispatch', route: { path: '/api/me', methods: { get: true } } },
      { name: 'bound dispatch', route: { path: '/health', methods: { post: true } } },
    ];
    expect(removeEarlierHealthRoutes(fakeApp(stack))).toBe(1);
    expect(stack.map((l) => `${l.name}:${l.route?.path ?? ''}`)).toEqual([
      'jsonParser:', 'router:', 'bound dispatch:/api/me', 'bound dispatch:/health',
    ]);
  });

  it('is a no-op when the router is not initialised yet', () => {
    expect(removeEarlierHealthRoutes({} as Application)).toBe(0);
  });
});
