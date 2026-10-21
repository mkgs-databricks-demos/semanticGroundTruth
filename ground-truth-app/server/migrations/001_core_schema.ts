import type { Migration } from './types';

export const migration: Migration = {
  id: '001_core_schema',
  description: 'Core asset registry tables: assets, asset_versions, asset_synonyms, synonym_votes, votes, example_questions, example_question_votes',
  sql: `
CREATE TABLE IF NOT EXISTS app.assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type      TEXT NOT NULL,
  name            TEXT NOT NULL,
  display_name    TEXT,
  description     TEXT,
  plain_english_logic TEXT,
  yaml_content    TEXT,
  repo_url        TEXT,
  fixture_path    TEXT,
  branch          TEXT,
  environment     TEXT NOT NULL DEFAULT 'dev',
  target_catalog  TEXT NOT NULL,
  target_schema   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'CERTIFIED')),
  domain          TEXT,
  subdomain       TEXT,
  version_hash    TEXT,
  last_reviewed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_type, name, repo_url, fixture_path)
);

CREATE TABLE IF NOT EXISTS app.asset_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES app.assets(id),
  version         INTEGER NOT NULL,
  yaml_content    TEXT,
  description     TEXT,
  plain_english_logic TEXT,
  change_type     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  UNIQUE (asset_id, version)
);

CREATE TABLE IF NOT EXISTS app.asset_synonyms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES app.assets(id),
  synonym         TEXT NOT NULL,
  proposed_by     TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  source          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, synonym)
);

CREATE TABLE IF NOT EXISTS app.synonym_votes (
  synonym_id      UUID NOT NULL REFERENCES app.asset_synonyms(id),
  user_id         TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (synonym_id, user_id)
);

CREATE TABLE IF NOT EXISTS app.votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES app.assets(id),
  user_id         TEXT NOT NULL,
  vote_type       TEXT NOT NULL CHECK (vote_type IN ('approve', 'reject', 'edit')),
  source          TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mcp', 'agent')),
  feedback        TEXT,
  edit_description TEXT,
  edit_plain_english_logic TEXT,
  edit_display_name TEXT,
  campaign_id     UUID,
  is_processed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.example_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES app.assets(id),
  question_text   TEXT NOT NULL,
  proposed_by     TEXT NOT NULL,
  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  source          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.example_question_votes (
  question_id     UUID NOT NULL REFERENCES app.example_questions(id),
  user_id         TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, user_id)
);
`,
};
