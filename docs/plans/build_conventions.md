# Solution Build Conventions — Root Build (infra + app + agent)

Read this before every session in `docs/plans/waves.json`. If a plan file and this document disagree, this document wins; if the session `scope` in `waves.json` disagrees with either, `scope` wins.

Decisions below were made by the project owner on 2026-10-22 and are not open for redesign inside a session.

## 0. Next build overrides (brand UI + gaps, sessions 16–24)

Where this section and later sections disagree, this section wins for sessions 16–24.

* **Branch:** `mg-genie-ui-brand-and-gaps` (not `mg-genie-agent-build`, which is merged and deleted).
* **Deploy order:** infra converge (wave 2) → app converge (wave 3). Infra goes first because it restores the app SPN's READ on `semantic_ground_truth_credentials`; the app runtime gate fails on the `m2m-client-id` resolve ERROR until then. The agent bundle is not edited; wave 2 re-runs `agent_verification` as a regression check.
* **UI source of truth:** `docs/plans/ui_brand_plan.md`. Hex values and contrast ratios there are final; sessions do not re-pick colors. Components reference semantic tokens only (no Tailwind palette classes, no inline hex outside `client/src/theme/tokens.ts`, `client/src/index.css`, `server/mcp/views/cardHtml.ts`).
* **No new npm dependencies** and no `pnpm-lock.yaml` edits (no Node toolchain in build sessions).
* **Brand assets** are copied from `/Workspace/Shared/brandfolder/` or downloaded once from the CDN URLs in `assets.csv` and committed under `ground-truth-app/client/public/`. No runtime CDN or Google Fonts requests.
* **Runtime gate:** structured `"level":"error"` lines now count as errors. Fix the cause; never add an `ignore_patterns` entry to pass a gate.

---

## 1. Build rules

* **Git editor + bundle assets only.** Every deliverable is a file in this repo that a Declarative Automation Bundle deploys: apps, jobs, pipelines, Genie spaces, dashboards. Anything with no bundle resource type (Lakebase CDF config, metric views, grants, demo data) is a **bundle job** that a converge session runs with `bundle run`. No ad-hoc notebook runs, no UI clicks, no SQL editor work.
* **Sessions are `edit` or `converge` only.** No `execute` / `configure`.
* **Leave the app bundle's own build untouched:** never edit `ground-truth-app/docs/plans/**` or `ground-truth-app/.build-status/**`.
* **No masking / ABAC / governed tags in this build.** Deferred until the data model is stable.
* **Deploy order:** app converge (wave 2) → infra converge (wave 3) → agent converge (wave 4). The infra bundle is already deployed; wave 3 redeploys it with the new CDF/pipeline/metric-view assets.
* Never commit to `main`. Branch: `mg-genie-agent-build`.

## 2. Bundles and identifiers (dev target)

| Item | Value |
|---|---|
| Workspace | `https://fevm-hls-fde.cloud.databricks.com` |
| UC schema (existing, shared by all bundles) | `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth` |
| SQL warehouse (infra) | `0ea84986a23a47c3` |
| Lakebase project / branch | `projects/dev-matthew-giglia-ground-truth` / `.../branches/production` |
| Lakebase database resource | `projects/dev-matthew-giglia-ground-truth/branches/production/databases/ground-truth-app` (infra resource key `postgres_databases.app_db`) |
| Postgres schema | `app` (17 business tables + `app._migrations`) |
| App | `dev-semantic-ground-truth` (resource key `app`) |
| M2M SPN (probe / job caller) | `semantic-ground-truth-m2m-dev`; secret scope `semantic_ground_truth_credentials`, keys `m2m_client_id_dev`, `m2m_client_secret_dev` (OAuth scope `all-apis`) |
| Dev-mode name prefix | `[dev matthew_giglia] ` on jobs, pipelines, Genie spaces |

Schema references in bundle YAML: infra uses `${resources.schemas.ground_truth_schema.name}`; app/agent use their `catalog` / `schema_name` variables (cross-bundle values are resolved by `deploy.sh`, dev defaults are already set).

Notebook paths in YAML must match the file extension on disk (infra notebooks are `.py`, app notebooks are `.ipynb`). List the directory before writing a path; run `bundle validate --strict` after any change.

SDK notebooks: first code cell titled **Install latest Databricks SDK** = `%pip install --upgrade databricks-sdk` + `dbutils.library.restartPython()` (function form, never `%restart_python`).

## 3. Identity and RBAC (app-managed, stored in Lakebase)

Account groups cannot be granted easily and workspace-local groups cannot be used in UC grants, so app roles live in Lakebase. Postgres roles are NOT used (every request reaches Postgres as the app SPN).

* Tables (migration 007): `app.app_groups (name PK, role, description, created_at)` and `app.app_group_members (group_name FK, member_id, added_by, added_at, PK(group_name, member_id))`. `member_id` is the lower-cased `x-forwarded-email` value (for SPNs this is the application id).
* Seeded groups (no per-target suffix): `semantic-ground-truth-admins` → `admin`, `semantic-ground-truth-stewards` → `steward`, `semantic-ground-truth-users` → `reviewer`.
* Role resolution: roles = union of the roles of every app group the caller belongs to, plus `reviewer` for every authenticated caller (any user with `CAN_USE` on the app is a reviewer). `admin` implies `steward`.
* Bootstrap: on startup, if `semantic-ground-truth-admins` has no members, insert every id from `GT_ADMIN_EMAILS` (comma list) and `GT_BOOTSTRAP_ADMIN_IDS` (comma list). Existing `app_config.admin_emails` / `steward_emails` remain a read-only fallback and are merged into the result.
* Guard: removing the last admin returns 409 `CONFLICT`.
* Campaign RBAC (`campaign_assignments` / `rbac_groups`) resolves against app groups, not workspace SCIM groups. Remove any SCIM `/Me` group lookup.
* App access: `grant_app_permissions.ipynb` (app bundle job) adds `CAN_USE` for the workspace `users` group additively; the M2M SPN keeps its existing `CAN_USE`. Never add a bundle `permissions` block to the app (it replaces the ACL).

## 4. Asset sources and import (REST contract)

Real assets come from existing UC metric views and from workspace Git folders. All routes are under `/api`, JSON, zod-validated, errors use the existing envelope.

| Method + path | Role | Purpose |
|---|---|---|
| `GET /api/catalog/catalogs` | steward | Catalogs visible to the caller (OBO) |
| `GET /api/catalog/schemas?catalog=` | steward | Schemas in a catalog (OBO) |
| `GET /api/catalog/metric-views?catalog=&schema=` | steward | Metric views (`table_type = 'METRIC_VIEW'`) with comment (OBO) |
| `GET /api/sources` | steward | Registered sources |
| `POST /api/sources` | steward | Register a Git folder: `{workspace_path, metric_view_glob?, glossary_glob?, display_name?}` |
| `POST /api/sources/:id/scan` | steward | List candidates: metric-view YAML files and glossary terms found under the folder |
| `POST /api/assets/import` | steward | `{metric_views: string[] (catalog.schema.name), source_id?: uuid, glossary_terms?: {source_id, file_path, term}[]}` → created/updated asset ids |
| `POST /api/campaigns` | steward | Existing route; accepts `asset_ids` from the import |
| `GET /api/admin/groups` | admin | App groups with members |
| `POST /api/admin/groups/:name/members` | admin | `{member_id}` |
| `DELETE /api/admin/groups/:name/members/:memberId` | admin | Remove (last-admin guard) |

* Table `app.asset_sources (id uuid PK, source_type 'git_folder', workspace_path, display_name, metric_view_glob default '**/*.metric_view.yml', glossary_glob default '**/semantics/**/*.md', created_by, created_at, last_scanned_at)`; `app.assets` gains `source_id uuid NULL` and `source_metadata jsonb NULL` (migration 007, `ADD COLUMN IF NOT EXISTS`).
* Metric view import: read the definition with `DESCRIBE TABLE EXTENDED <fqn> AS JSON` using the caller's OBO token, parse with the existing `parseMetricViewYaml`, create one `measure` / `dimension` asset per field through `AssetRegistry` (existing naming + `version_hash`). If `source_id` is given and a file under the folder matches the metric view name (`<name>.metric_view.yml` / `.yaml`, or YAML whose file stem equals the view name), set `repo_url` = the Git folder path and `fixture_path` = the file path relative to it.
* Workspace files are read with the **app SPN** (`w.workspace.export` / list). The app SPN needs `CAN_READ` on each registered folder; on 403 return `FORBIDDEN` with the message `Grant CAN_READ on <path> to the app service principal <id>`.

## 5. Glossary (Page candidate) markdown format

This version reads Page candidates only from repo markdown, never from an API. Parser rules (match both `docs/semantics/01_ground_truth_app_core_terms.md` and `wanderBricksSemantics-care/rapid-ontology-standup/semantics/*.md`):

* File-level domain: first match of `## Domain: <x>` or `**Domain:** <x>`; subdomain: `**Subdomain:** <x>`.
* Each `### <Term>` heading starts a term; it ends at the next `###`/`##` heading or `---`.
* Fields are bullets `- **<Label>:** <text>` with labels `Definition` (required; skip the term without it), `Business Context`, `Data Usage`, `Related Terms` (comma list), `Source`.
* Mapping: `asset_type='page'`, `name`=term, `description`=Definition, `plain_english_logic`=Business Context, `domain`/`subdomain` from the file, `source_metadata`={data_usage, related_terms[], source, file_path, heading_line}, `version_hash` over the term block text.

## 6. Lakebase CDF

* Requirements: every table in `app` has `REPLICA IDENTITY FULL` (migration 007 sets it for all existing tables, and the migration runner re-applies it after every run so future tables are covered). Empty tables are not captured until they have a row.
* Config parent is the **database** resource (`.../databases/ground-truth-app`), not the branch. Source = Postgres schema `app`; destination = `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth`. Destination tables are `lb_<table>_history`.
* Never enable Delta CDF, row filters, or masks on `lb_*_history`.
* A source schema change triggers a full re-snapshot of that history table; recovery is a full refresh of that table's flow in the bronze pipeline.

## 7. Bronze table (confirmed schema)

One streaming table `bronze_lakebase_cdf` in the existing schema, `CLUSTER BY (_source_table)`, one append flow per `lb_*_history` table that exists at graph-build time (tables listed in `ground-truth-infra/fixtures/pipelines/cdf_bronze_tables.yaml` but not yet created are skipped and logged).

| Column | Type | Source |
|---|---|---|
| `_source_table` | STRING | Postgres table name, e.g. `votes` |
| `_source_history_table` | STRING | Full UC name of the `lb_*_history` table |
| `_record_key` | STRING | PK columns from the YAML `keys`; UUID/BINARY → lower-case 8-4-4-4-12 text; composite keys joined with `\|` in YAML order |
| `_pg_change_type` | STRING | CDF |
| `_pg_lsn` | BIGINT | CDF |
| `_pg_xid` | INT | CDF |
| `_timestamp` | TIMESTAMP_NTZ | CDF |
| `_sort_by` | BIGINT | CDF ordering key |
| `_ingested_at` | TIMESTAMP | `current_timestamp()` |
| `data` | VARIANT | `to_variant_object(struct(* EXCEPT (CDF columns)))` — every source data column, including raw `id` |

Keys: `id` for assets, asset_versions, asset_synonyms, votes, example_questions, feedback_batches, campaigns, notifications, asset_sources, `_migrations`; `asset_id` for confidence_scores; `user_id` for user_activity; `key` for app_config; `session_id` for mcp_sessions; `name` for app_groups; composites: synonym_votes (synonym_id, user_id), example_question_votes (question_id, user_id), campaign_assignments (campaign_id, user_id), campaign_assets (campaign_id, asset_id), notification_preferences (user_id, event_type), app_group_members (group_name, member_id).

No filtering in bronze (pre-images kept). Silver is out of scope for this build.

SDP style: `from pyspark import pipelines as dp`; `dp.create_streaming_table(...)` + `@dp.append_flow(target=...)` per source; `spark.readStream.table(...)`; metadata-driven (YAML in `fixtures/`, logic in a reusable class under `src/lib/`, the pipeline source file only reads config and calls the class). Never `import dlt`.

## 8. Metric views over bronze

Metric view YAML `source` is a SQL query over `bronze_lakebase_cdf` that filters `_source_table`, extracts typed columns (`data:col::type`), and — for state tables — keeps the latest non-deleted row: `WHERE _pg_change_type <> 'update_preimage' QUALIFY row_number() OVER (PARTITION BY _record_key ORDER BY _sort_by DESC) = 1` then exclude `delete`. Event tables (votes) use inserts only. Fixtures live in `ground-truth-infra/fixtures/metric_views/` and are deployed by the infra `metric_view_deploy` job. Column names must match migrations 001–007 exactly (e.g. votes: `id`, `user_id`, `feedback`; no `vote_id`/`reviewer_id`).

## 9. Calling the app from jobs and gates

Apps accept only OAuth tokens. Jobs that call the app use the M2M SPN: `WorkspaceClient(host, client_id, client_secret)` from the secret scope and `config.authenticate()` headers, `allow_redirects=False`. A 302 means missing `CAN_USE` or a non-OAuth token. Verified 2026-10-22: `/health`, `/api/me`, `/api/campaigns`, `POST /mcp initialize` all return 200 with this pattern. The job's own identity is redirected even with `CAN_MANAGE`.

The M2M SPN's application id is passed to the app as `GT_BOOTSTRAP_ADMIN_IDS` through an app `secret` resource (scope `semantic_ground_truth_credentials`, key `m2m_client_id_dev`) so it becomes an admin without hard-coding the id.

## 10. Demo data (dev only)

Source of real assets for the dev build: Git folder `/Workspace/Users/matthew.giglia@databricks.com/wanderBricksSemantics-care` (metric view YAML under `wb-metric-views/*.metric_view.yml`, glossary under `rapid-ontology-standup/semantics/*.md`) and UC schema `hls_fde_dev.dev_matthew_giglia_wb_metric_views_care` (10 metric views). The app bundle job `demo_campaign_seed` grants the minimum access, imports, creates one campaign and casts votes — idempotently.
