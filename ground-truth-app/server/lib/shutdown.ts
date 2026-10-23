// server/lib/shutdown.ts — graceful SIGTERM/SIGINT shutdown
//
// Databricks Apps sends SIGTERM to the outgoing deployment and kills it 15 s
// later ("App did not respect SIGTERM timeout of 15 seconds"). This module
// drains the process inside that budget:
//
//   1. mark the process as shutting down (new requests get 503 + Connection: close)
//   2. run `beforeHttp` steps (stop timers, close in-flight MCP transports)
//   3. close the HTTP server (idle keep-alive sockets first, force after 5 s)
//   4. run `afterHttp` steps (end the Lakebase pool)
//   5. exit 0 — or exit 1 if the 12 s hard deadline fires first
//
// Only info/warn lines are logged so a normal redeploy never trips the
// build-waves runtime gate.

import type { Server } from 'node:http';
import type { Socket } from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';

/** Platform budget between SIGTERM and SIGKILL. */
export const SHUTDOWN_BUDGET_MS = 15_000;
/** Hard deadline, leaving headroom under the platform budget. */
export const HARD_DEADLINE_MS = 12_000;
/** Max time to wait for in-flight HTTP requests before destroying sockets. */
export const HTTP_DRAIN_MS = 5_000;
/** Default per-step timeout. */
const STEP_TIMEOUT_MS = 3_000;

export type ShutdownPhase = 'beforeHttp' | 'afterHttp';

export interface ShutdownStep {
  name: string;
  phase?: ShutdownPhase;
  timeoutMs?: number;
  run: () => unknown;
}

type ExitFn = (code: number) => void;

let shuttingDown = false;
let httpServer: Server | null = null;
const sockets = new Set<Socket>();
const steps: ShutdownStep[] = [];

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function registerShutdownStep(step: ShutdownStep): void {
  steps.push(step);
}

function trackSocket(socket: Socket): void {
  if (sockets.has(socket)) return;
  sockets.add(socket);
  socket.once('close', () => {
    sockets.delete(socket);
  });
}

/** Adopt the HTTP server explicitly (tests, or when AppKit exposes it). */
export function setHttpServer(server: Server): void {
  if (httpServer === server) return;
  httpServer = server;
  server.on('connection', trackSocket);
}

/**
 * Register FIRST in the Express chain. It:
 * - captures the http.Server AppKit created (via `req.socket.server`),
 * - tracks keep-alive sockets so shutdown can close them,
 * - answers 503 with `Connection: close` once shutdown has started.
 */
export function shutdownMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const socket = req.socket as Socket & { server?: Server };
    if (!httpServer && socket.server) setHttpServer(socket.server);
    trackSocket(socket);

    if (shuttingDown) {
      res.setHeader('Connection', 'close');
      res.status(503).json({
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Server is shutting down.',
      });
      return;
    }
    next();
  };
}

async function runWithTimeout(name: string, work: () => unknown, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  try {
    await Promise.race([
      Promise.resolve().then(work),
      new Promise<never>((_resolve, reject) => {
        // Deliberately ref'd: an unref'd timer lets the event loop drain and the
        // process exit mid-sequence while a step is still pending.
        timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
    logger.info('Shutdown step complete', { step: name, durationMs: Date.now() - started });
  } catch (err) {
    logger.warn('Shutdown step failed', { step: name, error: (err as Error).message });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function closeHttpServer(): Promise<void> {
  const server = httpServer;
  if (!server || !server.listening) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const force = setTimeout(() => {
      logger.warn('HTTP drain timeout; destroying open sockets', { openSockets: sockets.size });
      server.closeAllConnections?.();
      for (const socket of sockets) socket.destroy();
      resolve();
    }, HTTP_DRAIN_MS);

    server.close(() => {
      clearTimeout(force);
      resolve();
    });
    // Keep-alive sockets with no in-flight request would otherwise hold close().
    server.closeIdleConnections?.();
  });
}

async function runPhase(phase: ShutdownPhase): Promise<void> {
  for (const step of steps) {
    if ((step.phase ?? 'afterHttp') !== phase) continue;
    await runWithTimeout(step.name, step.run, step.timeoutMs ?? STEP_TIMEOUT_MS);
  }
}

/** Run the shutdown sequence once. Exported for tests. */
export async function shutdown(signal: string, exit: ExitFn = (code) => process.exit(code)): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  const started = Date.now();
  logger.info('Shutdown started', { signal, openSockets: sockets.size, budgetMs: SHUTDOWN_BUDGET_MS });

  const hardDeadline = setTimeout(() => {
    logger.warn('Shutdown hard deadline reached; forcing exit', { signal, elapsedMs: Date.now() - started });
    exit(1);
  }, HARD_DEADLINE_MS);
  hardDeadline.unref?.();

  await runPhase('beforeHttp');
  await runWithTimeout('http-server', closeHttpServer, HTTP_DRAIN_MS + 1_000);
  await runPhase('afterHttp');

  clearTimeout(hardDeadline);
  logger.info('Shutdown complete', { signal, durationMs: Date.now() - started });
  exit(0);
}

/** Install SIGTERM/SIGINT handlers. Safe to call once at startup. */
export function installShutdownHandlers(exit?: ExitFn): void {
  const handler = (signal: NodeJS.Signals): void => {
    void shutdown(signal, exit);
  };
  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
}

/** Test-only: reset module state between test cases. */
export function resetShutdownStateForTests(): void {
  shuttingDown = false;
  httpServer = null;
  sockets.clear();
  steps.length = 0;
}
