// server/mcp/session.ts — per-user MCP review session state
// Session 11 · Wave 4 · No enum, no namespace, no default export

import type { Db } from '../lib/db';

export interface McpSession {
  userId: string;
  currentAssetId: string | null;
  currentCampaignId: string | null;
  updatedAt: string;
}

/**
 * Thin wrapper over `app.mcp_sessions`, keyed `session_id = 'user:' + userId`.
 * Keeps track of which asset the user is currently reviewing so
 * `review_submit_vote` can default the asset_id.
 */
export class McpSessionStore {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async get(userId: string): Promise<McpSession | null> {
    const row = await this.db.one<Record<string, unknown>>(
      `SELECT session_id, current_asset_id, current_campaign_id, updated_at
       FROM app.mcp_sessions
       WHERE session_id = $1`,
      [`user:${userId}`],
    );
    if (!row) return null;
    return {
      userId,
      currentAssetId: (row.current_asset_id as string) ?? null,
      currentCampaignId: (row.current_campaign_id as string) ?? null,
      updatedAt: String(row.updated_at),
    };
  }

  async setCurrent(
    userId: string,
    assetId: string,
    campaignId?: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO app.mcp_sessions (session_id, current_asset_id, current_campaign_id, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id) DO UPDATE SET
         current_asset_id = $2,
         current_campaign_id = $3,
         updated_at = NOW()`,
      [`user:${userId}`, assetId, campaignId ?? null],
    );
  }
}
