import type { Migration } from './types';
import {
  ASSET_TYPES,
  CARDS_PER_SESSION_DEFAULT,
  CARDS_PER_SESSION_MAX,
  CARDS_PER_SESSION_MIN,
  CONFLICT_RESOLUTIONS,
  DENSITIES,
  FEEDBACK_BATCH_STATUSES,
  MOTION_PREFS,
  SKIP_COOLDOWN_HOURS_DEFAULT,
  SKIP_REASONS,
  THEMES,
  VOTE_SOURCES,
} from '../../shared/contracts/values';

// Build 4, plan 25. Skip is tracked but is NOT a vote: skips live in
// app.review_skips and never touch confidence_scores. Also adds per-user
// settings and the columns the steward triage views need.
//
// Idempotent: every CREATE uses IF NOT EXISTS, every ADD COLUMN uses
// IF NOT EXISTS, constraints are added only when pg_constraint lacks them,
// and inserts use ON CONFLICT DO NOTHING. The votes.vote_type CHECK stays
// approve|reject|edit (migration 001).

/** SQL IN-list from a contract value list (compile-time constants only). */
function sqlList(values: readonly string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}

export const migration: Migration = {
  id: '009_skips_settings_triage',
  description:
    'review_skips, user_settings, user_activity skip counters, feedback_batches triage columns + status CHECK, votes resolution columns, skip_cooldown_hours config',
  sql: `
-- ── Skips (not votes) ──
CREATE TABLE IF NOT EXISTS app.review_skips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  asset_id      UUID NOT NULL REFERENCES app.assets(id),
  campaign_id   UUID REFERENCES app.campaigns(id),
  reason        TEXT CHECK (reason IN (${sqlList(SKIP_REASONS)})),
  version_hash  TEXT,
  source        TEXT NOT NULL DEFAULT 'web' CHECK (source IN (${sqlList(VOTE_SOURCES)})),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_skips_user_created
  ON app.review_skips (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_skips_asset
  ON app.review_skips (asset_id);
CREATE INDEX IF NOT EXISTS idx_review_skips_campaign
  ON app.review_skips (campaign_id);

-- Any legacy skip stored as a vote (none expected: the 001 CHECK forbids it)
-- moves to review_skips first, then leaves app.votes.
INSERT INTO app.review_skips (user_id, asset_id, campaign_id, version_hash, source, created_at)
SELECT v.user_id, v.asset_id, v.campaign_id, v.version_hash, v.source, v.created_at
FROM app.votes v
WHERE v.vote_type = 'skip'
ON CONFLICT DO NOTHING;

DELETE FROM app.votes WHERE vote_type = 'skip';

ALTER TABLE app.user_activity
  ADD COLUMN IF NOT EXISTS total_skips INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_skip_at TIMESTAMPTZ;

-- ── User settings ──
CREATE TABLE IF NOT EXISTS app.user_settings (
  user_id             TEXT PRIMARY KEY,
  theme               TEXT NOT NULL DEFAULT 'system' CHECK (theme IN (${sqlList(THEMES)})),
  density             TEXT NOT NULL DEFAULT 'comfortable' CHECK (density IN (${sqlList(DENSITIES)})),
  motion              TEXT NOT NULL DEFAULT 'system' CHECK (motion IN (${sqlList(MOTION_PREFS)})),
  default_campaign_id UUID REFERENCES app.campaigns(id) ON DELETE SET NULL,
  default_asset_type  TEXT CHECK (default_asset_type IN (${sqlList(ASSET_TYPES)})),
  show_keyboard_hints BOOLEAN NOT NULL DEFAULT TRUE,
  cards_per_session   INTEGER NOT NULL DEFAULT ${CARDS_PER_SESSION_DEFAULT}
    CHECK (cards_per_session BETWEEN ${CARDS_PER_SESSION_MIN} AND ${CARDS_PER_SESSION_MAX}),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Steward triage: feedback branches ──
ALTER TABLE app.feedback_batches
  ADD COLUMN IF NOT EXISTS files JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Normalise free-text statuses before the CHECK. Known legacy spellings map
-- to their meaning; anything else unknown becomes 'pending'.
UPDATE app.feedback_batches SET status = LOWER(TRIM(status))
WHERE status <> LOWER(TRIM(status));

UPDATE app.feedback_batches SET status = CASE
    WHEN status IN ('success', 'succeeded', 'completed', 'complete', 'done', 'branch_ready') THEN 'proposed'
    WHEN status IN ('error', 'errored', 'failure') THEN 'failed'
    WHEN status IN ('reviewing', 'in-review', 'review') THEN 'in_review'
    ELSE 'pending'
  END
WHERE status NOT IN (${sqlList(FEEDBACK_BATCH_STATUSES)});

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_batches_status_check'
  ) THEN
    ALTER TABLE app.feedback_batches
      ADD CONSTRAINT feedback_batches_status_check
      CHECK (status IN (${sqlList(FEEDBACK_BATCH_STATUSES)}));
  END IF;
END $$;

-- ── Steward triage: conflict resolution on edit votes ──
ALTER TABLE app.votes
  ADD COLUMN IF NOT EXISTS resolution TEXT CHECK (resolution IN (${sqlList(CONFLICT_RESOLUTIONS)})),
  ADD COLUMN IF NOT EXISTS resolved_by TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- ── Config ──
INSERT INTO app.app_config (key, value) VALUES
  ('skip_cooldown_hours', '${SKIP_COOLDOWN_HOURS_DEFAULT}')
ON CONFLICT DO NOTHING;

-- ── Lakebase CDF (migration 007 convention) ──
ALTER TABLE app.review_skips REPLICA IDENTITY FULL;
ALTER TABLE app.user_settings REPLICA IDENTITY FULL;
`,
};
