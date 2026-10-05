# Semantic Ground Truth App — Feature Readiness & Compliance Matrix

## Platform: AWS | Region: us-east-1 | Compliance: HIPAA

**Last updated:** 2026-09-29
**Sources:** Databricks public documentation, HIPAA regional feature tables, release notes

---

## Feature Readiness Matrix

| # | Feature | Release Status | HIPAA (AWS us-east-1) | Toggle Level | Why Needed |
|---|---|---|---|---|---|
| 1 | **Unity Catalog** | GA | ✅ Supported | Account-level (auto-enabled post Nov 2023) | Core governance layer — all semantic assets, permissions, secrets, and metric views are UC objects |
| 2 | **Databricks Apps (V2)** | GA | ✅ Supported | Workspace toggle (Previews page) | Hosts the standalone React + Node.js app and the co-hosted MCP Server |
| 3 | **Databricks Apps — OBO (User Authorization)** | GA | ✅ Supported | Per-app config (`user_api_scopes` in app.yml) | Forwards user identity for UC permission enforcement on reads; votes attributed to actual user |
| 4 | **Databricks Apps — Git-backed Deployments** | GA | ✅ Supported | Workspace toggle | CI/CD deployment from Git repositories via DABs |
| 5 | **Databricks Apps — OpenTelemetry** | GA | ✅ Supported | Per-app plugin (selected during `apps init`) | Required observability — logs, metrics, traces for all app components |
| 6 | **Lakebase (Postgres)** | GA | ✅ Supported | Workspace-level (auto-enabled with compliance profile) | App state database — votes, campaigns, scores, gamification, notifications |
| 7 | **Lakebase — Change Data Feed (CDF)** | Public Preview | ✅ Supported (Lakebase is HIPAA; CDF inherits) | Per-table config (`REPLICA IDENTITY FULL` + CDF enable) | Replicates Lakebase tables to UC Delta tables for metric views and Genie Agent |
| 8 | **Lakebase — Copy-on-Write Branches** | GA | ✅ Supported | Per-project CLI command | Isolated dev/test/prod Postgres environments for safe schema iteration |
| 9 | **Serverless SQL Warehouse** | GA | ✅ Supported (region-dependent) | Workspace-level | Executes metric view queries, sample aggregations, and Genie Agent compute |
| 10 | **UC Metric Views** | GA | ✅ Supported (Metric View Sharing listed) | No toggle — SQL DDL (`CREATE VIEW ... WITH METRICS`) | Defines reusable business KPIs; the core semantic assets being validated |
| 11 | **UC Metric Views — YAML Definition** | GA | ✅ Supported | No toggle — YAML spec version 1.1+ | Fixture YAMLs in DAB repos are the source of truth for metric view definitions |
| 12 | **UC Pages** | GA | ✅ Supported (Discover Page listed) | No toggle — Catalog Explorer UI | Business term definitions validated by the app |
| 13 | **UC Domains & Subdomains** | GA | ✅ Supported (Discover Page, Domain Recommendations listed) | No toggle — Catalog Explorer UI | Organizational hierarchy validated by the app |
| 14 | **UC Secrets** | GA | ✅ Supported (External secrets listed) | No toggle — SQL DDL (`CREATE SECRET`) | Stores sensitive config (API keys, webhook tokens) governed by UC privileges |
| 15 | **Genie One (Chat)** | GA | ✅ Supported | Workspace toggle (Previews page) | Users access the MCP Server conversationally from Genie One |
| 16 | **Genie One MCP Service** (`system.ai.genie_one_mcp`) | GA | ⚠️ Region-dependent (check HIPAA table) | Account-level (Unity Gateway) | Genie One exposed over MCP protocol; the app's MCP Server is a custom MCP Service alongside this |
| 17 | **Custom MCP Servers (hosted as Databricks Apps)** | GA | ✅ Supported (Managed MCP Servers listed) | Per-app (name prefix `mcp-` no longer required; Unity Gateway registration) | The Ground Truth MCP Server — exposes review tools over MCP protocol |
| 18 | **MCP Apps (Interactive View in Genie One)** | Pre-Private Preview | ⚠️ Not yet in HIPAA table | Workspace toggle (FEVM-specific for now) | Renders the card-swipe UI directly in Genie One chat — the headline UX |
| 19 | **Unity Gateway** | GA | ✅ Supported | Account-level | Governs MCP Services — access control, service policies, audit |
| 20 | **Genie Agents (Genie Spaces)** | GA | ✅ Supported | No toggle | Operational Genie Agent (C9) for executive analytics over app data |
| 21 | **Genie Agent — Agent Mode (OBO)** | Beta | ⚠️ Not in HIPAA table (Beta) | Workspace toggle (Previews page) | Executives query the operational agent conversationally with their own UC permissions |
| 22 | **Genie Code** | GA | ✅ Supported | Workspace toggle | AI-powered feedback loop — generates proposed YAML edits from business feedback |
| 23 | **Genie Code — Scheduled Tasks** | Beta | ⚠️ Not in HIPAA table (Beta) | Workspace toggle (Previews page) | Automates the daily feedback pipeline as a Genie Code task in a Lakeflow Job |
| 24 | **Genie Code — Custom Skills** | GA | ✅ Supported | Per-workspace | Versioned feedback loop prompts in the skills library |
| 25 | **Lakeflow Jobs** | GA | ✅ Supported | No toggle | Orchestrates the feedback pipeline and freshness resurfacing jobs |
| 26 | **Lakeflow Jobs — forEach Task** | GA | ✅ Supported | No toggle | Iterates over fixture YAMLs to deploy metric views |
| 27 | **Lakeflow Jobs — Genie Code Task** | Beta | ⚠️ Not in HIPAA table (Beta) | Workspace toggle (Previews page) | Genie Code as a task type in Lakeflow Jobs for the feedback pipeline |
| 28 | **Declarative Automation Bundles (DABs)** | GA | ✅ Supported | CLI tool (no workspace toggle) | Three-bundle GitOps deployment for all infrastructure, app, and agent resources |
| 29 | **Notification Destinations (Slack)** | GA | ✅ Supported | Workspace admin settings | Alerts Data Stewards when feature branches are ready for review |
| 30 | **Notification Destinations (Teams)** | Beta (Genie App) | ⚠️ Genie App for Teams not in HIPAA table | Workspace admin settings + Previews page | Microsoft Teams notification delivery |
| 31 | **Notification Destinations (Webhook)** | GA | ✅ Supported | Workspace admin settings | Generic webhook for custom notification routing |
| 32 | **Lakehouse Monitoring** | GA | ✅ Supported | No toggle | Quality monitors on Lakebase CDF tables for anomaly detection (vote gaming) |
| 33 | **MLflow 3 (Tracing)** | GA | ✅ Supported | No toggle | OTel traces from the app flow to an MLflow experiment for analysis |
| 34 | **AI/BI Dashboards** | GA | ✅ Supported | No toggle | Executive dashboard for coverage, confidence, participation metrics |
| 35 | **Databricks JS SDK** (`@databricks/sdk-*`) | GA | N/A (client library) | N/A | Node.js SDK for Lakebase, SQL execution, and UC API access from the app |

---

## HIPAA Compliance Summary

### ✅ Fully Supported (28 features)

All core features required for the Ground Truth App are HIPAA-supported on AWS us-east-1 when the Compliance Security Profile is enabled with HIPAA selected.

### ⚠️ Requires Verification or Not Yet Supported (7 features)

| Feature | Status | Risk | Mitigation |
|---|---|---|---|
| **MCP Apps (Interactive View)** | Pre-Private Preview | Not in HIPAA table | Standalone app is fully HIPAA-compliant; MCP Apps is an enhancement, not a requirement. Text-based MCP fallback works without MCP Apps. |
| **Genie Agent Mode (OBO)** | Beta | Not in HIPAA table | Operational agent is admin-only; does not process PHI directly (reads aggregated operational metrics, not patient data). |
| **Genie Code Scheduled Tasks** | Beta | Not in HIPAA table | Fallback: use a notebook task that invokes Genie Code via API instead of the native task type. |
| **Genie Code Task in Jobs** | Beta | Not in HIPAA table | Same fallback as above. |
| **Genie One MCP** | GA | Region-dependent | Verify us-east-1 specifically in the HIPAA regional table. GA status is strong signal. |
| **Teams Genie App** | Beta | Not in HIPAA table | Fallback: use webhook-based Teams notifications (GA, supported). |
| **Lakebase CDF** | Public Preview | Lakebase is HIPAA; CDF inherits | CDF writes to UC-managed Delta tables which are HIPAA-governed. Low risk. |

### Required HIPAA Controls

Before processing PHI with this app:

1. ✅ **Compliance Security Profile** enabled on the workspace
2. ✅ **HIPAA** selected as the compliance standard
3. ✅ Active **Databricks Business Associate Agreement (BAA)**
4. ✅ No PHI in workspace names, resource names, tags, query literals, or Git URLs
5. ✅ Customer-managed keys for storage encryption (if required)
6. ✅ Least-privilege access via UC grants, database roles, and service policies

### Important Note

> The Ground Truth App stores **semantic metadata** (descriptions, synonyms, vote feedback) in Lakebase — not raw patient data. However, if metric view descriptions or example questions contain PHI-adjacent information (e.g., "Total paid claims for Medicare Advantage members"), the HIPAA controls above must be in place. The app's OBO auth model ensures users only see assets they have UC permission to access.

---

## Workspace Preview Toggles Required

The following features must be enabled on the workspace Previews page:

| Toggle Name | Feature | Required? |
|---|---|---|
| Genie One | Genie One chat interface | Yes |
| Genie Code | AI coding assistant | Yes |
| Genie Code Scheduled Tasks | Genie Code as a job task type | Yes (or use notebook fallback) |
| Genie Agent Mode | OBO for Genie Agents | Yes (for C9 operational agent) |
| MCP Apps (custom) | Interactive View rendering in Genie One | Yes (FEVM-specific for now) |
| Destination Type Databricks App Slack | Slack Genie App notifications | Optional (webhook alternative available) |
| Destination Type Databricks App Teams | Teams Genie App notifications | Optional (webhook alternative available) |
