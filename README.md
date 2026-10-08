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
- **Observability:** OpenTelemetry → MLflow 3 experiment
- **Compliance:** HIPAA (AWS us-east-1)

## Design Documents

All design artifacts are in `docs/`:

| Layer | Path | Description |
|-------|------|-------------|
| L100 | `docs/design/L100_semantic_ground_truth_app.md` | System-level constitution |
| L200 | `docs/design/L200-C[1-9]_*.md` | Component designs (9 documents) |
| L300 | `docs/design/L300-[01-16]_*.md` | Implementation specs (16 documents) |
| Research | `docs/research/` | UC Semantics API surface, Wilson score + Lakebase CDF |
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
| `dev` | `dev_ground_truth` | Development (default) |
| `prod` | `prod_ground_truth` | Production |

## License

See [LICENSE](LICENSE).
