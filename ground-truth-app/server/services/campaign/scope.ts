// server/services/campaign/scope.ts — scope filter builder + RBAC visibility
// Session 08 · Wave 1 · No enum, no namespace, no default export
//
// Campaign RBAC now resolves against Lakebase app groups (via
// MembershipService), not workspace identity groups. Fails closed when
// membership cannot be determined.

/**
 * Minimal interface for campaign scope fields.
 * Matches the scope columns on `app.campaigns` / the `CreateCampaignBody` DTO.
 */
export interface ScopeInput {
  scopeDomain?: string | null;
  scopeSubdomain?: string | null;
  scopeAssetType?: string | null;
  scopeAssetIds?: string[] | null;
}

/**
 * Build a `$n`-parameterised WHERE clause against `app.assets` for a campaign scope.
 *
 * - L200-C1 has no `is_active` column on `app.assets` — omitted per plan
 *   ("always `is_active = TRUE` if that column exists; otherwise omit").
 * - An empty scope (all nulls) returns `where: 'TRUE'` (matches all assets).
 *
 * @param c          Scope fields from the campaign or creation body.
 * @param startIndex The first `$n` placeholder index to use (so callers can
 *                   compose this WHERE clause with other parameters).
 * @returns `{ where, params }` ready to append to a `SELECT ... FROM app.assets WHERE ...`.
 */
export function buildScopeFilter(
  c: ScopeInput,
  startIndex: number,
): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = startIndex;

  if (c.scopeDomain != null) {
    clauses.push(`domain = $${idx}`);
    params.push(c.scopeDomain);
    idx += 1;
  }

  if (c.scopeSubdomain != null) {
    clauses.push(`subdomain = $${idx}`);
    params.push(c.scopeSubdomain);
    idx += 1;
  }

  if (c.scopeAssetType != null) {
    clauses.push(`asset_type = $${idx}`);
    params.push(c.scopeAssetType);
    idx += 1;
  }

  if (c.scopeAssetIds != null && c.scopeAssetIds.length > 0) {
    clauses.push(`id = ANY($${idx})`);
    params.push(c.scopeAssetIds);
    idx += 1;
  }

  return {
    where: clauses.length > 0 ? clauses.join(' AND ') : 'TRUE',
    params,
  };
}

// ── Campaign RBAC visibility (conventions §3) ─────────────────────────

import type { UserContext } from '../../lib/context';
import type { MembershipService } from '../membership';

/**
 * Check whether `user` may see a campaign restricted to `rbacGroups`.
 *
 * Rules (conventions §3, fail closed):
 *   1. Admins and stewards see all campaigns.
 *   2. No rbacGroups (empty array) = visible to everyone.
 *   3. Otherwise: the user must be a member of at least one named group.
 *      If membership cannot be determined, the campaign is hidden (fail closed).
 */
export async function checkCampaignVisibility(
  user: UserContext,
  rbacGroups: string[],
  membership: MembershipService,
): Promise<boolean> {
  // Admins and stewards see all
  if (user.roles.includes('admin') || user.roles.includes('steward')) {
    return true;
  }

  // No RBAC restriction
  if (rbacGroups.length === 0) {
    return true;
  }

  // Fail closed: resolve from Lakebase app group membership
  return membership.isMemberOfAny(user.email, rbacGroups);
}
