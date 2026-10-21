import type { Migration } from './types';

export const migration: Migration = {
  id: '006_indexes',
  description: 'All performance indexes: L200-C1 indexes plus status, domain, campaigns, notifications',
  sql: `
-- L200-C1 indexes
CREATE INDEX IF NOT EXISTS idx_assets_type ON app.assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_environment ON app.assets(environment);
CREATE INDEX IF NOT EXISTS idx_assets_confidence ON app.assets(confidence_score);
CREATE INDEX IF NOT EXISTS idx_assets_last_reviewed ON app.assets(last_reviewed_at);
CREATE INDEX IF NOT EXISTS idx_votes_unprocessed ON app.votes(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_votes_asset ON app.votes(asset_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON app.votes(user_id);
CREATE INDEX IF NOT EXISTS idx_example_questions_asset ON app.example_questions(asset_id);

-- build_conventions s5 additions
CREATE INDEX IF NOT EXISTS idx_assets_status ON app.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_domain ON app.assets(domain);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON app.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_asset ON app.campaign_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON app.notifications(recipient_id) WHERE status <> 'read';
`,
};
