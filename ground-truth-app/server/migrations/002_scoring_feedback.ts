import type { Migration } from './types';

export const migration: Migration = {
  id: '002_scoring_feedback',
  description: 'Confidence scores and feedback batches (L200-C1)',
  sql: `
CREATE TABLE IF NOT EXISTS app.confidence_scores (
  asset_id        UUID PRIMARY KEY REFERENCES app.assets(id),
  total_votes     INTEGER NOT NULL DEFAULT 0,
  approvals       INTEGER NOT NULL DEFAULT 0,
  rejections      INTEGER NOT NULL DEFAULT 0,
  edits           INTEGER NOT NULL DEFAULT 0,
  wilson_lower    DOUBLE PRECISION NOT NULL DEFAULT 0,
  wilson_upper    DOUBLE PRECISION NOT NULL DEFAULT 0,
  confidence      DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_vote_at    TIMESTAMPTZ,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.feedback_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by    TEXT NOT NULL,
  branch_name     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  asset_count     INTEGER NOT NULL DEFAULT 0,
  processing_time_seconds DOUBLE PRECISION,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
`,
};
