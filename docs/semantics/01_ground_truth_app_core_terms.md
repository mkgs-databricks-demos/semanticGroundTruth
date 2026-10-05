# Semantics: Ground Truth App — Core Terminology

## Domain: Semantic Validation Platform

These terms are specific to the Semantic Ground Truth App and should be structured for UC Pages if this project is deployed at a customer.

---

### Ground Truth
- **Definition:** The verified, organization-specific meaning of a UC semantic asset (metric view measure, dimension, Page, Domain, or Subdomain) as validated by business subject matter experts through crowdsourced voting.
- **Business Context:** Organizations need their UC Semantics to reflect how the business actually thinks about its data — not just how engineers modeled it. Ground truth is the business-validated version.
- **Related Terms:** Confidence Score, Certification, Wilson Score
- **Source:** Project ideation (2026-09-28)

### Review Card
- **Definition:** The atomic unit of work presented to a business user for validation. A card contains one UC semantic asset (measure, dimension, Page, Domain, or Subdomain) with its name, description, synonyms, and optionally its logic and example queries.
- **Business Context:** Cards are designed to be judged in seconds — approve, reject, or edit — making semantic validation accessible to non-technical users.
- **Related Terms:** Card Swipe, Progressive Disclosure, Accordion
- **Source:** Project ideation (2026-09-28)

### Confidence Score
- **Definition:** A Wilson score interval lower bound that quantifies how confidently a UC semantic asset has been validated by business users. Ranges from 0 (no votes) to ~1 (many approvals, high confidence). Incorporates a configurable industry standard prior that decays as business votes accumulate.
- **Business Context:** The confidence score determines when an asset is ready for certification. It naturally penalizes assets with few votes and rewards both high approval ratios and sufficient sample sizes.
- **Data Usage:** Stored in `confidence_scores` Lakebase table; materialized for fast reads; used by the surfacing algorithm and certification threshold.
- **Related Terms:** Wilson Score Interval, Certification Threshold, Industry Standard Prior
- **Source:** L100 Technology Decisions (2026-09-29)

### Certification Threshold
- **Definition:** The minimum Wilson confidence score an asset must achieve to be considered certified and promoted to production. Configurable by the Data Steward.
- **Business Context:** Provides a quantitative gate for semantic validation — assets below the threshold need more votes or refinement before they're trusted for production use.
- **Related Terms:** Confidence Score, Data Steward, Promotion Pipeline
- **Source:** L100 (2026-09-29)

### Smart Surfacing
- **Definition:** The algorithm that determines which review card a user sees next. Uses sample-without-replacement weighted by coverage gaps (assets with fewest reviews surface first), version-aware (updated assets re-enter the pool), with freshness-based resurfacing for production assets.
- **Business Context:** Appears random to users but maximizes coverage speed and ensures every asset gets reviewed. Users never see the same asset twice unless it's been updated.
- **Related Terms:** Coverage-Weighted Probability, Sample Without Replacement, Freshness Resurfacing
- **Source:** Project ideation (2026-09-28)

### Campaign
- **Definition:** A scoped collection of UC semantic assets queued for review. Campaigns can be automatic (triggered by new/modified assets), manual (created by a Data Steward for targeted review), or freshness-based (resurfacing stale production assets).
- **Business Context:** Campaigns organize the review workload and can be assigned to specific RBAC groups (e.g., "Claims SMEs review Claims measures").
- **Related Terms:** Automatic Campaign, Manual Campaign, Freshness Campaign, RBAC Assignment
- **Source:** Project ideation (2026-09-28)

### Feedback Pipeline
- **Definition:** The automated end-of-day workflow that collects rejections and edits from Lakebase, sends them to a Genie Code task that proposes YAML edits, creates a feature branch in the owning DAB repo, and notifies the Data Steward.
- **Business Context:** Closes the loop from business validation back to governed code — crowdsourced feedback becomes actionable code changes without manual translation.
- **Related Terms:** Genie Code Task, Feature Branch, Data Steward, Promotion Pipeline
- **Source:** L100 (2026-09-29)

### Fixture YAML
- **Definition:** A metric view YAML definition stored in the `fixtures/` folder of a DAB repo. Fixture YAMLs are the source of truth for metric view definitions — they are deployed to UC via a forEach task and read by the app to present to users.
- **Business Context:** GitOps pattern — all changes to metric views flow through the repo, enabling version control, code review, and environment-specific deployment.
- **Related Terms:** DAB Repo, forEach Task, Environment-Specific Source Tables
- **Source:** L100 (2026-09-29)

### "Use It in a Sentence"
- **Definition:** A section on each review card where users can see and contribute natural language example questions that use the measure or dimension (e.g., "What was the Admin PMPM for Q3 across all commercial plans?"). Examples can be approved, rejected, or added by any user.
- **Business Context:** Crowdsourced example questions become training data for Genie Agent optimization — curated SQL instructions and example queries that improve Genie's ability to answer real business questions.
- **Related Terms:** Genie Agent Optimization, Example Questions, Review Card
- **Source:** Project ideation (2026-09-28)

### Lakebase CDF (Change Data Feed)
- **Definition:** A Lakebase feature (Public Preview) that captures every insert, update, and delete on a Postgres table and stores it as a Delta table in Unity Catalog (`lb_<table_name>_history`). Changes are batched every ~15 seconds.
- **Business Context:** Enables the Operational Genie Agent and Executive Dashboard to read near-real-time operational data from Delta tables without querying the OLTP database directly.
- **Data Usage:** CDF Delta tables are the source for metric views in Bundle 1; co-located in the same catalog.schema as the Unity Gateway MCP Service connection.
- **Related Terms:** Lakebase, Delta Table, Metric Views, Operational Genie Agent
- **Source:** Databricks documentation (2026-09-29)

---

## Tagging Strategy
- **Priority 1 (deploy immediately):** Ground Truth, Review Card, Confidence Score, Certification Threshold, Campaign, Fixture YAML
- **Priority 2 (deploy with L200s):** Smart Surfacing, Feedback Pipeline, "Use It in a Sentence", Lakebase CDF
