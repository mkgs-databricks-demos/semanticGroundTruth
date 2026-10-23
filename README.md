# Semantic Ground Truth App

A crowdsourced validation platform for Unity Catalog semantic assets. Business users review metric view measures, dimensions, UC Pages, Domains, and Subdomains through a Tinder-style card-swipe UX — accessible as a standalone Databricks App and as an MCP App rendered natively in Genie One chat.

Crowdsourced feedback flows through an automated Genie Code pipeline that proposes edits to the source-of-truth YAML fixtures in the owning DAB repo, closing the loop from business validation back to governed code.

## Architecture

The system consists of **9 components** deployed across **3 Declarative Automation Bundles**:

| Bundle | Directory | Components |
|--------|-----------|------------|
| **Infra** | `ground-truth-infra/` | C1 Asset Registry (Lakebase), C6 Feedback Pipeline (Lakeflow Jobs + Genie Code) |
| **App** | `ground-truth-app/` | C2 Review Engine, C3 Card UI (React), C4 MCP Server, C5 Campaign Manager, C7 Notification Service, C8 Executive Dashboard |
| **Agent** | `ground-truth-agent/` | C9 Operational Genie Agent (metric views over Lakebase CDF) |

Deploy order: **infra → app → agent** (agent can parallel with app).

### Technology Stack

- **Backend:** Node.js (Databricks AppKit)
- **Frontend:** React with framer-motion card-swipe UX
- **Database:** Lakebase (Postgres) — app state; CDF replicates to Delta for analytics
- **Auth:** Hybrid OBO (user reads) + Service Principal (app writes)
- **Confidence scoring:** Wilson score interval with configurable industry standard prior
- **MCP:** Streamable HTTP via `@modelcontextprotocol/server` v2; Unity Gateway MCP Service
- **Observability:** OpenTelemetry → UC tables (logs, metrics, spans) + MLflow 3 experiment for agent traces
- **Compliance:** HIPAA (AWS us-east-1)

## Design Documents

All design artifacts are in `docs/`:

| Layer | Path | Description |
|-------|------|-------------|
| L100 | `docs/design/L100_semantic_ground_truth_app.md` | System-level constitution |
| L200 | `docs/design/L200-C[1-9]_*.md` | Component designs (9 documents) |
| L300 | `docs/design/L300-[01-16]_*.md` | Implementation specs (16 documents) |
| Research | `docs/research/` | UC Semantics API surface, Wilson score + Lakebase CDF, Genie Code workflow tasks, DAB secrets/job_runs/MCP |
| Semantics | `docs/semantics/` | Core terminology definitions |
| Pitch | `docs/pitch/` | Customer pitch, SOW timing estimates, HIPAA compliance matrix |
| Diagrams | `docs/diagrams/` | 13 diagrams (Mermaid source + SVG + interactive HTML) |

## Getting Started

Each bundle is an independent DAB with its own `databricks.yml`:

```bash
# Deploy infra first
cd ground-truth-infra
databricks bundle deploy --target dev

# Then the app
cd ../ground-truth-app
databricks bundle deploy --target dev

# Then the agent (can parallel with app)
cd ../ground-truth-agent
databricks bundle deploy --target dev
```

## Targets

| Target | Catalog | Mode |
|--------|---------|------|
| `dev` | `hls_fde_dev` | Development (default) |
| `prod` | `prod_ground_truth` | Production |

> **Note:** L300-01 originally proposed `dev_ground_truth` as the dev catalog. Actual workspace convention uses `hls_fde_dev`. DAB dev mode auto-prefixes schema names with `dev_<user>_`.

## Current Status

| Bundle | Status | Branch |
|--------|--------|--------|
| **Infra** (Bundle 1) | ✅ **Deployed to dev** — CDF configured, bronze pipeline running (21 flows), 7 metric views deployed | `mg-genie-agent-build` |
| **App** (Bundle 2) | ✅ **Deployed to dev** — RBAC, asset import, MCP server, demo campaign seeded | `mg-genie-agent-build` |
| **Agent** (Bundle 3) | ✅ **Deployed to dev** — Genie space with 9 data sources, verification passing | `mg-genie-agent-build` |

All bundles deployed and converged in `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth`. Key resources:

* **App:** `dev-semantic-ground-truth` (Node.js AppKit + React + MCP Server, stable with probes)
* **Data plane:** Lakebase CDF → `bronze_lakebase_cdf` (281 rows, 13 sources) → 7 metric views
* **Agent:** `[dev matthew_giglia] Ground Truth Operations` Genie space (9 data sources, 9/9 example SQLs)
* **Jobs:** `setup_lakebase_cdf`, `cdf_bronze` (SDP pipeline), `metric_view_deploy`, `deploy_verification`, `demo_campaign_seed`, `agent_verification`

## License

See [LICENSE](LICENSE).
