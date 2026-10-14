# Plan: App Bundle Build — ground-truth-app

**Branch:** `mg-genie-app-scaffold`
**Date:** 2026-10-14
**Prerequisite:** Scaffold complete (AppKit v0.84.0). MCP service moved from infra.
**Design sources:** L300-09 through L300-13, L200-C1 through L200-C5, L200-C7
**Blocked by:** Infra support plan (deploy.sh Phase 2, MLflow experiment) for Phase B only.
Phases A and C–I can proceed independently.

---

## Phase Overview

| Phase | Name | Type | Blocked by | Est. Sessions |
|-------|------|------|------------|---------------|
| A | Bundle Configuration | Config edits | Nothing | 1 |
| B | First Deploy + Validate | CLI | Infra support plan | 1 |
| C | Lakebase Migrations | TypeScript | Nothing (dev against localhost) | 1–2 |
| D | Auth + Middleware | TypeScript | Nothing | 1 |
| E | Review Engine Service | TypeScript | C, D | 2–3 |
| F | Campaign Manager Service | TypeScript | C, D | 1 |
| G | REST API Routes | TypeScript | D, E, F | 1 |
| H | MCP Server | TypeScript | E, G | 1–2 |
| I | React Frontend | TypeScript/React | G | 3–4 |
| J | Agents | TypeScript/Markdown | E, G | 1–2 |

---

## Phase A: Bundle Configuration

**Goal:** Make `databricks.yml` deploy-ready with proper targets and scopes.

### A1. Add dev/prod targets

Replace the `default` (localhost) target with proper `dev` and `prod` targets. Keep `default` as a third target for local `pnpm run dev`.

```yaml
targets:
  default:
    default: true
    workspace:
      host: http://127.0.0.1:7073
    variables:
      # ... local dev values (current)

  dev:
    mode: development
    workspace:
      host: https://fevm-hls-fde.cloud.databricks.com
      root_path: /Users/matthew.giglia@databricks.com/.bundle/${bundle.name}/${bundle.target}
    variables:
      # Values passed by deploy.sh --var at deploy time.
      # Placeholders here; deploy.sh overrides all of them.
      agents_serving_endpoint_name: databricks-claude-opus-4-8
      catalog: hls_fde_dev
      schema_name: dev_matthew_giglia_semantic_ground_truth
      # sql_warehouse_id, job_id, postgres_branch, postgres_database,
      # agents_mlflow_experiment_experimentId: resolved by deploy.sh

  prod:
    mode: production
    workspace:
      host: https://fevm-hls-fde.cloud.databricks.com
      root_path: /Users/matthew.giglia@databricks.com/.bundle/${bundle.name}/${bundle.target}
    run_as:
      user_name: matthew.giglia@databricks.com
    variables:
      agents_serving_endpoint_name: databricks-claude-opus-4-8
      catalog: prod_ground_truth
      schema_name: semantic_ground_truth
```

### A2. Enable user_api_scopes

Uncomment and set OBO scopes:

```yaml
user_api_scopes:
  - sql
  - genie
  - files
  - model-serving
```

Note: `apps init` listed available scopes as `sql, genie, files, model-serving`. The L300-09 design said `sql, unity-catalog, ai-gateway` but those are the old names — use the actual available scope names from the scaffold.

### A3. Comment out agents-skills resource

The `agents-skills` resource binding and `agents_skills_path` variable are optional (local skills in `server/agents/skills/` suffice). Comment them out:

```yaml
# Optional: UC volume for remote agent skills. Uncomment when needed.
# - name: agents-skills
#   uc_securable:
#     securable_full_name: ${var.agents_skills_path}
#     securable_type: VOLUME
#     permission: READ_VOLUME
```

Also remove the `agents_skills_path` variable and its target values.

### A4. Clean up .env.example

Remove the agents-skills line, update the comment header to reference ground-truth-app.

---

## Phase B: First Deploy + Validate

**Goal:** Deploy the scaffold, verify it starts, confirm MCP service registers.
**Blocked by:** Infra support plan (deploy.sh Phase 2 must be implemented).

### B1. Install dependencies

```bash
cd ground-truth-app
pnpm install
```

### B2. Build the app

```bash
pnpm run build
```

Verify `dist/` (server) and `client/dist/` (client) exist.

### B3. Deploy via deploy.sh

```bash
./deploy.sh --target dev --app
```

This runs infra var resolution, deploys app bundle with `--var` overrides, resolves app URL, updates MCP HTTP connection.

### B4. Validate

- [ ] App starts: `databricks apps get ground-truth-app` shows `RUNNING`
- [ ] Health check: `GET <app-url>/health` returns 200
- [ ] MCP service registered in Unity Gateway
- [ ] Sample Lakebase todo routes work (creates `app.todos` table)
- [ ] Agent chat responds (planner + helper round-trip)
- [ ] Record auto-provisioned SPN app ID for infra `app_role` update

---

## Phase C: Lakebase Migrations

**Goal:** Replace sample todo schema with the Ground Truth data model.
**Design source:** L200-C1 § Lakebase Schema

### C1. Create migration framework

Create `server/migrations/` with a runner that:
- Reads `app._migrations` table (tracks applied migrations)
- Runs pending `.ts` migration files in order
- Logs success/failure per migration
- Called from `server.ts` `onPluginsReady` (before route setup)

File structure:
```
server/migrations/
├── runner.ts                ← Migration executor
├── 001_core_schema.ts       ← assets, asset_versions, asset_synonyms, votes, synonym_votes
├── 002_scoring_feedback.ts   ← confidence_scores, example_questions, feedback_batches
├── 003_campaigns.ts         ← campaigns, campaign_assets, user_activity
├── 004_notifications.ts     ← notifications, notification_preferences
└── 005_indexes.ts           ← All secondary indexes
```

### C2. Migration 001 — Core schema

```sql
-- From L200-C1:
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.assets (
    asset_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type      TEXT NOT NULL CHECK (asset_type IN ('measure','dimension','page','domain','subdomain')),
    name            TEXT NOT NULL,
    description     TEXT,
    plain_english_logic TEXT,
    yaml_content    TEXT,
    repo_url        TEXT NOT NULL,
    fixture_path    TEXT NOT NULL,
    branch          TEXT NOT NULL DEFAULT 'main',
    environment     TEXT NOT NULL CHECK (environment IN ('dev','staging','production')),
    target_catalog  TEXT NOT NULL,
    target_schema   TEXT NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    version_hash    TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    confidence_score DOUBLE PRECISION DEFAULT 0.0,
    total_votes     INTEGER DEFAULT 0,
    total_approvals INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    UNIQUE (repo_url, fixture_path, environment)
);

CREATE TABLE app.asset_versions ( ... );  -- See L200-C1
CREATE TABLE app.asset_synonyms ( ... );
CREATE TABLE app.votes ( ... );
CREATE TABLE app.synonym_votes ( ... );
```

### C3. Migration 002 — Scoring + feedback

`confidence_scores`, `example_questions`, `feedback_batches` per L200-C1.

### C4. Migration 003 — Campaigns

Campaign tables per L200-C5:
```sql
CREATE TABLE app.campaigns (
    campaign_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('full_review','targeted','freshness')),
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','completed','archived')),
    scope_filter    JSONB,
    rbac_groups     TEXT[],
    freshness_interval_days INTEGER,
    completion_threshold DOUBLE PRECISION DEFAULT 0.95,
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE app.campaign_assets (
    campaign_id     UUID NOT NULL REFERENCES app.campaigns(campaign_id),
    asset_id        UUID NOT NULL REFERENCES app.assets(asset_id),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','reviewed','skipped')),
    PRIMARY KEY (campaign_id, asset_id)
);
```

### C5. Migration 004 — Notifications

`notifications`, `notification_preferences` per L200-C7.

### C6. Migration 005 — Indexes

All secondary indexes from L200-C1: `idx_assets_type`, `idx_assets_confidence`, `idx_votes_unprocessed`, etc.

### C7. Remove sample todo routes

Delete `server/routes/lakebase/todo-routes.ts` and its import from `server.ts`. Replace with migration runner call:

```typescript
async onPluginsReady(appkit) {
  await runMigrations(appkit.lakebase);
  await setupRoutes(appkit);
}
```

---

## Phase D: Auth + Middleware

**Goal:** Production-grade middleware stack.
**Design source:** L300-10 Step 6

### D1. Auth middleware (`server/middleware/auth.ts`)

Extract OBO user identity from the forwarded token. AppKit provides this via headers:
- User ID, email, display name
- Used by Review Engine to attribute votes, enforce RBAC

### D2. OTel middleware (`server/middleware/otel.ts`)

OpenTelemetry trace context propagation. AppKit's OTel plugin handles most setup; this middleware adds:
- Custom span attributes (user_id, asset_id, campaign_id)
- Request duration metrics
- Error rate counters

### D3. Error handler (`server/middleware/errorHandler.ts`)

Structured JSON error responses:
```json
{ "error": { "code": "ASSET_NOT_FOUND", "message": "...", "details": {} } }
```

### D4. Wiring

Update `server.ts` to apply middleware in order: auth → otel → routes → errorHandler.

---

## Phase E: Review Engine Service

**Goal:** Core business logic — the heart of the app.
**Design source:** L200-C2, L300-10 Step 2

### E1. Wilson score computation (`server/services/review/wilsonScore.ts`)

- `wilsonLowerBound(positive, total, z=1.96)` — core formula
- `computeConfidence(assetId, industryPrior, priorDecayThreshold)` — blended score with Bayesian prior

### E2. Surfacing algorithm (`server/services/review/surfacingAlgorithm.ts`)

- `getReviewPool(userId, campaignId?, assetType?)` — filter assets, exclude already-reviewed-by-user, weight by staleness + low-confidence
- `weightedRandomSelect(pool)` — coverage-weighted random selection (not pure deterministic sort)

### E3. Review Engine service (`server/services/review/reviewEngine.ts`)

- `getNext(userId, campaignId?, assetType?)` — delegates to surfacing algorithm
- `vote(assetId, userId, voteType, feedback?, edits?)` — record vote + recompute Wilson score
- `addSynonym(assetId, userId, action, synonym)` — add/remove synonym
- `addExample(assetId, userId, action, questionText?, questionId?)` — manage example questions
- `getStats(userId)` — user stats, leaderboard, coverage
- `runQuery(assetId, userId)` — execute sample query via OBO SQL warehouse

All methods use the Lakebase Postgres client via `appkit.lakebase.query()`.

---

## Phase F: Campaign Manager Service

**Goal:** Campaign lifecycle management.
**Design source:** L200-C5, L300-10 Step 3

### F1. Campaign Manager (`server/services/campaign/campaignManager.ts`)

- `createCampaign(name, type, scope, rbacGroups?, freshnessInterval?)` — create + populate `campaign_assets`
- `getActiveCampaigns(userId?)` — respecting RBAC groups
- `updateStatus(campaignId, status)` — pause/resume/complete/archive
- `checkCompletion(campaignId)` — auto-complete when all assets meet threshold
- `getAssetPool(campaignId)` — assets in scope

---

## Phase G: REST API Routes

**Goal:** Wire services to HTTP endpoints.
**Design source:** L200-C2 § REST API, L300-10 Step 5

### G1. Route modules

```
server/routes/
├── review.ts       ← GET /api/review/next, POST /api/review/vote, etc.
├── campaigns.ts    ← GET/POST /api/campaigns, PUT /:id/status
├── notifications.ts ← GET /api/notifications, PUT /:id/read
├── assets.ts       ← POST /api/assets/register, GET /:id, GET /reviewable
└── admin.ts        ← GET/PUT /api/admin/config, GET /leaderboard
```

### G2. Registration API (`POST /api/assets/register`)

The entry point for external DAB repos to register assets. Accepts:
```json
{
  "repo_url": "https://github.com/org/repo",
  "fixture_path": "fixtures/measures/revenue.yml",
  "target_catalog": "hls_fde_dev",
  "target_schema": "dev_matthew_giglia_semantic_ground_truth",
  "yaml_content": "...",
  "version_hash": "sha256:..."
}
```

Computes version hash, upserts into `assets` + `asset_versions`, triggers campaign inclusion.

### G3. Wiring

Replace sample todo route setup in `server.ts` with modular route registration:

```typescript
import { setupReviewRoutes } from './routes/review';
import { setupCampaignRoutes } from './routes/campaigns';
import { setupAssetRoutes } from './routes/assets';
import { setupNotificationRoutes } from './routes/notifications';
import { setupAdminRoutes } from './routes/admin';

async function setupRoutes(appkit: AppKit) {
  setupReviewRoutes(appkit);
  setupCampaignRoutes(appkit);
  setupAssetRoutes(appkit);
  setupNotificationRoutes(appkit);
  setupAdminRoutes(appkit);
}
```

---

## Phase H: MCP Server

**Goal:** Expose review tools to Genie One via MCP protocol.
**Design source:** L200-C4, L300-11

### H1. MCP tool implementations (`server/mcp/tools/`)

6 tools, each delegating to the Review Engine service:

| Tool | Maps to |
|------|---------|
| `review_get_next` | `GET /api/review/next` |
| `review_submit_vote` | `POST /api/review/vote` |
| `review_add_synonym` | `POST /api/review/synonym` |
| `review_add_example` | `POST /api/review/example` |
| `review_get_stats` | `GET /api/review/stats` |
| `review_run_query` | `POST /api/review/run-query` |

Plus campaign tools: `campaign_list`, `campaign_create`, `campaign_update_status`.
Plus metric view tools: `metric_view_list`, `metric_view_get`, `metric_view_validate`.

Tool names use the prefixes registered in the MCP service's `include_tool_selectors`: `review_*`, `campaign_*`, `metric_view_*`.

### H2. MCP transport (`server/mcp/transport.ts`)

Streamable HTTP transport mounted at `/mcp`:
- Session management (conversation_id tracking)
- OBO auth context forwarding from MCP client to Review Engine
- Uses `@modelcontextprotocol/server` v2 SDK (already in dependencies via AppKit)

### H3. MCP Apps View (`server/mcp/views/`)

Interactive card rendering for MCP Apps clients:
- `review_get_next` → structured review card with action buttons
- `review_get_stats` → stats summary with progress bar
- Fallback: plain text for non-MCP-Apps clients

### H4. Verify

```bash
npx @modelcontextprotocol/inspector http://localhost:8000/mcp
```

- [ ] `list_tools()` returns all tools with correct prefixes
- [ ] `review_get_next` returns a card
- [ ] `review_submit_vote` records a vote
- [ ] Tools match `include_tool_selectors` in MCP service resource

---

## Phase I: React Frontend

**Goal:** Replace sample pages with Ground Truth UI.
**Design source:** L200-C3, L300-12

### I1. Component library (`client/src/components/`)

| Component | Description |
|-----------|-------------|
| `ReviewCard` | Asset badge, name, description editor, synonym chips, framer-motion swipe |
| `CardStack` | Stack of cards with spring physics swipe animation |
| `SwipeActions` | Approve/Reject/Edit buttons + keyboard shortcuts (A/R/E) |
| `Leaderboard` | Top reviewers table |
| `ProgressBar` | "47 of 120 reviewed" |
| `StreakBadge` | Current review streak indicator |
| `CampaignSelector` | Dropdown for active campaigns |
| `AssetTypeFilter` | Filter by measure/dimension/page/domain/subdomain |

Use `@databricks/appkit-ui` components (already available), `framer-motion` for swipe gestures (add to dependencies), `@tanstack/react-query` for API data fetching (add to dependencies).

### I2. Page views (`client/src/pages/`)

Replace scaffold pages with:

| Page | Route | Description |
|------|-------|-------------|
| `ReviewPage` | `/` (default) | CardStack + SwipeActions + ProgressBar + campaign selector |
| `LeaderboardPage` | `/leaderboard` | Leaderboard + personal stats + team competitions |
| `AdminPage` | `/admin` | Campaign CRUD, RBAC config, thresholds, gamification |
| `StewardPage` | `/steward` | Feedback queue, conflict resolution, branch review links |
| `ExecutivePage` | `/executive` | Summary cards (coverage %, certification %, active reviewers) |

Keep the existing `AgentChat` page (under `/agents`) — it's useful for the built-in agent UI.

### I3. Navigation + auth

Update `App.tsx`:
- Role-based route visibility (admin, steward, reviewer)
- Theme toggle (light/dark — already wired via `next-themes`)
- React Query provider wrapping all routes

### I4. Dependencies to add

```bash
pnpm add framer-motion @tanstack/react-query
```

---

## Phase J: Agents

**Goal:** Replace sample agents with Ground Truth–specific agent composition.
**Design source:** New (not in L300 specs — AppKit agents plugin is newer than the original design).

### J1. Review Assistant agent (markdown)

Replace `server/agents/planner/agent.md` with a review assistant that:
- Helps users understand assets under review
- Explains confidence scores and Wilson scoring
- Provides context on why an asset was surfaced
- Delegates to sub-agents for actions

### J2. Review Worker agent (code-defined)

Replace `server/agents/helper/agent.ts` with tools that wrap the Review Engine:
- `get_next_card` — fetch next review card
- `submit_vote` — approve/reject/edit
- `get_my_stats` — user's review stats
- `explain_asset` — describe what an asset does in plain English

### J3. Skills

Keep `tracer-bullets` skill (useful for planning conversations). Add:
- `review-guide` — how to evaluate UC semantic assets
- `scoring-model` — how Wilson scoring works, what confidence thresholds mean

---

## Execution Strategy

### Immediate next (can start now, no blockers)

1. **Phase A** — bundle config edits (one session)
2. **Phase C** — Lakebase migrations (develop against `pnpm run dev` localhost + local Lakebase)
3. **Phase D** — middleware stack

### After infra support plan completes

4. **Phase B** — first deploy to verify the scaffold end-to-end

### Main build sequence

5. **Phase E** → **Phase F** → **Phase G** (backend services → routes)
6. **Phase H** (MCP server, once routes exist)
7. **Phase I** (frontend, once routes exist — can parallelize with H)
8. **Phase J** (agents, once services exist)

### Post-deploy cleanup (after Phase B succeeds)

- Delete infra deprecated MCP file
- Update infra `app_role` to SERVICE_PRINCIPAL
- Enable Lakebase CDF for all app tables (Lakebase UI)

---

## Decisions to Make During Build

| # | Phase | Question | When to decide |
|---|-------|----------|---------|
| 1 | C | Migration runner: custom or use an existing library (e.g., `node-pg-migrate`)? | Phase C start |
| 2 | E | Wilson z-value: keep 1.96 (95% CI) or make configurable? | Phase E start |
| 3 | E | Surfacing: pure random-weighted or add time-decay bias? | Phase E start |
| 4 | H | MCP SDK: use AppKit's built-in MCP support or standalone `@modelcontextprotocol/server`? | Phase H start |
| 5 | I | State management: React Query only, or add Zustand/Jotai for client state? | Phase I start |
| 6 | I | Card swipe: framer-motion `useDragControls` or `useGesture` from `@use-gesture/react`? | Phase I start |
| 7 | J | Agent architecture: single agent with tools, or multi-agent (planner + worker)? | Phase J start |
