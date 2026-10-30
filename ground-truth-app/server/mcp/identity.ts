// server/mcp/identity.ts — carries the caller's UserContext from Express into the MCP server factory
// MCP SDK v2 upgrade (2026-10-30) · No enum, no namespace, no default export
//
// createMcpHandler (@modelcontextprotocol/server 2.x) calls the server factory
// once per HTTP request with an McpRequestContext. Its authInfo is strictly
// pass-through: the SDK never fills it from request headers and never verifies
// a token. The app keeps doing authentication exactly as before (AppKit OBO
// headers -> lib/context UserContext in res.locals.user), and this module
// only moves that already-resolved UserContext into the factory:
//
//   Express route  -> req.auth = userAuthInfo(getUser(res))
//   toNodeHandler  -> forwards req.auth as authInfo (pass-through)
//   factory(ctx)   -> userFromRequestContext(ctx) -> buildMcpServer(services, user)
//
// Role checks (hasRole / requireRole) still run in the tools against that
// UserContext. A request without it fails closed.

import type { AuthInfo, McpRequestContext } from '@modelcontextprotocol/server';
import type { UserContext } from '../lib/context';
import { unauthenticated } from '../lib/errors';

/** clientId stamped on the app-built AuthInfo, so the factory only trusts our own value. */
export const MCP_OBO_CLIENT_ID = 'semantic-ground-truth-obo';

const USER_KEY = 'sgtUser';

/**
 * Wrap an authenticated UserContext as the pass-through AuthInfo for one MCP
 * request. The OBO access token is NOT copied into it (tools read it from the
 * UserContext they close over, as in v1); `token` stays empty on purpose.
 */
export function userAuthInfo(user: UserContext): AuthInfo {
  return { token: '', clientId: MCP_OBO_CLIENT_ID, scopes: [], extra: { [USER_KEY]: user } };
}

/** The UserContext the Express route attached to this request. Throws (fail closed) when absent. */
export function userFromRequestContext(ctx: Pick<McpRequestContext, 'authInfo'>): UserContext {
  const info = ctx.authInfo;
  const user = info?.clientId === MCP_OBO_CLIENT_ID ? info.extra?.[USER_KEY] : undefined;
  if (!user || typeof user !== 'object') {
    throw unauthenticated('MCP request has no authenticated user');
  }
  return user as UserContext;
}
