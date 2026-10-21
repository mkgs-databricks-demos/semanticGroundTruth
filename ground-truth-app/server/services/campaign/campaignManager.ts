// server/services/campaign/campaignManager.ts — Campaign Manager service
// Session 07 · Wave 2 · No enum, no namespace, no default export
//
// Owns: create, list, get, updateStatus, scope materialisation, RBAC visibility
// (fail-open), automatic + freshness campaigns, completion checks, event subs.
// Does NOT import from server/services/review or server/services/notification.

import type { ServiceDeps } from '../../lib/deps';
import type { Db } from '../../lib/db';
import type { ConfigStore } from '../../lib/config';
import type { EventBus } from '../../lib/events';
import type { UserContext } from '../../lib/context';
import type { Campaign } from '../../../shared/contracts/entities';
import type { CreateCampaignBody, FreshnessCheckResult } from '../../../shared/contracts/api';
import type { CampaignStatus, CampaignType, CompletionRule } from '../../../shared/contracts/values';
import { notFound, conflict } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { assertTransition } from './lifecycle';
import { buildScopeFilter } from './scope';

// ── Row → domain mapper ──────────────────────────────────────────────

function toCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    name: row.name as string,
    campaignType: row.campaign_type as CampaignType,
    status: row.status as CampaignStatus,
    completionRule: row.completion_rule as CompletionRule,
    scopeDomain: (row.scope_domain as string) ?? null,
    scopeSubdomain: (row.scope_subdomain as string) ?? null,
    scopeAssetType: (row.scope_asset_type as Campaign['scopeAssetType']) ?? null,
    scopeAssetIds: (row.scope_asset_ids as string[]) ?? null,
    rbacGroups: (row.rbac_groups as string[]) ?? [],
    freshnessIntervalDays: (row.freshness_interval_days as number) ?? null,
    totalAssets: (row.total_assets as number) ?? 0,
    reviewedAssets: (row.reviewed_assets as number) ?? 0,
    createdBy: row.created_by as string,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Fetch the current user's group memberships from the Databricks SCIM API.
 * Returns an empty array (fail-open) on any error.
 *
 * Assumption: `currentUserFromToken` is not defined in any cross-module
 * contract (build_conventions §7). Implemented here as a private helper.
 * V1 decision: fail open + warn rather than blocking access.
 */
async function fetchUserGroups(accessToken: string): Promise<string[]> {
  try {
    const host = process.env.DATABRICKS_HOST ?? '';
    const baseUrl = host.startsWith('https://') ? host : `https://${host}`;
    const res = await fetch(`${baseUrl}/api/2.0/preview/scim/v2/Me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      logger.warn('SCIM /Me request failed', { status: res.status });
      return [];
    }
    const data = (await res.json()) as { groups?: Array<{ display?: string }> };
    return (data.groups ?? []).map((g) => g.display ?? '').filter(Boolean);
  } catch (err) {
    logger.warn('Failed to fetch user groups from SCIM', { error: String(err) });
    return [];
  }
}

// ── CampaignManager ─────────────────────────────────────────────────

export class CampaignManager {
  private readonly db: Db;
  private readonly config: ConfigStore;
  private readonly events: EventBus;

  constructor(deps: ServiceDeps) {
    this.db = deps.db;
    this.config = deps.config;
    this.events = deps.events;
  }

  // ── create ──────────────────────────────────────────────────────

  async create(body: CreateCampaignBody, createdBy: string): Promise<Campaign> {
    const row = await this.db.one<Record<string, unknown>>(
      `INSERT INTO app.campaigns
        (name, campaign_type, status, completion_rule,
         scope_domain, scope_subdomain, scope_asset_type, scope_asset_ids,
         rbac_groups, freshness_interval_days, created_by)
       VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        body.name,
        body.campaignType,
        body.completionRule ?? 'reviewed_once',
        body.scopeDomain ?? null,
        body.scopeSubdomain ?? null,
        body.scopeAssetType ?? null,
        body.scopeAssetIds ?? null,
        body.rbacGroups ?? [],
        body.freshnessIntervalDays ?? null,
        createdBy,
      ],
    );

    if (!row) {
      throw conflict('Failed to create campaign');
    }

    const campaignId = row.id as string;

    // Materialise scope: insert matching assets into campaign_assets
    const { where, params } = buildScopeFilter(body, 2);
    const scopeWhere = where !== 'TRUE' ? `WHERE ${where}` : '';
    await this.db.query(
      `INSERT INTO app.campaign_assets (campaign_id, asset_id, status)
       SELECT $1, id, 'pending' FROM app.assets ${scopeWhere}
       ON CONFLICT DO NOTHING`,
      [campaignId, ...params],
    );

    // Update total_assets count on the campaign row
    const countRow = await this.db.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app.campaign_assets WHERE campaign_id = $1`,
      [campaignId],
    );
    const totalAssets = parseInt(countRow?.count ?? '0', 10);

    await this.db.query(
      `UPDATE app.campaigns SET total_assets = $1, updated_at = NOW() WHERE id = $2`,
      [totalAssets, campaignId],
    );

    const campaign = toCampaign({ ...row, total_assets: totalAssets });

    this.events.emit({ type: 'campaign.created', campaignId: campaign.id });

    return campaign;
  }

  // ── list ─────────────────────────────────────────────────────────

  async list(
    user: UserContext,
    opts?: { status?: CampaignStatus },
  ): Promise<Campaign[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (opts?.status) {
      clauses.push(`c.status = $${idx}`);
      params.push(opts.status);
      idx += 1;
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT c.*,
        (SELECT COUNT(*)::int FROM app.campaign_assets
         WHERE campaign_id = c.id AND status = 'reviewed') AS reviewed_assets
       FROM app.campaigns c ${where}
       ORDER BY c.created_at DESC`,
      params,
    );

    const campaigns = rows.map(toCampaign);

    // Filter by RBAC visibility
    const visible: Campaign[] = [];
    for (const c of campaigns) {
      if (await this.isVisibleTo(user, c)) {
        visible.push(c);
      }
    }

    return visible;
  }

  // ── get ──────────────────────────────────────────────────────────

  async get(user: UserContext, campaignId: string): Promise<Campaign> {
    const row = await this.db.one<Record<string, unknown>>(
      `SELECT c.*,
        (SELECT COUNT(*)::int FROM app.campaign_assets
         WHERE campaign_id = c.id AND status = 'reviewed') AS reviewed_assets
       FROM app.campaigns c
       WHERE c.id = $1`,
      [campaignId],
    );

    if (!row) {
      throw notFound(`Campaign ${campaignId} not found`);
    }

    const campaign = toCampaign(row);

    if (!(await this.isVisibleTo(user, campaign))) {
      // Return 404 rather than 403 to avoid leaking campaign existence
      throw notFound(`Campaign ${campaignId} not found`);
    }

    return campaign;
  }

  // ── updateStatus ────────────────────────────────────────────────

  async updateStatus(
    campaignId: string,
    status: CampaignStatus,
    _userId: string,
  ): Promise<Campaign> {
    const existing = await this.db.one<Record<string, unknown>>(
      `SELECT * FROM app.campaigns WHERE id = $1`,
      [campaignId],
    );

    if (!existing) {
      throw notFound(`Campaign ${campaignId} not found`);
    }

    assertTransition(existing.status as CampaignStatus, status);

    const completedAtClause =
      status === 'completed' ? ', completed_at = NOW()'
      : status === 'active' ? ', completed_at = NULL'
      : '';

    const row = await this.db.one<Record<string, unknown>>(
      `UPDATE app.campaigns SET status = $1, updated_at = NOW()${completedAtClause} WHERE id = $2 RETURNING *`,
      [status, campaignId],
    );

    return toCampaign(row!);
  }

  // ── isVisibleTo ─────────────────────────────────────────────────

  async isVisibleTo(user: UserContext, campaign: Campaign): Promise<boolean> {
    // Admins and stewards see all campaigns
    if (user.roles.includes('admin') || user.roles.includes('steward')) {
      return true;
    }

    // No RBAC groups = visible to all (default / open campaign)
    if (campaign.rbacGroups.length === 0) {
      return true;
    }

    // Check user's group membership against campaign's rbac_groups
    if (!user.accessToken) {
      logger.warn('No access token for RBAC check; failing open', {
        userId: user.userId,
      });
      return true;
    }

    const userGroups = await fetchUserGroups(user.accessToken);
    if (userGroups.length === 0) {
      // Fail open if group lookup returns nothing (V1 decision)
      logger.warn('Could not resolve user groups; failing open', {
        userId: user.userId,
      });
      return true;
    }

    return campaign.rbacGroups.some((g) => userGroups.includes(g));
  }

  // ── createAutomaticForAsset ─────────────────────────────────────

  async createAutomaticForAsset(assetId: string): Promise<Campaign> {
    const asset = await this.db.one<Record<string, unknown>>(
      `SELECT display_name, name FROM app.assets WHERE id = $1`,
      [assetId],
    );

    const displayName =
      (asset?.display_name as string) ?? (asset?.name as string) ?? assetId;

    return this.create(
      {
        name: `Re-review: ${displayName}`,
        campaignType: 'automatic',
        scopeAssetIds: [assetId],
      },
      'system',
    );
  }

  // ── runFreshnessCheck ───────────────────────────────────────────

  async runFreshnessCheck(
    now: Date = new Date(),
  ): Promise<FreshnessCheckResult> {
    const settings = await this.config.get();
    const intervalDays = settings.freshnessIntervalDays;

    // Find or create the single active freshness campaign
    const freshnessCampaign = await this.db.one<Record<string, unknown>>(
      `SELECT * FROM app.campaigns
       WHERE campaign_type = 'freshness' AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [],
    );

    let campaignId: string;
    if (!freshnessCampaign) {
      const created = await this.create(
        {
          name: 'Freshness review',
          campaignType: 'freshness',
          freshnessIntervalDays: intervalDays,
        },
        'system',
      );
      campaignId = created.id;
    } else {
      campaignId = freshnessCampaign.id as string;
    }

    // Add stale assets: last_reviewed_at older than interval,
    // or never reviewed with created_at older than interval.
    const cutoff = new Date(now.getTime() - intervalDays * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();

    const inserted = await this.db.query<{ asset_id: string }>(
      `INSERT INTO app.campaign_assets (campaign_id, asset_id, status)
       SELECT $1, id, 'pending'
       FROM app.assets
       WHERE (
         (last_reviewed_at IS NOT NULL AND last_reviewed_at < $2)
         OR
         (last_reviewed_at IS NULL AND created_at < $2)
       )
       AND id NOT IN (
         SELECT asset_id FROM app.campaign_assets WHERE campaign_id = $1
       )
       ON CONFLICT DO NOTHING
       RETURNING asset_id`,
      [campaignId, cutoffIso],
    );

    const added = inserted.length;

    // Refresh total_assets on the campaign
    if (added > 0) {
      await this.db.query(
        `UPDATE app.campaigns
         SET total_assets = (SELECT COUNT(*)::int FROM app.campaign_assets WHERE campaign_id = $1),
             updated_at = NOW()
         WHERE id = $1`,
        [campaignId],
      );
    }

    return { campaignId, added };
  }

  // ── checkCompletion ─────────────────────────────────────────────

  async checkCompletion(campaignId: string): Promise<boolean> {
    const campaign = await this.db.one<Record<string, unknown>>(
      `SELECT * FROM app.campaigns WHERE id = $1`,
      [campaignId],
    );

    if (!campaign || (campaign.status as string) !== 'active') {
      return false;
    }

    const rule = (campaign.completion_rule as string) ?? 'reviewed_once';
    let isComplete = false;

    if (rule === 'reviewed_once') {
      // All campaign_assets have status = 'reviewed'
      const pending = await this.db.one<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM app.campaign_assets
         WHERE campaign_id = $1 AND status != 'reviewed'`,
        [campaignId],
      );
      isComplete = parseInt(pending?.count ?? '1', 10) === 0;
    } else if (rule === 'certified') {
      // All assets in the campaign have app.assets.status = 'CERTIFIED'
      const uncertified = await this.db.one<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM app.campaign_assets ca
         JOIN app.assets a ON a.id = ca.asset_id
         WHERE ca.campaign_id = $1 AND a.status != 'CERTIFIED'`,
        [campaignId],
      );
      isComplete = parseInt(uncertified?.count ?? '1', 10) === 0;
    }

    if (isComplete) {
      // Transition to completed (also updates updated_at)
      await this.updateStatus(campaignId, 'completed', 'system');
      this.events.emit({ type: 'campaign.completed', campaignId });
    }

    return isComplete;
  }

  // ── subscribe ───────────────────────────────────────────────────

  /**
   * Wire up domain-event subscriptions.
   * Call once during service initialisation (composition root, session 09).
   */
  subscribe(): void {
    // Automatic re-review campaigns on new asset versions
    this.events.on('asset.registered', async (e) => {
      if (e.isNewVersion) {
        await this.createAutomaticForAsset(e.assetId);
      }
    });

    // Completion checks after every vote
    this.events.on('vote.recorded', async (e) => {
      for (const cid of e.campaignIds) {
        await this.checkCompletion(cid);
      }
    });
  }
}
