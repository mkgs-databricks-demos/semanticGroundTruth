# Semantic Ground Truth App — Statement of Work & Timing Estimates

---

## SOW Option A: Greenfield Build (Dedicated FDE Engagement)

### Engagement Summary

**Scope:** Full design, development, and deployment of the Semantic Ground Truth App as a custom Databricks Application for a single customer, including all 9 components, three-bundle DAB deployment, MCP Apps integration, and operational Genie Agent.

**Team:** 1–2 dedicated Forward Deployed Engineers (FDEs)
**Customer involvement:** Data Steward (part-time), 5–10 business SMEs for UAT, IT/Platform team for workspace access

### Phase Breakdown

| Phase | Duration | FDE Effort | Deliverables |
|---|---|---|---|
| **1. Discovery & Design** | 1 week | 40 hrs | L100 system design, customer-specific requirements, data model review, environment mapping |
| **2. Bundle 1 (Infra)** | 1.5 weeks | 60 hrs | Lakebase project + schema, UC Secrets, SQL Warehouse, Lakeflow Jobs, metric views, Unity Gateway connection, Genie Code skills |
| **3. Bundle 2 (App Core)** | 3 weeks | 120 hrs | Node.js AppKit backend (Review Engine, Campaign Manager, Notification Service), REST API, Lakebase integration |
| **4. Bundle 2 (MCP Server)** | 1 week | 40 hrs | MCP TypeScript SDK integration, 6 MCP tools, MCP Apps View rendering, Unity Gateway MCP Service registration |
| **5. Bundle 2 (React Frontend)** | 2 weeks | 80 hrs | Card-swipe UI (framer-motion), synonym chips, accordion, "Use It in a Sentence", admin panels, executive summary, gamification |
| **6. Bundle 3 (Genie Agent)** | 0.5 weeks | 20 hrs | Operational Genie Agent, 4 metric views, curated instructions, example questions, benchmarking |
| **7. Feedback Pipeline** | 1 week | 40 hrs | End-of-day Lakeflow Job, Genie Code task integration, feature branch creation, notification delivery |
| **8. Integration & UAT** | 1.5 weeks | 60 hrs | End-to-end testing, business user UAT, performance tuning, bug fixes |
| **9. Production Deployment** | 0.5 weeks | 20 hrs | Production bundle deployment, CI/CD pipeline setup (GitHub Actions), monitoring configuration, handoff documentation |
| **10. Hypercare** | 1 week | 20 hrs | Post-launch support, issue resolution, Data Steward training, first feedback pipeline run |

### Total Estimate

| Metric | Estimate |
|---|---|
| **Total duration** | **12–13 weeks** (approximately 3 months) |
| **Total FDE effort** | **500 hours** (~12.5 FDE-weeks) |
| **FDE headcount** | 1 FDE (sequential) or 2 FDEs (parallel phases 3–5 in ~8 weeks total) |
| **Customer effort** | ~40 hours (Data Steward: 20 hrs design + UAT; SMEs: 20 hrs UAT) |

### Assumptions

- Customer has an existing Databricks workspace with Unity Catalog enabled
- Customer has or will create metric views / UC Pages to validate (or the Rapid Ontology Standup is run first — see SOW Option B add-on)
- Staging/UAT environment has production-quality data
- Customer provides Git repository access for DAB deployment
- Customer provides Slack or Teams workspace for notifications
- MCP Apps rendering in Genie One is available (pre-private preview or GA)

### Risk Factors

| Risk | Impact | Mitigation |
|---|---|---|
| MCP Apps pre-private preview instability | MCP interface may need rework | Text-based fallback always works; standalone app is fully functional without MCP |
| Customer's metric views not yet created | Nothing to validate on day 1 | Bundle with Rapid Ontology Standup (SOW Option B add-on) |
| Staging data quality insufficient | Business users can't validate query results | Require production-quality data in staging as a prerequisite |
| Genie Code task API changes | Feedback pipeline may need adjustment | Genie Code custom skills are versioned; pipeline uses notebook fallback |

### Comparable Projects (Sizing Reference)

| Project | Complexity | Duration | FDE Effort | Notes |
|---|---|---|---|---|
| ZeroBus gRPC Ingest App (dbxWearables) | Medium-High | 10 weeks | 400 hrs | AppKit + Lakebase + streaming + DAB; no MCP |
| Robinhood Trading Agent Demo | Medium | 6 weeks | 240 hrs | MCP server + React UI; no Lakebase or feedback pipeline |
| Rapid Ontology Standup (full 8 L200s) | Medium | 8 weeks | 320 hrs | Methodology + docs + Genie Agent; no app development |
| **Ground Truth App** | **High** | **12–13 weeks** | **500 hrs** | **Full-stack app + MCP + Genie Agent + feedback pipeline** |

The Ground Truth App is the most complex of these because it combines a full-stack Databricks App (Node.js + React), an MCP Server with MCP Apps, a Genie Agent, and an automated Genie Code feedback pipeline — all in a three-bundle DAB deployment.

---

## SOW Option B: Repeatable Deployment (UC Semantics Build-Out Add-On)

### Engagement Summary

**Scope:** Deploy the pre-built Semantic Ground Truth App as part of a broader UC Semantics and Genie Agent build-out engagement. The app is already developed (from SOW Option A or as a reusable reference architecture); this SOW covers customer-specific configuration, data onboarding, and go-live.

**Prerequisite:** The Ground Truth App codebase exists as a reusable DAB template. This SOW assumes the app is being deployed at a customer who is also doing a Rapid Ontology Standup or already has UC Semantic assets.

**Team:** 1 FDE (can be the same FDE running the Rapid Ontology Standup)
**Customer involvement:** Data Steward (part-time), 3–5 business SMEs for initial review

### Phase Breakdown

| Phase | Duration | FDE Effort | Deliverables |
|---|---|---|---|
| **1. Environment Setup** | 2 days | 16 hrs | Clone DAB template, configure variables (catalog, schema, warehouse), create Lakebase project + branches, deploy Bundle 1 |
| **2. Asset Onboarding** | 2 days | 16 hrs | Register customer's existing metric views / Pages / Domains in the Asset Registry, configure environment mappings, seed initial data |
| **3. App Deployment** | 1 day | 8 hrs | Deploy Bundle 2 (App), configure Unity Gateway MCP Service, verify standalone app + MCP in Genie One |
| **4. Genie Agent Setup** | 1 day | 8 hrs | Deploy Bundle 3 (Genie Agent), configure metric views over customer's Lakebase CDF, add customer-specific curated instructions |
| **5. Campaign Configuration** | 1 day | 8 hrs | Create initial campaigns (automatic + manual), configure RBAC groups, set freshness intervals, configure notification destinations (Slack/Teams) |
| **6. Business User Onboarding** | 1 day | 8 hrs | Train Data Steward on admin panel, run a live review session with 3–5 SMEs, verify the feedback pipeline end-to-end |
| **7. Go-Live & Handoff** | 1 day | 8 hrs | Production deployment, CI/CD pipeline handoff, monitoring setup, documentation |

### Total Estimate

| Metric | Estimate |
|---|---|
| **Total duration** | **8 business days** (~1.5 weeks) |
| **Total FDE effort** | **72 hours** (~1.8 FDE-weeks) |
| **FDE headcount** | 1 FDE |
| **Customer effort** | ~16 hours (Data Steward: 8 hrs config + training; SMEs: 8 hrs initial review session) |

### Bundling with Rapid Ontology Standup

When deployed alongside a Rapid Ontology Standup engagement, the Ground Truth App adds **1.5 weeks** to the overall timeline:

| Combined Engagement | Duration | FDE Effort |
|---|---|---|
| Rapid Ontology Standup (workshop day + follow-on) | 1–2 weeks | 40–80 hrs |
| + Ground Truth App deployment (SOW Option B) | +1.5 weeks | +72 hrs |
| **Combined total** | **2.5–3.5 weeks** | **112–152 hrs** |

The combined engagement delivers:
1. ✅ Customer's UC Semantic assets created (metric views, Pages, Domains, Genie Agent)
2. ✅ Ground Truth App deployed and configured for ongoing validation
3. ✅ Business users onboarded and actively reviewing
4. ✅ Automated feedback pipeline running
5. ✅ Operational Genie Agent for executive analytics

### Assumptions

- Ground Truth App codebase exists as a reusable DAB template (developed via SOW Option A)
- Customer has existing UC Semantic assets (or is creating them in a concurrent Rapid Ontology Standup)
- Customer workspace meets prerequisites (UC enabled, serverless compute, Lakebase access)
- No custom feature development — this is a configuration-and-deploy engagement

### Scaling Estimate

As the app matures and the deployment process is refined:

| Deployment # | Duration | FDE Effort | Notes |
|---|---|---|---|
| 1st customer (SOW A) | 12–13 weeks | 500 hrs | Full build |
| 2nd customer (SOW B) | 1.5 weeks | 72 hrs | First repeatable deploy |
| 3rd–5th customer | 1 week | 48 hrs | Streamlined with lessons learned |
| 5th+ customer | 3–5 days | 24–40 hrs | Templated, self-service with FDE oversight |
| Self-service (future) | 1 day | 0 hrs | Customer deploys from template with documentation |

---

## Pricing Guidance

### SOW Option A (Greenfield Build)

| Item | Estimate |
|---|---|
| FDE engagement (500 hrs @ blended rate) | Scoped per customer |
| Databricks platform consumption | Standard workspace pricing (Apps, Lakebase, SQL Warehouse, Genie, Lakeflow) |
| Ongoing support (optional) | Quarterly check-in + priority bug fixes |

### SOW Option B (Repeatable Deployment)

| Item | Estimate |
|---|---|
| FDE engagement (72 hrs @ blended rate) | Scoped per customer |
| Databricks platform consumption | Same as above |
| Bundled with Rapid Ontology Standup | Combined pricing available |

### Platform Cost Components

| Component | Billing Model | Estimated Monthly Cost |
|---|---|---|
| Databricks App (serverless) | Per hour of compute | Low (app is lightweight) |
| Lakebase (Postgres) | Per project + storage | Low–Medium (metadata only, not raw data) |
| SQL Warehouse (serverless) | Per query DBU | Medium (depends on query volume from reviews) |
| Genie One (MCP) | Per question | Low (review interactions are short) |
| Lakeflow Jobs | Per job run DBU | Low (daily batch jobs) |
| Genie Code tasks | Per task | Low (daily feedback pipeline) |

---

## Appendix: Engagement Prerequisites Checklist

### Customer Must Provide

- [ ] Databricks workspace with Unity Catalog enabled
- [ ] Workspace admin access for FDE (or delegated permissions)
- [ ] Git repository (GitHub, Azure DevOps, or GitLab) with write access for DAB deployment
- [ ] Slack or Microsoft Teams workspace for notification integration
- [ ] Staging/UAT environment with production-quality data
- [ ] Identified Data Steward (primary point of contact for configuration and governance)
- [ ] 3–5 business SMEs available for UAT and initial review sessions
- [ ] SQL Warehouse (existing or permission to create serverless)

### Databricks Must Provide

- [ ] Ground Truth App codebase (SOW B only — from SOW A or reference architecture)
- [ ] FDE with experience in: Databricks Apps (Node.js/React), Lakebase, MCP, Genie Agents, DABs
- [ ] Access to MCP Apps pre-private preview (if not yet GA)
- [ ] Rapid Ontology Standup materials (if bundled)
