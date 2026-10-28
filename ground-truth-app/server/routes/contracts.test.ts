// server/routes/contracts.test.ts — every registered route matches ROUTE_CONTRACTS
// Session 33 · Wave 4-1 · Vitest (no DB, no Express: routes are recorded)
//
// For each contract: the route is registered once, its validate() middleware
// carries the contract's body / query / params schemas (same objects), and its
// role middleware requires the contract's role ('public' = none).

import { describe, it, expect } from 'vitest';
import type { RequestHandler } from 'express';
import { ROUTE_CONTRACTS } from '../../shared/contracts/schemas';
import type { Services } from '../services';
import { recordRoutes } from '../lib/testing/routeHarness';
import type { ValidateMiddleware } from '../lib/validate';
import type { RoleMiddleware } from '../middleware/roles';

const services = { db: { query: async () => [], one: async () => null } } as unknown as Services;
const registrations = recordRoutes(services);
const key = (method: string, path: string) => `${method} ${path}`;

function validateOf(handlers: RequestHandler[]): ValidateMiddleware[] {
  return handlers.filter((h): h is ValidateMiddleware => 'validation' in h);
}

function roleOf(handlers: RequestHandler[]): RoleMiddleware[] {
  return handlers.filter((h): h is RoleMiddleware => 'requiredRole' in h);
}

describe('route registrations vs ROUTE_CONTRACTS', () => {
  // 50 + the 3 build-5 Share to Slack routes (slack.ts, 501 stubs until session 50).
  it('registers exactly the 53 contracted routes, each once', () => {
    const registered = registrations.map((r) => key(r.method, r.path)).sort();
    const contracted = ROUTE_CONTRACTS.map((c) => key(c.method, c.path)).sort();
    expect(new Set(registered).size).toBe(registered.length);
    expect(registered).toEqual(contracted);
    expect(registered).toHaveLength(53);
  });

  it('registers the 9 session-33 routes', () => {
    const registered = new Set(registrations.map((r) => key(r.method, r.path)));
    const session33 = [
      'POST /api/review/skip',
      'GET /api/me/settings',
      'PUT /api/me/settings',
      'GET /api/steward/feedback-queue',
      'GET /api/steward/conflicts',
      'POST /api/steward/conflicts/:assetId/resolve',
      'GET /api/steward/feedback-branches',
      'POST /api/steward/feedback-branches',
      'POST /api/steward/feedback-branches/:batchId/status',
    ];
    for (const k of session33) {
      expect(registered.has(k), k).toBe(true);
    }
  });

  for (const c of ROUTE_CONTRACTS) {
    const k = key(c.method, c.path);

    it(`${k}: validate() uses the contract schemas`, () => {
      const reg = registrations.find((r) => r.method === c.method && r.path === c.path);
      expect(reg, k).toBeDefined();
      const v = validateOf(reg!.handlers);
      expect(v, `${k} has one validate()`).toHaveLength(1);
      expect(v[0].validation.body, `${k} body`).toBe(c.request);
      expect(v[0].validation.query, `${k} query`).toBe(c.query);
      expect(v[0].validation.params, `${k} params`).toBe(c.params);
    });

    it(`${k}: role middleware requires ${c.role}`, () => {
      const reg = registrations.find((r) => r.method === c.method && r.path === c.path)!;
      const roles = roleOf(reg.handlers);
      if (c.role === 'public') {
        expect(roles, k).toHaveLength(0);
        return;
      }
      expect(roles, k).toHaveLength(1);
      expect(roles[0].requiredRole, k).toBe(c.role);
      // Role runs before validation: an under-privileged caller gets 403, not 400.
      expect(reg.handlers.indexOf(roles[0]), k).toBeLessThan(
        reg.handlers.indexOf(validateOf(reg.handlers)[0]),
      );
    });
  }
});
