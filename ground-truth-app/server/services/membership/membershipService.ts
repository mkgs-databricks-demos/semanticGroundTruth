// server/services/membership/membershipService.ts — Lakebase-backed RBAC
// Session 08 · Wave 1 · No default export
//
// Groups live in app.app_groups + app.app_group_members (Lakebase Postgres).
// 60 s in-process cache, invalidated on every write.

import type { ServiceDeps } from '../../lib/deps';
import type { Db } from '../../lib/db';
import type { Role } from '../../lib/context';
import type { AppGroup, AppGroupMember } from '../../../shared/contracts/entities';
import type { AppGroupName } from '../../../shared/contracts/values';
import { APP_GROUP_ROLE } from '../../../shared/contracts/values';
import { conflict } from '../../lib/errors';
import { logger } from '../../lib/logger';

const CACHE_TTL_MS = 60_000;

interface MembershipCache {
  groups: AppGroup[];
  at: number;
}

export class MembershipService {
  private readonly db: Db;
  private cache: MembershipCache | null = null;

  constructor(deps: ServiceDeps) {
    this.db = deps.db;
  }

  // ── cache ──────────────────────────────────────────────────────────

  private invalidate(): void {
    this.cache = null;
  }

  // ── listGroups ────────────────────────────────────────────────────

  async listGroups(): Promise<AppGroup[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.groups;
    }

    const groupRows = await this.db.query<Record<string, unknown>>(
      'SELECT name, description, created_at FROM app.app_groups ORDER BY name',
    );

    const memberRows = await this.db.query<Record<string, unknown>>(
      'SELECT group_name, member_id, added_by, added_at FROM app.app_group_members ORDER BY added_at',
    );

    const groups: AppGroup[] = groupRows.map((g) => {
      const name = g.name as AppGroupName;
      return {
        name,
        role: APP_GROUP_ROLE[name],
        description: (g.description as string) ?? null,
        members: memberRows
          .filter((m) => m.group_name === name)
          .map((m): AppGroupMember => ({
            groupName: m.group_name as AppGroupName,
            memberId: m.member_id as string,
            addedBy: m.added_by as string,
            addedAt: String(m.added_at),
          })),
        createdAt: String(g.created_at),
      };
    });

    this.cache = { groups, at: Date.now() };
    return groups;
  }

  // ── rolesFor ──────────────────────────────────────────────────────

  async rolesFor(memberId: string): Promise<Role[]> {
    const lower = memberId.toLowerCase();
    const groups = await this.listGroups();
    const roles = new Set<Role>(['reviewer']);

    for (const group of groups) {
      if (group.members.some((m) => m.memberId === lower)) {
        roles.add(group.role);
      }
    }

    // admin implies steward (conventions §3)
    if (roles.has('admin')) {
      roles.add('steward');
    }

    return [...roles];
  }

  // ── addMember ─────────────────────────────────────────────────────

  async addMember(
    groupName: AppGroupName,
    memberId: string,
    addedBy: string,
  ): Promise<void> {
    const lower = memberId.toLowerCase();
    await this.db.query(
      `INSERT INTO app.app_group_members (group_name, member_id, added_by, added_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (group_name, member_id) DO NOTHING`,
      [groupName, lower, addedBy],
    );
    this.invalidate();
  }

  // ── removeMember ──────────────────────────────────────────────────

  async removeMember(
    groupName: AppGroupName,
    memberId: string,
  ): Promise<void> {
    const lower = memberId.toLowerCase();

    // Last-admin guard (conventions §3)
    if (groupName === 'semantic-ground-truth-admins') {
      const row = await this.db.one<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM app.app_group_members
         WHERE group_name = $1`,
        [groupName],
      );
      if (parseInt(row?.count ?? '0', 10) <= 1) {
        throw conflict('Cannot remove the last admin');
      }
    }

    await this.db.query(
      'DELETE FROM app.app_group_members WHERE group_name = $1 AND member_id = $2',
      [groupName, lower],
    );
    this.invalidate();
  }

  // ── bootstrap ─────────────────────────────────────────────────────

  /**
   * Seed the admins group when it has zero members. No-op otherwise.
   * Called once on startup from server.ts.
   */
  async bootstrap(ids: string[]): Promise<number> {
    const adminsGroup: AppGroupName = 'semantic-ground-truth-admins';

    const existing = await this.db.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM app.app_group_members
       WHERE group_name = $1`,
      [adminsGroup],
    );

    if (parseInt(existing?.count ?? '0', 10) > 0) {
      return 0;
    }

    const unique = [
      ...new Set(ids.map((id) => id.toLowerCase().trim()).filter(Boolean)),
    ];

    for (const id of unique) {
      await this.db.query(
        `INSERT INTO app.app_group_members (group_name, member_id, added_by, added_at)
         VALUES ($1, $2, 'bootstrap', NOW())
         ON CONFLICT (group_name, member_id) DO NOTHING`,
        [adminsGroup, id],
      );
    }

    this.invalidate();
    logger.info(`Bootstrapped ${unique.length} admin(s)`, { ids: unique });
    return unique.length;
  }

  // ── isMemberOfAny ─────────────────────────────────────────────────

  /**
   * True when `memberId` belongs to at least one of the named groups.
   * Returns true for an empty `groupNames` list (no restriction).
   */
  async isMemberOfAny(
    memberId: string,
    groupNames: string[],
  ): Promise<boolean> {
    if (groupNames.length === 0) return true;

    const lower = memberId.toLowerCase();
    const groups = await this.listGroups();

    return groupNames.some((gn) => {
      const group = groups.find((g) => g.name === gn);
      return group?.members.some((m) => m.memberId === lower) ?? false;
    });
  }
}
