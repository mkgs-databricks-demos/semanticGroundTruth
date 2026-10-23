import type { Migration } from './types';

// The review engine records the asset version each vote was cast against
// (reviewEngine.submitVote INSERT, getNext / recompute filters), but 001 created
// app.votes without that column. Additive and nullable: existing votes keep NULL
// and are treated as votes on an earlier version.
export const migration: Migration = {
  id: '008_votes_version_hash',
  description: 'app.votes.version_hash (asset version a vote applies to) + lookup index',
  sql: `
ALTER TABLE app.votes ADD COLUMN IF NOT EXISTS version_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_votes_asset_user_version
  ON app.votes (asset_id, user_id, version_hash);
`,
};
