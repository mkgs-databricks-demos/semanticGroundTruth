# L100 — Semantic Ground Truth App

## System-Level Design Document (Constitution)

**Version:** 0.1 (Draft)
**Date:** 2026-09-29
**Author:** Matt Giglia
**Status:** Draft — pending review

---

### Executive Summary

The Semantic Ground Truth App is a crowdsourced validation platform for Unity Catalog semantic assets. It decomposes metric view measures, dimensions, UC Pages, Domains, and Subdomains into atomic review tasks that business users judge via a Tinder-style card-swipe UX — accessible both as a standalone Databricks App and as an MCP App rendered natively in Genie One chat. Crowdsourced feedback flows through an automated Genie Code pipeline that proposes edits to the source-of-truth YAML fixtures in the owning DAB repo, closing the loop from business validation back to governed code.

> See [docs/design/semantic-ground-truth-app-ideation.md] for the full ideation capture.

---

### System Context

This system sits at the intersection of three Databricks capabilities:

1. **UC Semantics** — Metric Views, Pages, Domains, Subdomains (the assets being validated)
2. **Databricks Apps + MCP Apps** — The dual-interface runtime (standalone app + Genie One embedded)
3. **Declarative Automation Bundles** — The GitOps backbone for fixture YAML versioning and CI/CD deployment

The app does NOT own the semantic assets themselves — it is a validation and feedback layer that reads from and proposes changes to the DAB repos that own those assets.

---

### Component Inventory

The system consists of **9 components**, each of which will have its own L200 design document.

| # | Component | Type | Description |
|---|---|---|---|
| C1 | **Asset Registry** | Lakebase tables | Tracks all UC semantic assets, their owning DAB repos, fixture paths, versions, and environment mappings |
| C2 | **Review Engine** | Node.js AppKit service | Smart surfacing algorithm, vote collection, confidence scoring (Wilson score interval) |
| C3 | **Card UI** | React components | Card-swipe interface, synonym chips, accordion, "Use It in a Sentence", gamification |
| C4 | **MCP Server** | MCP TypeScript SDK + MCP Apps | Exposes review tools over MCP protocol; renders interactive card View in Genie One |
| C5 | **Campaign Manager** | Node.js service + Lakebase | Automatic, manual, and freshness campaign lifecycle; RBAC assignment |
| C6 | **Feedback Pipeline** | Lakeflow Job + Genie Code task | Daily collection of votes/edits → feature branch creation → Data Steward notification |
| C7 | **Notification Service** | Pluggable destinations | In-app, Slack, Microsoft Teams via Databricks notification destinations |
| C8 | **Executive Dashboard** | AI/BI Dashboard or React views | Coverage %, confidence trends, participation rates, time-to-certification |
| C9 | **Operational Genie Agent** | Genie Agent (UC Metric Views + curated instructions) | Conversational analytics on app usage, ROI, top reviewers, coverage gaps — backed by metric views over the app's own Lakebase data |

---

### Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend runtime | Node.js (Databricks AppKit) | Required stack for all Databricks Apps |
| Frontend framework | React | Card-swipe UX, component reusability, MCP Apps View rendering |
| Database | Lakebase (Postgres) | App state (votes, campaigns, scores, user activity); copy-on-write branching for dev/test/prod |
| Auth model | Hybrid OBO + Service Principal | OBO for reading UC assets (respects user permissions); SP for writing app state to Lakebase |
| MCP transport | Streamable HTTP (`@modelcontextprotocol/server` v2 + `@modelcontextprotocol/node`) | Node.js MCP TypeScript SDK; Streamable HTTP transport; registered as Unity Gateway connection + served as Unity Gateway MCP Service |
| MCP registration | Unity Gateway connection in target catalog.schema | Co-located with app's supporting tables (Lakebase CDF); no `mcp-` prefix naming required; discovered via Unity Gateway, not name convention |
| Confidence scoring | Wilson score interval | Well-understood, naturally handles small sample sizes, configurable prior |
| Metric view source of truth | Fixture YAMLs in DAB repo `fixtures/` folder | GitOps; environment-aware deployment via forEach task |
| Deployment | Three-bundle DAB pattern | Bundle 1: infra; Bundle 2: app; Bundle 3: Genie Agent (can parallel with Bundle 2) |
| Observability | OpenTelemetry (logs, metrics, traces) | Required for all apps; traces to MLflow 3 experiment |
| Notifications | Databricks notification destinations | Pluggable: Slack (webhook or Genie App), Teams (Genie App), generic webhook |
| Secrets | UC Secrets (`catalog.schema.secret`) | Three-level namespace, governed by UC privileges, cross-workspace; DBR 17.3+ or serverless env v4+ |
| SQL Warehouse | Serverless SQL Warehouse | For metric view queries, sample aggregations, and Genie Agent compute |
| Genie Code prompts | Unity Gateway skills library | Feedback loop prompts versioned as custom Genie Code skills; reusable across deployments |

---

### Cross-Cutting Patterns

#### Authentication & Authorization

**Dual auth model** — the app uses two authentication contexts simultaneously:

- **OBO (User Authorization):** For all reads against UC catalogs — metric view queries, sample aggregations, entity store reads. This ensures the user only sees assets they have permission to access. The forwarded user token is scoped to the workspace where the app runs.
- **Service Principal (App Authorization):** For all writes to Lakebase — votes, feedback, campaign state, confidence scores, gamification data. The app's dedicated SP has full access to its Lakebase project.

**RBAC for campaigns:** Campaign assignment optionally restricts which users see which assets. Default is all users see all assets. RBAC groups are mapped from workspace identity.

#### Observability

All components emit telemetry via OpenTelemetry:

- **Traces:** Every vote, card render, MCP tool call, and feedback pipeline run is traced end-to-end. Traces flow to an MLflow 3 experiment for analysis.
- **Metrics:** Vote throughput, coverage velocity, confidence score distributions, surfacing algorithm hit rates, MCP App render latency.
- **Logs:** Structured JSON logs for all API calls, Genie Code task outputs, notification delivery.

#### Error Handling

- **Graceful degradation:** If a sample query fails (e.g., warehouse unavailable), the card still renders with all other fields — the validation button shows an error state, not a broken card.
- **MCP fallback:** If MCP Apps rendering fails, fall back to text-based review flow. The MCP server always supports both modes.
- **Feedback pipeline resilience:** If the Genie Code task fails to generate a valid feature branch, the feedback is retained in Lakebase and retried on the next run. Failed items are surfaced to the Data Steward.

#### Security

- **No data leaves the workspace:** All processing happens within the Databricks workspace. Lakebase stores only metadata (votes, descriptions, synonyms) — never raw data from source tables.
- **Audit trail:** Every vote is attributed to a specific user (via OBO identity) with timestamp, asset version, and session context. Immutable in Lakebase.
- **UC permissions enforced:** The app cannot show a user an asset they don't have permission to see in UC. OBO auth ensures this automatically.

---

### Interface Contracts

#### C1 (Asset Registry) ↔ C2 (Review Engine)

The Asset Registry provides the Review Engine with the pool of reviewable assets:

```
GET /api/assets/reviewable
  → { assets: [{ asset_id, asset_type, name, description, synonyms[],
       yaml_content, plain_english_logic, example_queries[],
       repo_url, fixture_path, branch, version, environment,
       review_count, confidence_score }] }
```

#### C2 (Review Engine) ↔ C3 (Card UI) / C4 (MCP Server)

Both interfaces consume the same Review Engine API:

```
GET  /api/review/next          → { card: ReviewCard }
POST /api/review/vote          → { asset_id, vote: approve|reject, feedback?, edits? }
POST /api/review/synonym       → { asset_id, action: add|remove, synonym }
POST /api/review/example       → { asset_id, action: add|approve|reject, question_text }
GET  /api/review/stats         → { user_stats, leaderboard, coverage }
POST /api/review/run-query     → { asset_id } → { query_result }
```

The MCP Server (C4) wraps these as MCP tools:
- `get_next_review_card` → `GET /api/review/next`
- `submit_vote` → `POST /api/review/vote`
- `add_synonym` → `POST /api/review/synonym`
- `add_example_question` → `POST /api/review/example`
- `get_review_stats` → `GET /api/review/stats`
- `run_validation_query` → `POST /api/review/run-query`

#### C2 (Review Engine) ↔ C6 (Feedback Pipeline)

The Feedback Pipeline reads accumulated votes from Lakebase:

```sql
SELECT * FROM ground_truth.votes
WHERE processed = FALSE
  AND vote_type IN ('reject', 'edit')
ORDER BY created_at;
```

After processing, marks votes as processed and records the feature branch URL.

---

### Multi-Environment Architecture

The app is a **single production deployment** that reads from multiple UC environments:

| Scenario | Catalog Target | Data Requirement |
|---|---|---|
| Candidate validation (post-feedback) | Staging/UAT catalog | Production-quality data required |
| Freshness resurfacing | Production catalog | Actual production data |
| Sample query execution | Environment-specific | Matches the asset's current deployment target |

**Prerequisites:**
- Staging/UAT must have production-quality data (ideally actual production data or close replica)
- App service principal needs cross-catalog read access to dev/staging/UAT
- Every UC semantic element is traceable to a specific DAB + repo (GitOps lineage)

---

### Metric View Deployment Pipeline

> See [docs/diagrams/mermaid/01_mv_deployment_pipeline.md] for the visual flow.

1. Metric view YAMLs live in `fixtures/` folder of the owning DAB repo
2. A **forEach task** iterates over all YAML files
3. Each iteration runs a **notebook task** parameterized with target catalog, schema, and environment-specific source table references
4. The notebook generates `CREATE OR REPLACE VIEW ... WITH METRICS LANGUAGE YAML` SQL
5. Source table references are resolved based on the deployment target environment
6. The app reads parsed YAML from the repo fixtures — not from live UC `DESCRIBE` calls

---

### Feedback Loop Pipeline

> See [docs/diagrams/mermaid/02_feedback_loop.md] for the visual flow.

1. **End-of-day Lakeflow Job** queries Lakebase for unprocessed rejections and edits
2. **Genie Code task** receives the feedback batch + current fixture YAML content
3. Genie Code generates proposed YAML edits based on feedback context
4. **Creates a feature branch** in the owning DAB repo with the proposed changes
5. **Notification** sent to Data Steward (Slack/Teams/in-app) with branch link
6. Data Steward reviews in dev → promotes to staging/UAT → re-enters voting pool
7. Certified changes promoted to production → freshness clock resets

---

### Dual Interface Architecture

#### Standalone App (Primary)

Full React application deployed as a Databricks App:
- Card-swipe UI with all progressive disclosure features
- Admin configuration panels (campaigns, RBAC, gamification, thresholds)
- Data Steward triage queue and conflict resolution
- Executive dashboards
- Gamification leaderboards and progress tracking

#### MCP Server (Conversational)

Hosted as a Databricks App, registered as a **Unity Gateway connection** in the same target catalog and schema as the app's supporting tables (e.g., Lakebase CDF tables), then served as a **Unity Gateway MCP Service**:

- No `mcp-` prefix naming requirement — the app is discovered via its Unity Gateway registration, not by name convention
- Exposes 6 MCP tools (see Interface Contracts above)
- **MCP Apps interactive View** renders the card-swipe UI directly in Genie One chat (pre-private preview access — product enabling in Matt's FEVM)
- Governed through Unity Gateway — access control, service policies, and audit via Unity Catalog grants
- OBO auth preserved — votes attributed to the actual user
- Text-based fallback for clients without MCP Apps support
- The headline UX: a user in Genie One says "I want to review some UC semantics" → a review card appears inline in chat

Both interfaces share the same Review Engine (C2), Lakebase state, and surfacing algorithm.

---

### Lakebase Schema (High-Level)

The Lakebase project contains the following core tables (detailed schema in L200-C1):

| Table | Purpose |
|---|---|
| `assets` | Registry of all UC semantic assets under review |
| `asset_versions` | Version history for each asset (tracks fixture YAML changes) |
| `votes` | Individual votes (approve/reject) with user, timestamp, feedback |
| `synonym_votes` | Synonym add/remove votes |
| `example_questions` | Crowdsourced "Use It in a Sentence" examples with votes |
| `campaigns` | Campaign definitions (automatic, manual, freshness) |
| `campaign_assignments` | RBAC group → campaign mappings |
| `user_activity` | Gamification state (streaks, badges, review counts) |
| `confidence_scores` | Current Wilson score per asset (materialized for fast reads) |
| `feedback_batches` | Processed feedback batches with feature branch URLs |
| `notifications` | Notification delivery log |

---

### Deployment Architecture

> See [docs/diagrams/mermaid/03_deployment_architecture.md] for the visual layout.

#### Deployment Ordering and Circular Dependency Resolution

The Genie Agent (C9) creates a circular dependency: it reads from Lakebase tables populated by the app (Bundle 2), but the app wants to use the agent as a resource. DABs do not support cross-bundle `depends_on` or native `post_deploy` hooks — ordering must be modeled in CI/CD.

**Resolution: runtime dependency, not deployment dependency.** The app does not fail if the Genie Agent doesn't exist yet — it gracefully degrades (executive dashboard works without conversational analytics). The agent doesn't need the app running to be deployed — it only needs the Lakebase schema and metric views to exist (from Bundle 1). Therefore:

- Bundle 1 → Bundle 2 is a **deployment dependency** (app needs infra)
- Bundle 1 → Bundle 3 is a **deployment dependency** (agent needs metric views + warehouse)
- Bundle 2 ↔ Bundle 3 is a **runtime dependency** (app uses agent; agent reads app's data) — resolved by deploying both after Bundle 1, in any order, with post-deploy validation

#### Bundle 1 (Infra) — Deployed first

- Lakebase project + environment branches (production, dev, test)
- UC schemas for app metadata
- UC Secrets (`catalog.schema.secret`) for sensitive configuration (API keys, webhook tokens)
- SQL Warehouse provisioning (for metric view queries, sample aggregations, Genie Agent compute)
- Lakeflow Jobs (feedback pipeline, freshness resurfacing)
- Notification destination configuration (Slack, Teams, webhook)
- Unity Gateway connection registration (for MCP Service)
- Genie Code custom skills (feedback loop prompts, versioned in the Unity Gateway skills library)
- Metric views over Lakebase operational data (for C9 Genie Agent — deployed here so both Bundle 2 and 3 can reference them)

#### Bundle 2 (App) — Deployed after Bundle 1

- Initialized via `databricks apps init` with plugins: Lakebase, OpenTelemetry, Data API
- Node.js AppKit backend (Review Engine + Campaign Manager + Notification Service)
- React frontend (Card UI + Admin + Executive Dashboard)
- MCP Server co-hosted in the same app, registered as a Unity Gateway connection in the target catalog.schema, served as a Unity Gateway MCP Service
- **Post-deploy job** (`post_deploy_validation`): grants app SP permissions, validates Lakebase connectivity, seeds initial data, registers MCP service — modeled as a DAB job resource run via `databricks bundle run` in CI/CD after deploy

#### Bundle 3 (Genie Agent) — Deployed after Bundle 1 (parallel with Bundle 2)

- Operational Genie Agent (C9) for executive/admin conversational analytics
- References metric views deployed in Bundle 1
- Curated instructions and example questions for the agent
- Agent mode with OBO — executives query the agent conversationally, UC permissions enforced
- SQL Warehouse from Bundle 1 used as the agent's compute

#### CI/CD Orchestration (GitHub Actions or equivalent)

```
Bundle 1 validate → Bundle 1 deploy → Bundle 1 post_deploy_validation
                                              |
                              +---------------+---------------+
                              |                               |
                    Bundle 2 deploy                 Bundle 3 deploy
                              |                               |
                    Bundle 2 post_deploy            Bundle 3 post_deploy
                              |                               |
                              +---------------+---------------+
                                              |
                                    Integration validation
```

---

### L200 Component Map

Each L200 is independently assignable and references this L100 for cross-cutting patterns:

| L200 | Component | Key Design Questions |
|---|---|---|
| **L200-C1** | Asset Registry | Discovery mechanism, repo mapping, version tracking, environment resolution |
| **L200-C2** | Review Engine | Wilson score formula, surfacing algorithm implementation, vote aggregation |
| **L200-C3** | Card UI | React component library, swipe gestures, progressive disclosure, responsive design, mobile |
| **L200-C4** | MCP Server | MCP Apps View rendering, tool definitions, Genie One integration, fallback modes |
| **L200-C5** | Campaign Manager | Campaign lifecycle, auto-trigger rules, freshness intervals, RBAC mapping |
| **L200-C6** | Feedback Pipeline | Genie Code task design, feature branch generation, retry logic, batch processing |
| **L200-C7** | Notification Service | Destination configuration, message templates, delivery tracking |
| **L200-C8** | Executive Dashboard | KPI definitions, visualization design, drill-down paths |
| **L200-C9** | Operational Genie Agent | Metric views over Lakebase operational data (votes, users, coverage, confidence, campaigns); Genie Agent curated instructions; example questions; domain/subdomain organization for the app's own semantics |

---

### Operational Standards

#### SLAs

| Metric | Target |
|---|---|
| Card render latency (standalone app) | < 500ms p95 |
| Card render latency (MCP Apps View) | < 2s p95 (includes MCP round-trip) |
| Vote submission | < 200ms p95 |
| Sample query execution | < 30s p95 (depends on warehouse) |
| Feedback pipeline (end-of-day) | Completes within 1 hour of trigger |
| Notification delivery | < 5 minutes from trigger event |

#### Alerting

- Feedback pipeline failure → immediate alert to Data Steward + Admin
- Confidence score regression (score drops after re-vote) → alert to Data Steward
- Coverage stall (no new reviews in 48 hours) → nudge notification to reviewers
- MCP Apps rendering failure rate > 5% → alert to Admin

---

### Diagram References

The following diagrams support this L100 (to be created in `docs/diagrams/mermaid/`):

| # | Diagram | Type | Description |
|---|---|---|---|
| 01 | Metric View Deployment Pipeline | Sequence | forEach task → notebook → CREATE VIEW flow |
| 02 | Feedback Loop Pipeline | Sequence | Votes → Genie Code → feature branch → promotion → re-vote |
| 03 | Deployment Architecture | Architecture | Three-bundle DAB layout with Lakebase branching + CI/CD orchestration |
| 04 | Data Flow | Flow | End-to-end data flow across all 9 components |
| 05 | Auth Model | Architecture | OBO + SP dual auth with UC permission enforcement |
| 06 | Card Lifecycle | State/Flow | Asset → surfacing → review → vote → feedback → re-deploy |
| 07 | Component Topology | Architecture | How C1–C9 connect to each other — the system map. Every L200 references this. |
| 08 | Dual Interface Architecture | Architecture | Standalone App + MCP Server sharing the Review Engine (C2); shows how both surfaces consume the same API |
| 09 | Multi-Environment Read Pattern | Architecture | App reading staging/UAT for candidate validation vs. production for freshness resurfacing |

**Deferred to L200 diagrams:**
- Smart Surfacing Algorithm flowchart → L200-C2
- Confidence Scoring evolution (Wilson score with prior decay) → L200-C2
- Campaign Lifecycle state diagram → L200-C5
- Lakebase ER diagram → L200-C1

---

### Appendix: DAIS 2026 Customer Validation

The Genie Ontology DAIS 2026 Customer Feedback Synthesis (40+ customer conversations) validates this system's problem space. The #1 customer ask was "Where do I edit it?" — a visible curation UI for the ontology. This system directly addresses recommendations #1 (visible curation UI), #5 (transparency), #6 (cold-start via crowdsourced validation), and #8 (deduplication/conflict detection) from that synthesis.
