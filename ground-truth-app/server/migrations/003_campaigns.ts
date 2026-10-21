import type { Migration } from './types';

export const migration: Migration = {
  id: '003_campaigns',
  description: 'Campaigns, campaign assignments, campaign assets, and votes FK (L200-C5)',
  sql: `
CREATE TABLE IF NOT EXISTS app.campaigns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  campaign_type        TEXT NOT NULL CHECK (campaign_type IN ('automatic', 'manual', 'freshness')),
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  completion_rule      TEXT NOT NULL DEFAULT 'reviewed_once' CHECK (completion_rule IN ('reviewed_once', 'certified')),
  scope_domain         TEXT,
  scope_subdomain      TEXT,
  scope_asset_type     TEXT,
  scope_asset_ids      UUID[],
  rbac_groups          TEXT[] NOT NULL DEFAULT '{}',
  freshness_interval_days INTEGER DEFAULT 180,
  total_assets         INTEGER NOT NULL DEFAULT 0,
  reviewed_assets      INTEGER NOT NULL DEFAULT 0,
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app.campaign_assignments (
  campaign_id     UUID NOT NULL REFERENCES app.campaigns(id),
  user_id         TEXT NOT NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS app.campaign_assets (
  campaign_id     UUID NOT NULL REFERENCES app.campaigns(id),
  asset_id        UUID NOT NULL REFERENCES app.assets(id),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'skipped')),
  PRIMARY KEY (campaign_id, asset_id)
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'votes_campaign_fk'
  ) THEN
    ALTER TABLE app.votes
      ADD CONSTRAINT votes_campaign_fk
      FOREIGN KEY (campaign_id) REFERENCES app.campaigns(id);
  END IF;
END $$;
`,
};
