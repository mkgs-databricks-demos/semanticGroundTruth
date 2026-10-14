# Session Summary: Phase 3 — SQL Warehouse + UC Secrets + Notifications

**Date:** 2026-10-08 20:27  
**Branch:** mg-genie-bundle-scaffolds  
**Phase:** 3 of 8  
**Status:** Complete ✅ (DAB resource created; manual steps documented)

---

## What Was Done

### Files Created
- **`resources/warehouses.yml`** — Serverless SQL warehouse (2X-Small PRO, preview channel)

---

## Changes Detail

### `resources/warehouses.yml`

Declares `infra_warehouse` SQL warehouse:
- `cluster_size: "2X-Small"`, `warehouse_type: PRO`, `enable_serverless_compute: true`
- `channel: CHANNEL_NAME_PREVIEW` (for metric views, VARIANT, CLUSTER BY AUTO)
- `auto_stop_mins: 10`
- `min_num_clusters: 1`, `max_num_clusters: 1`
- Referenced by other resources as `${resources.sql_warehouses.infra_warehouse.id}`

---

## Manual Steps (Out-of-Band)

These cannot be DAB-declared. Must be done after `bundle deploy --target dev`.

### UC Secrets (L300-03 §Step 1)

```bash
# Create secrets in the UC secret scope
# (scope name: ground_truth_infra, or per convention for this project)
databricks secrets create-scope ground-truth-infra --profile <profile>
databricks secrets put-secret ground-truth-infra slack_webhook_url --string-value "<SLACK_WEBHOOK>"
databricks secrets put-secret ground-truth-infra teams_webhook_url --string-value "<TEAMS_WEBHOOK>"
databricks secrets put-secret ground-truth-infra git_token --string-value "<GIT_TOKEN>"

# Validate: readable via SQL
-- SELECT secret('ground-truth-infra', 'slack_webhook_url')
```

Alternatively, use UC Secrets (catalog-scoped):
```sql
CREATE SECRET IF NOT EXISTS identifier(concat('${var.catalog}.${var.schema}.slack_webhook_url'))
  WITH (value = '<SLACK_WEBHOOK>');
```

### Notification Destinations (L300-03 §Step 3)

Configured via Workspace settings → Notifications:
1. Slack: webhook URL from `slack_webhook_url` secret
2. Teams: webhook URL from `teams_webhook_url` secret

---

## Validation

```
databricks bundle validate --strict --target dev
→ Validation OK!
```

---

## Files Modified

| File | Action |
|------|--------|
| `resources/warehouses.yml` | Created — SQL warehouse resource |
| `fixtures/sessions/2026-10-08_phase3-warehouse-secrets.md` | Created — this file |
