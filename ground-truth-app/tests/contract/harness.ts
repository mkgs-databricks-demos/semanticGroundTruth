// tests/contract/harness.ts — shared helpers for the contract suite (routes + MCP)
// Session 35 · Wave 4-3 · test-only · No enum, no namespace, no default export
//
// Test files that call routes must mock SourceService themselves (vi.mock is
// hoisted per test file):
//   vi.mock('../../server/services/sources', async (orig) => ({
//     ...(await orig<object>()), SourceService: (await import('./fakeStore')).FakeSourceService }));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Role, UserContext } from '../../server/lib/context';
import { findRoute, invoke, recordRoutes } from '../../server/lib/testing/routeHarness';
import type { InvokeResult, Registration } from '../../server/lib/testing/routeHarness';
import { buildMcpServer } from '../../server/mcp/server';
import type { Services } from '../../server/services';
import type { ErrorCode } from '../../shared/contracts/errors';
import type { RouteContract } from '../../shared/contracts/schemas';
import { FakeStore, createFakeServices } from './fakeStore';
import { ADMIN, REVIEWER, STEWARD } from './fixtures';
import type { CallInput } from './routeCases';

export const ERROR_CODE_FOR_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  500: 'INTERNAL',
  502: 'UPSTREAM_ERROR',
};

/** Lowest-privilege fixture user that satisfies the role. */
export function userForRole(role: Role | 'public'): UserContext {
  return role === 'admin' ? ADMIN : role === 'steward' ? STEWARD : REVIEWER;
}

/** A fixture user one role below `role`, or null for reviewer/public (every caller is a reviewer). */
export function userBelow(role: Role | 'public'): UserContext | null {
  return role === 'admin' ? STEWARD : role === 'steward' ? REVIEWER : null;
}

export interface Env {
  store: FakeStore;
  services: Services;
  routes: Registration[];
}

export function newEnv(): Env {
  const store = new FakeStore();
  const services = createFakeServices(store);
  return { store, services, routes: recordRoutes(services) };
}

/** Run setup, then invoke the contract's route as `input.user` (default: the contract role). */
export async function callRoute(
  env: Env,
  c: RouteContract,
  input: CallInput,
  opts: { anonymous?: boolean } = {},
): Promise<InvokeResult> {
  input.setup?.(env.store);
  const reg = findRoute(env.routes, c.method, c.path);
  return invoke(reg, {
    user: opts.anonymous ? undefined : (input.user ?? userForRole(c.role)),
    body: input.body,
    query: input.query,
    params: input.params,
  });
}

/** MCP client connected to buildMcpServer over an in-memory transport. */
export async function connectMcp(services: Services, user: UserContext): Promise<Client> {
  const server = buildMcpServer(services, { ...user, source: 'mcp' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'contract-tests', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

export function toolText(result: unknown): string {
  const content = ((result as { content?: unknown }).content ?? []) as Array<{ type: string; text?: string }>;
  return content.map((c) => c.text ?? '').join('\n');
}
