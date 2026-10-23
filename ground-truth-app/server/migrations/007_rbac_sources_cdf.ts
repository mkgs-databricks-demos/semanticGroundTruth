import type { Migration } from './types';

export const migration: Migration = {
  id: '007_rbac_sources_cdf',
  description:
    'App groups, group members, asset sources, assets.source_id/source_metadata, REPLICA IDENTITY FULL on all app tables',
  sql: `
CREATE TABLE IF NOT EXISTS app.app_groups (
  name        TEXT PRIMARY KEY,
  role        TEXT NOT NULL CHECK (role IN ('reviewer', 'steward', 'admin')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.app_group_members (
  group_name  TEXT NOT NULL REFERENCES app.app_groups(name),
  member_id   TEXT NOT NULL,
  added_by    TEXT,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_name, member_id)
);

CREATE TABLE IF NOT EXISTS app.asset_sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type      TEXT NOT NULL DEFAULT 'git_folder',
  workspace_path   TEXT NOT NULL,
  display_name     TEXT,
  metric_view_glob TEXT NOT NULL DEFAULT '**/*.metric_view.yml',
  glossary_glob    TEXT NOT NULL DEFAULT '**/semantics/**/*.md',
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_scanned_at  TIMESTAMPTZ,
  UNIQUE (workspace_path)
);

ALTER TABLE app.assets ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES app.asset_sources(id);
ALTER TABLE app.assets ADD COLUMN IF NOT EXISTS source_metadata JSONB;

INSERT INTO app.app_groups (name, role, description)
VALUES
  ('semantic-ground-truth-admins',   'admin',    'Administrators with full access'),
  ('semantic-ground-truth-stewards', 'steward',  'Stewards who manage campaigns and import assets'),
  ('semantic-ground-truth-users',    'reviewer', 'Reviewers who vote on asset definitions')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app'
      AND c.relkind = 'r'
      AND c.relreplident <> 'f'
  LOOP
    EXECUTE format('ALTER TABLE app.%I REPLICA IDENTITY FULL', tbl.relname);
  END LOOP;
END $$;
`,
};
