// tests/contract/routes.contract.test.ts — every ROUTE_CONTRACTS entry against the seeded fake data layer
// Session 35 · Wave 4-3 · Vitest (no DB, no Express: routes are recorded and invoked in-process)
//
// Happy path: contract success status, `response` schema parses the body and
// parsing changes nothing (no extra or missing fields), and the body equals the
// exact value expected from the fixtures. Error paths: every status the
// contract lists returns the ErrorResponse envelope with the matching code.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorResponseSchema, ROUTE_CONTRACTS, routeKey } from '../../shared/contracts/schemas';
import { ERROR_CODE_FOR_STATUS, callRoute, newEnv, userBelow } from './harness';
import { ROUTE_CASES, errorPlan } from './routeCases';
import type { CallInput } from './routeCases';

vi.mock('../../server/services/sources', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  SourceService: (await import('./fakeStore')).FakeSourceService,
}));

afterEach(() => {
  delete process.env.GT_EXEC_DASHBOARD_URL;
});

/** Input for a generated error case (errorPlan kind 'generated'): 401, 403 or 500. */
function generated(status: number, role: string, happy: CallInput): { input: CallInput; anonymous?: boolean } {
  if (status === 401) return { input: { ...happy, setup: undefined }, anonymous: true };
  if (status === 403) return { input: { ...happy, setup: undefined, user: userBelow(role as never)! } };
  return { input: { ...happy, setup: (s) => { happy.setup?.(s); s.failAll = true; } } };
}

for (const c of ROUTE_CONTRACTS) {
  const key = routeKey(c);
  const rc = ROUTE_CASES[key];

  describe(key, () => {
    if (!rc) {
      it('has a contract case', () => {
        expect.fail(`no ROUTE_CASES entry for ${key}`);
      });
      return;
    }

    it(`happy path: ${c.status}, response schema, exact values`, async () => {
      const env = newEnv();
      const res = await callRoute(env, c, rc.happy);
      expect(res.status, JSON.stringify(res.body)).toBe(c.status);
      const parsed = c.response.safeParse(res.body);
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
      // zod strips unknown keys: equality proves the body has no extra fields.
      expect(parsed.data).toEqual(res.body);
      expect(res.body).toEqual(rc.happy.expected(env.store));
      rc.happy.after?.(env.store);
    });

    const plan = errorPlan(c, rc);
    for (const status of c.errors) {
      const entry = plan[status];
      // 'na' entries carry a reason; coverage.contract.test.ts checks every status has one of the three kinds.
      if (entry.kind === 'na') continue;
      if (entry.kind === 'missing') {
        it(`error ${status} has a case`, () => {
          expect.fail(`${key}: status ${status} has no case, generator or na reason`);
        });
        continue;
      }
      const explicit = rc.errors?.[status] as CallInput | undefined;
      const gen = entry.kind === 'case' ? { input: explicit! } : generated(status, c.role, rc.happy);
      it(`error ${status} ${ERROR_CODE_FOR_STATUS[status]}`, async () => {
        const env = newEnv();
        const res = await callRoute(env, c, gen.input, { anonymous: 'anonymous' in gen ? gen.anonymous : false });
        expect(res.status, JSON.stringify(res.body)).toBe(status);
        const parsed = ErrorResponseSchema.safeParse(res.body);
        expect(parsed.success, JSON.stringify(res.body)).toBe(true);
        expect(parsed.data).toEqual(res.body);
        expect((res.body as { error: { code: string } }).error.code).toBe(ERROR_CODE_FOR_STATUS[status]);
      });
    }
  });
}
