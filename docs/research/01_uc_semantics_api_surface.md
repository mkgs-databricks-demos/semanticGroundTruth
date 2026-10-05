# Research: UC Semantics API Surface for Ground Truth App

## Date: 2026-09-29

## Summary
This document captures the technical API surface available for programmatically reading and writing UC Semantic assets (metric views, Pages, Domains, Subdomains). This is foundational research for the Semantic Ground Truth App L100 design.

---

## 1. Metric Views — Programmatic Interface

**There is no dedicated REST API for metric views.** Metric views are managed via SQL executed through the SQL Statement Execution API (`POST /api/2.0/sql/statements`).

### Create
```sql
CREATE OR REPLACE VIEW <catalog>.<schema>.<view>
WITH METRICS
LANGUAGE YAML
AS $$
<complete YAML definition>
$$
```

### Update (ALTER)
```sql
ALTER VIEW <catalog>.<schema>.<view>
AS $$
<complete YAML definition>
$$
```
- `ALTER VIEW` replaces the **full** YAML definition — no partial patch
- Caller must be the metric view owner

### Read (Describe)
```sql
DESCRIBE TABLE EXTENDED <catalog>.<schema>.<view> AS JSON;
```
- Returns the metric view YAML in the `View Text` metadata

### YAML Structure (Top-Level Fields)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | String | Yes | YAML spec version (e.g., 1.1) |
| comment | String | No | Description of the metric view |
| source | String | Yes | Source table/view |
| parameters | Array | No | Named values for table-valued function queries |
| filter | String | No | SQL boolean expression applied to all queries |
| joins | Array | No | Star/snowflake schema joins |
| fields | Array | Conditional | Field (dimension) definitions — required if no measures |
| measures | Array | Conditional | Measure definitions — required if no fields |
| materialization | Object | No | Materialized view acceleration config |

### Each Field/Dimension Contains
- `name` — Display name
- `expr` — SQL expression
- `comment` — Description
- `synonyms` — Alternative names (list)
- `tags` — Governed tags

### Each Measure Contains
- `name` — Display name
- `expr` — Aggregate SQL expression
- `comment` — Description
- `synonyms` — Alternative names (list)
- `tags` — Governed tags

### Permissions Required
- `USE CATALOG`, `USE SCHEMA`, `CREATE TABLE` (to create)
- `SELECT` on source tables
- Ownership of metric view (to alter)
- Runtime: DBR 16.4+, some features require 17.3+

### Automation Pattern
```
metric_view.yaml → validate YAML → generate CREATE/ALTER SQL → POST /api/2.0/sql/statements → poll status → DESCRIBE to verify
```

---

## 2. UC Pages — Interface

Pages are part of UC Semantics (the "Genie Ontology" human-modeled layer). Based on the Pages KPI dashboard in the workspace, Pages are stored in an entity store:
- `main.data_centralized_db_live__entitystore_knowledge.pages`
- Each page has: `page_id`, `account_id`, `lifecycle_state` (1=Draft, 2=Published), `created_at`, `reaction_counts`

**API Surface:** Pages are managed through the Catalog Explorer UI and potentially through internal REST APIs. The public documentation describes Pages as "governed Pages that define business concepts" but does not expose a public REST API for CRUD operations as of this research date.

**Implication for Ground Truth App:** The app will need to READ page definitions (likely via internal APIs or SQL against the entity store) and propose changes that a Data Steward applies through the UI or Genie Code.

---

## 3. Domains & Subdomains — Interface

Domains are an organization layer that groups assets by governed tags.
- Assets are added to domains by applying governed tags
- Subdomains partition domains into more specific business areas
- Pages belong to exactly one domain or subdomain

**API Surface:** Domains are managed through the Catalog Explorer UI. The public documentation describes creation and management but does not expose a dedicated REST API.

**Implication for Ground Truth App:** The app will READ domain/subdomain metadata and descriptions, and propose changes via the feedback loop.

---

## 4. Databricks Apps Auth Model

### App Authorization (Service Principal)
- Each app gets a dedicated service principal (auto-provisioned)
- All users share the SP's permissions
- Good for: background tasks, shared metadata, logging

### User Authorization (OBO — On-Behalf-Of)
- App acts with the identity of the logged-in user
- User's UC permissions enforced (row filters, column masks)
- Scoped to the workspace where the app runs
- Good for: querying tables, accessing warehouses, user-specific actions

### For Ground Truth App
- **OBO** for reading UC semantic assets (respects user's catalog permissions)
- **Service Principal** for writing votes/feedback to Lakebase (app-owned data)
- **Hybrid model**: OBO for reads, SP for app state writes

---

## 5. Databricks JavaScript SDK

The JS SDK (`@databricks/sdk-*`) provides:
- `@databricks/sdk-core` — HTTP client, config resolution, logging
- `@databricks/sdk-auth` — Credential providers (PAT, U2M, M2M)
- `@databricks/sdk-options` — Option types
- `@databricks/sdk-postgres` — Lakebase/Postgres client

Authentication follows unified auth — auto-detects credentials from environment.

---

## 6. DAIS 2026 Customer Feedback Validation

The Genie Ontology DAIS 2026 Customer Feedback Synthesis notebook (by Irfan Maroof) validates the Ground Truth App concept:

### #1 Customer Ask: "Where do I edit it?"
- AkzoNobel, AB InBev, Adidas, Conde Nast, Chick-fil-A all asked for a visible curation UI
- "Build a visible curation UI" is the #1 actionable recommendation

### Directly Relevant Themes
1. **Manual Editing & Curation Control** — customers want to view, edit, approve, prune
2. **Deduplication & Semantic Sprawl** — Eli Lilly, Mondelez want conflict detection
3. **Learned vs. Managed Context** — customers want to "train" and improve ontology quality
4. **Role-Based Context** — Cigna, BASF want persona-aware responses
5. **Integration with External Sources** — Fox, Workday, Nextdoor want import APIs

### Key Validation
- 40+ customer conversations at DAIS 2026 confirm the problem space
- "Build a visible curation UI" is literally recommendation #1
- The Ground Truth App addresses asks #1, #5, #6, #8 from the recommendations
