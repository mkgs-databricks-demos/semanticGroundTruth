// server/lib/testing/routeHarness.ts — record and invoke route registrations without Express
// Session 33 · Wave 4-1 · test helper only (imported by *.test.ts) · No default export
//
// registerRoutes() only calls app.<method>(path, ...handlers), so a recording
// stand-in is enough to (a) compare every registration with ROUTE_CONTRACTS and
// (b) run a route's middleware chain against a fake req/res.

import type { Application, Request, RequestHandler, Response } from 'express';
import type { Services } from '../../services';
import type { UserContext } from '../context';
import { registerRoutes } from '../../routes';

export interface Registration {
  method: string;
  path: string;
  handlers: RequestHandler[];
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Run registerRoutes against a recorder and return every registration in order. */
export function recordRoutes(services: Services): Registration[] {
  const registrations: Registration[] = [];
  const app: Record<string, unknown> = {};
  for (const m of METHODS) {
    app[m] = (path: string, ...handlers: RequestHandler[]) => {
      registrations.push({ method: m.toUpperCase(), path, handlers });
      return app;
    };
  }
  app.use = () => app;
  registerRoutes(app as unknown as Application, services);
  return registrations;
}

export function findRoute(regs: Registration[], method: string, path: string): Registration {
  const reg = regs.find((r) => r.method === method && r.path === path);
  if (!reg) throw new Error(`route not registered: ${method} ${path}`);
  return reg;
}

export interface InvokeInput {
  user?: UserContext;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
}

export interface InvokeResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

/** Run the route's handlers in order (next() advances) until one responds. */
export async function invoke(reg: Registration, input: InvokeInput = {}): Promise<InvokeResult> {
  const req = {
    method: reg.method,
    path: reg.path,
    headers: {},
    body: input.body,
    query: input.query ?? {},
    params: input.params ?? {},
  } as unknown as Request;

  const headers: Record<string, string> = {};
  let status = 200;
  let body: unknown;
  let ended = false;
  let onEnd: () => void = () => {};

  const res = {
    req,
    locals: input.user ? { user: input.user } : {},
    status(code: number) {
      status = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      ended = true;
      onEnd();
      return res;
    },
    send(payload: unknown) {
      return res.json(payload);
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = String(value);
      return res;
    },
  } as unknown as Response;

  for (const handler of reg.handlers) {
    const outcome = await new Promise<'next' | 'end'>((resolve, reject) => {
      onEnd = () => resolve('end');
      try {
        void handler(req, res, (err?: unknown) => (err ? reject(err) : resolve('next')));
      } catch (err) {
        reject(err);
      }
    });
    if (outcome === 'end' || ended) break;
  }
  return { status, body, headers };
}

export function makeUser(roles: UserContext['roles'], overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: `user-${roles[roles.length - 1] ?? 'none'}`,
    email: `${roles[roles.length - 1] ?? 'none'}@example.com`,
    displayName: 'Test User',
    source: 'web',
    roles,
    ...overrides,
  };
}
