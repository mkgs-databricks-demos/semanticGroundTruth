// client/src/test/mockApi.ts — schema-checked fetch mock keyed by ROUTE_CONTRACTS
// Session 43 · Build 5 · wave 5-0 (ui_test_strategy.md §5)
//
// Goal: fixtures cannot drift from the API, and a screen cannot call a route
// nobody mocked.
//
//   const api = mockApi({
//     'GET /api/me': fixtures.me,
//     'GET /api/review/next': fixtures.reviewCard,
//     'POST /api/review/skip': fixtures.skipResponse,
//     'POST /api/review/vote': (req) => ({ ...fixtures.voteResult, vote: { ...fixtures.vote, voteType: (req.body as VoteBody).voteType } }),
//   });
//   mockApi.error('GET /api/review/next', 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting');
//   mockApi.forbidden('GET /api/steward/feedback-queue');
//   mockApi.pending('GET /api/me');      // never resolves (loading state)
//   mockApi.offline();                   // fetch rejects TypeError('Failed to fetch'), navigator.onLine = false
//   expect(api.calls('POST /api/review/skip')[0].body).toEqual({ assetId: ... });
//
// Rules (all throw or fail the test):
//   * Keys are the exact `METHOD /path` strings of ROUTE_CONTRACTS
//     (shared/contracts/schemas.ts); an unknown key throws at registration.
//   * Every fixture is parsed with the route's `response` schema when it is
//     registered; every function handler's return value when it is called.
//     Error replies are parsed with ErrorResponseSchema.
//   * Every request is parsed with the route's `request` / `query` / `params`
//     schemas the way the server's validate middleware does. A body or query
//     string sent to a route that declares none is a failure too.
//   * A request to a route with no contract, or with no handler, fails.
//   Request failures reject the fetch AND are recorded as problems; an
//   afterEach hook fails the test if any problem was not taken with
//   `api.takeProblems()` (React Query would otherwise swallow the rejection).
//
// One mock is active per test. Calling mockApi() again in the same test adds
// handlers to it (renderWithProviders relies on this for GET /api/me). The
// real fetch is restored after every test.

import { afterEach, vi } from 'vitest';
import type { ErrorCode } from '../../../shared/contracts/errors';
import { ErrorResponseSchema, ROUTE_CONTRACTS, routeKey } from '../../../shared/contracts/schemas';
import type { RouteContract } from '../../../shared/contracts/schemas';
import { setOnline } from './online';

// ── Types ────────────────────────────────────────────────────────────────────────

/** A request the component sent, as the mock saw it. */
export interface MockRequest {
  /** Contract key, e.g. "POST /api/review/skip". */
  key: string;
  method: string;
  /** Path without query string, e.g. /api/assets/0000… */
  path: string;
  url: string;
  params: Record<string, string>;
  query: Record<string, string>;
  /** Parsed JSON body (undefined when none was sent). */
  body: unknown;
}

const REPLY = Symbol('mockApi.reply');

/** A non-fixture reply: an error envelope, a request that never settles, or a network failure. */
export interface MockReply {
  readonly [REPLY]: true;
  readonly kind: 'json' | 'pending' | 'network';
  readonly status?: number;
  readonly body?: unknown;
}

/** A fixture value, a MockReply, or a function of the request returning either. */
export type MockHandler = unknown;
export type MockHandlers = Record<string, MockHandler>;

// ── Contracts ─────────────────────────────────────────────────────────────────────

interface CompiledRoute {
  contract: RouteContract;
  key: string;
  pattern: RegExp;
  paramNames: string[];
}

const CONTRACTS = new Map<string, RouteContract>(ROUTE_CONTRACTS.map((c) => [routeKey(c), c]));

// Static paths before parameterised ones, so /api/notifications/unread-count
// never matches a /:param route of the same shape.
const COMPILED: CompiledRoute[] = ROUTE_CONTRACTS.map((contract) => {
  const paramNames: string[] = [];
  const source = contract.path
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        paramNames.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { contract, key: routeKey(contract), pattern: new RegExp(`^${source}$`), paramNames };
}).sort((a, b) => a.paramNames.length - b.paramNames.length);

/** The contract for a key, or throw naming the key. */
export function contractFor(key: string): RouteContract {
  const c = CONTRACTS.get(key);
  if (!c) {
    throw new Error(
      `mockApi: unknown route "${key}". Keys are the "METHOD /path" strings of ROUTE_CONTRACTS (shared/contracts/schemas.ts).`,
    );
  }
  return c;
}

function issues(error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }): string {
  return error.issues
    .map((i) => `  ${i.path.length ? i.path.map(String).join('.') : '(root)'}: ${i.message}`)
    .join('\n');
}

/** Parse `value` with the response schema of `key`; throw with the zod issues if it does not match. */
export function validateFixture(key: string, value: unknown): void {
  const result = contractFor(key).response.safeParse(value);
  if (!result.success) {
    throw new Error(`mockApi: fixture for ${key} does not match its response schema:\n${issues(result.error)}`);
  }
}

function isReply(value: unknown): value is MockReply {
  return typeof value === 'object' && value !== null && REPLY in value;
}

/** Standard error envelope reply (validated against ErrorResponseSchema). */
export function errorReply(
  status: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): MockReply {
  const body = { error: { code, message, ...(details ? { details } : {}) } };
  const parsed = ErrorResponseSchema.safeParse(body);
  if (!parsed.success) throw new Error(`mockApi: invalid error envelope:\n${issues(parsed.error)}`);
  if (status < 400 || status > 599) throw new Error(`mockApi: error status must be 4xx/5xx, got ${status}`);
  return { [REPLY]: true, kind: 'json', status, body };
}

/** A reply that never settles (the loading state). Rejects only if the request is aborted. */
export const PENDING_REPLY: MockReply = { [REPLY]: true, kind: 'pending' };
/** A reply that rejects like a dropped connection, without changing navigator.onLine. */
export const NETWORK_ERROR_REPLY: MockReply = { [REPLY]: true, kind: 'network' };

// ── The mock ───────────────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body ?? null), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export class MockApi {
  readonly handlers = new Map<string, MockHandler>();
  readonly log: MockRequest[] = [];
  readonly problems: string[] = [];
  isOffline = false;
  readonly originalFetch: typeof fetch;

  constructor() {
    this.originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', this.fetch);
  }

  /** Register (or replace) handlers. Fixtures are validated now. */
  use(handlers: MockHandlers): this {
    for (const [key, handler] of Object.entries(handlers)) {
      contractFor(key);
      if (typeof handler !== 'function' && !isReply(handler)) validateFixture(key, handler);
      this.handlers.set(key, handler);
    }
    return this;
  }

  /** Reply to `key` with the standard error envelope. */
  error(key: string, status: number, code: ErrorCode, message: string, details?: Record<string, unknown>): this {
    return this.use({ [key]: errorReply(status, code, message, details) });
  }

  /** Reply to `key` with 403 FORBIDDEN. */
  forbidden(key: string, message = 'You do not have access to this page'): this {
    return this.error(key, 403, 'FORBIDDEN', message);
  }

  /** `key` never resolves (loading state). */
  pending(key: string): this {
    return this.use({ [key]: PENDING_REPLY });
  }

  /** Every fetch rejects with TypeError('Failed to fetch'); navigator.onLine = false. */
  offline(): this {
    this.isOffline = true;
    setOnline(false);
    return this;
  }

  /** Undo offline(). */
  online(): this {
    this.isOffline = false;
    setOnline(true);
    return this;
  }

  /** Requests sent, optionally only those for one contract key. Includes rejected ones. */
  calls(key?: string): MockRequest[] {
    if (key !== undefined) contractFor(key);
    return key === undefined ? [...this.log] : this.log.filter((r) => r.key === key);
  }

  /** Return and clear the recorded problems (meta-tests that expect a failure). */
  takeProblems(): string[] {
    return this.problems.splice(0, this.problems.length);
  }

  /** Restore the real fetch. */
  dispose(): void {
    globalThis.fetch = this.originalFetch;
  }

  private fail(message: string): never {
    this.problems.push(message);
    throw new Error(message);
  }

  /** The fetch stub (arrow function so `this` survives vi.stubGlobal). */
  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: string;
    let method: string;
    let rawBody: unknown;
    if (typeof input === 'object' && 'url' in input && !(input instanceof URL)) {
      url = input.url;
      method = (init?.method ?? input.method ?? 'GET').toUpperCase();
      rawBody = init?.body ?? (method === 'GET' ? undefined : await input.clone().text());
    } else {
      url = String(input);
      method = (init?.method ?? 'GET').toUpperCase();
      rawBody = init?.body;
    }
    const u = new URL(url, 'http://localhost');
    const path = u.pathname;
    const query = Object.fromEntries(u.searchParams.entries());
    const label = `${method} ${path}${u.search}`;

    const route = COMPILED.find((r) => r.contract.method === method && r.pattern.test(path));
    if (!route) this.fail(`mockApi: unhandled request ${label}: no ROUTE_CONTRACTS entry matches`);
    const { contract, key } = route;
    const groups = route.pattern.exec(path)!.slice(1);
    const params = Object.fromEntries(route.paramNames.map((n, i) => [n, decodeURIComponent(groups[i])]));

    let body: unknown = undefined;
    if (rawBody !== undefined && rawBody !== null && rawBody !== '') {
      if (typeof rawBody !== 'string') this.fail(`mockApi: ${label} sent a non-JSON body`);
      try {
        body = JSON.parse(rawBody);
      } catch {
        this.fail(`mockApi: ${label} sent a body that is not valid JSON`);
      }
    }

    const req: MockRequest = { key, method, path, url, params, query, body };
    this.log.push(req);

    if (contract.params) {
      const r = contract.params.safeParse(params);
      if (!r.success) this.fail(`mockApi: ${key} path params do not match the params schema:\n${issues(r.error)}`);
    }
    if (contract.query) {
      const r = contract.query.safeParse(query);
      if (!r.success) this.fail(`mockApi: ${key} query does not match the query schema:\n${issues(r.error)}`);
    } else if (Object.keys(query).length > 0) {
      this.fail(`mockApi: ${label} sent a query string, but ${key} declares no query schema`);
    }
    if (contract.request) {
      const r = contract.request.safeParse(body);
      if (!r.success) this.fail(`mockApi: ${key} request body does not match the request schema:\n${issues(r.error)}`);
    } else if (body !== undefined) {
      this.fail(`mockApi: ${label} sent a body, but ${key} declares no request schema`);
    }

    if (this.isOffline) throw new TypeError('Failed to fetch');

    if (!this.handlers.has(key)) this.fail(`mockApi: ${key} was requested but has no handler (${label})`);
    let value = this.handlers.get(key);
    if (typeof value === 'function') {
      value = await (value as (r: MockRequest) => unknown)(req);
      if (!isReply(value)) {
        const r = contract.response.safeParse(value);
        if (!r.success) this.fail(`mockApi: handler for ${key} returned a body that does not match its response schema:\n${issues(r.error)}`);
      }
    }

    if (isReply(value)) {
      if (value.kind === 'pending') {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      if (value.kind === 'network') throw new TypeError('Failed to fetch');
      return jsonResponse(value.status ?? 500, value.body);
    }
    return jsonResponse(contract.status, value);
  };
}

// ── Active instance + public API ────────────────────────────────────────────────

let active: MockApi | null = null;

/** The active mock, created on first use in a test. */
function current(): MockApi {
  if (!active) active = new MockApi();
  return active;
}

/** The active mock, or null when the test has not called mockApi(). */
export function activeMockApi(): MockApi | null {
  return active;
}

/** Restore fetch and drop the active mock (afterEach does this automatically). */
export function resetMockApi(): void {
  active?.dispose();
  active = null;
}

/** Install (or extend) the active mock with `handlers`. */
export const mockApi = Object.assign((handlers: MockHandlers = {}): MockApi => current().use(handlers), {
  error: (key: string, status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) =>
    current().error(key, status, code, message, details),
  forbidden: (key: string, message?: string) => current().forbidden(key, message),
  pending: (key: string) => current().pending(key),
  offline: () => current().offline(),
  online: () => current().online(),
  calls: (key?: string) => current().calls(key),
});

/** Requests sent to `key` in this test. */
export function calls(key?: string): MockRequest[] {
  return current().calls(key);
}

afterEach(() => {
  const api = active;
  resetMockApi();
  if (api && api.problems.length > 0) {
    throw new Error(`mockApi recorded ${api.problems.length} problem(s):\n${api.problems.join('\n')}`);
  }
});
