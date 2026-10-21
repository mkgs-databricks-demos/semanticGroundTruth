import type { Migration } from './types';

export const migration: Migration = {
  id: '005_app_state',
  description: 'App config (seeded with defaults), user activity, MCP sessions',
  sql: `
CREATE TABLE IF NOT EXISTS app.app_config (
  key             TEXT PRIMARY KEY,
  value           JSONB NOT NULL,
  updated_by      TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app.app_config (key, value) VALUES
  ('wilson_z', '1.96'),
  ('industry_prior', '0.5'),
  ('prior_weight', '4'),
  ('prior_decay_threshold', '30'),
  ('certification_threshold', '0.8'),
  ('min_votes_for_certification', '5'),
  ('staleness_days', '90'),
  ('freshness_interval_days', '180'),
  ('admin_emails', '[]'),
  ('steward_emails', '[]')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS app.user_activity (
  user_id             TEXT PRIMARY KEY,
  email               TEXT,
  total_votes         INTEGER NOT NULL DEFAULT 0,
  current_streak_days INTEGER NOT NULL DEFAULT 0,
  longest_streak_days INTEGER NOT NULL DEFAULT 0,
  last_vote_date      DATE,
  badges              TEXT[] NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.mcp_sessions (
  session_id      TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  current_asset_id UUID,
  campaign_id     UUID,
  state           JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`,
};
