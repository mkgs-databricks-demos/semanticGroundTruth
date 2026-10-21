import type { Migration } from './types';

export const migration: Migration = {
  id: '004_notifications',
  description: 'Notifications and notification preferences (L200-C7)',
  sql: `
CREATE TABLE IF NOT EXISTS app.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'slack', 'teams', 'webhook')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app.notification_preferences (
  user_id         TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  channels        TEXT[] NOT NULL DEFAULT '{in_app}',
  digest          BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_type)
);
`,
};
