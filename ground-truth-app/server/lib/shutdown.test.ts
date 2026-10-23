// server/lib/shutdown.test.ts — graceful shutdown sequence

import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isShuttingDown,
  registerShutdownStep,
  resetShutdownStateForTests,
  setHttpServer,
  shutdown,
} from './shutdown';

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function get(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/', agent: false }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode ?? 0));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('shutdown', () => {
  afterEach(() => {
    resetShutdownStateForTests();
  });

  it('runs beforeHttp steps, closes the server, runs afterHttp steps, then exits 0', async () => {
    const order: string[] = [];
    const server = createServer((_req, res) => res.end('ok'));
    const port = await listen(server);
    setHttpServer(server);
    expect(await get(port)).toBe(200);

    registerShutdownStep({ name: 'pool', phase: 'afterHttp', run: () => order.push('pool') });
    registerShutdownStep({ name: 'mcp', phase: 'beforeHttp', run: () => order.push('mcp') });
    server.on('close', () => order.push('http'));

    const codes: number[] = [];
    await shutdown('SIGTERM', (code) => codes.push(code));

    expect(order).toEqual(['mcp', 'http', 'pool']);
    expect(codes).toEqual([0]);
    expect(server.listening).toBe(false);
    expect(isShuttingDown()).toBe(true);
  });

  it('is idempotent: a second signal does not run steps again', async () => {
    let runs = 0;
    registerShutdownStep({ name: 'count', run: () => { runs += 1; } });
    const codes: number[] = [];
    await shutdown('SIGTERM', (code) => codes.push(code));
    await shutdown('SIGINT', (code) => codes.push(code));
    expect(runs).toBe(1);
    expect(codes).toEqual([0]);
  });

  it('continues when a step throws or times out', async () => {
    const order: string[] = [];
    registerShutdownStep({ name: 'boom', run: () => { throw new Error('boom'); } });
    registerShutdownStep({ name: 'slow', timeoutMs: 20, run: () => new Promise(() => undefined) });
    registerShutdownStep({ name: 'last', run: () => order.push('last') });
    const codes: number[] = [];
    await shutdown('SIGTERM', (code) => codes.push(code));
    expect(order).toEqual(['last']);
    expect(codes).toEqual([0]);
  });
});
