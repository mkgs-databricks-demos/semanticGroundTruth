# Semantic Ground Truth App — Ideation Document

## Brainstorm Capture — 2026-09-28

**Project type:** Databricks Application (standalone product)
**Relationship to existing work:** Answers the validation gate question in the Rapid Ontology Standup; deployable at any customer
**Design philosophy:** Generic enough to be productizable — potentially part of the Databricks product itself

---

### Problem Statement

Business users can't meaningfully participate in UC semantics validation today. The available tools — reviewing markdown in a repo, browsing the Discovery tab, or navigating Unity Catalog directly — are too technical or too passive for non-technical stakeholders.

Data Management teams need a **fun, interactive way** for business users to provide feedback and approvals on UC Semantic assets. Multiple users should be able to "vote" on the correctness of semantic definitions, crowdsourcing the subtle, organization-specific knowledge that only business users can provide.

### Core Concept

A **"Mechanical Turk" / "Ground Truth"** crowdsourced validation platform for UC Semantics. The app decomposes complex semantic assets into **atomic review tasks** that non-technical users can confidently judge — one dimension or measure at a time.

The key insight: SQL and YAML are the domain of Data Engineers and Governance professionals, but **descriptions, synonyms, plain-English logic, and data source context** are the domain of business users. This app bridges that gap.

---

### Assets Under Review

| Asset Type | Review Scope | Depth |
| --- | --- | --- |
| **Metric View Measures** | Name, description, synonyms, plain-English formula, source info, sample query | Full review |
| **Metric View Dimensions** | Name, description, synonyms, plain-English formula, source info, sample query | Full review |
| **UC Pages** | Descriptions | Descriptions primarily |
| **Domains** | Descriptions | Descriptions primarily |
| **Subdomains** | Descriptions | Descriptions primarily |

---

### UX Pattern: Tinder-Style Card Swipe

The primary interaction is a **card-swipe** pattern — approve ✅ or reject ❌ — with progressive disclosure for users who want to go deeper.

#### Card Anatomy (Always Visible)

- **Asset type badge** — Measure, Dimension, Page, Domain, or Subdomain
- **Name** — The asset name (e.g., "Admin PMPM")
- **Description** — Editable text field (e.g., "The per member per month total dollar amount charged by a health plan for administrative services.")
- **Synonyms** — Displayed as green toggle chips, pre-selected by default. Users can:
    - **Deselect** a synonym they disagree with (chip turns gray)
    - **Add** a new synonym via a ➕ button and text input

#### Accordion — Optional Progressive Disclosure

For users who want to go deeper (self-selected "advanced" gate):

- **Logic — Plain English + Real SQL side-by-side** — The measure/dimension logic described in natural language steps alongside the actual SQL/YAML. Non-technical users focus on the English explanation; technical users who know the real SQL can validate or supply corrections to the actual logic directly.
- **Source table information** — Where the data comes from
- **Sample query result** — A preview of what this measure/dimension produces
- **Validation button** — "Run a common aggregation" to see the measure/dimension in action with real data

#### "Use It in a Sentence" — Example Questions & Usage

A dedicated section where users can see and contribute **natural language examples** of how this measure/dimension would be used in a real business question:

- Pre-seeded examples shown as cards (e.g., *"What was the Admin PMPM for Q3 across all commercial plans?"*)
- Users can **approve** ✅ or **reject** ❌ each example (same swipe pattern)
- Users can **add their own** examples via a ➕ button — as many as they want
- **Strategic value:** These crowdsourced example questions become training data for **Genie Agent optimization** — curated SQL instructions and example queries that improve Genie's ability to answer real business questions accurately

#### Actions

- **Approve** ✅ — User agrees with the current definition
- **Reject** ❌ — User disagrees; must provide feedback text explaining why
- **Edit** ✏️ — User can directly edit the description or synonyms before approving

---

### Personas

#### 1. Business SME (Primary User)

- Votes on semantic correctness
- Reviews descriptions, synonyms, and optionally logic
- Earns gamification rewards for participation
- Does NOT need to understand SQL or YAML

#### 2. Data Steward

- Triages feedback from business users
- Configures confidence thresholds and scoring weights
- Reviews proposed changes on feature branches
- Makes final certification decisions when votes conflict
- Promotes validated changes through environments

#### 3. Admin

- Configures review campaigns and RBAC assignments
- Sets freshness intervals for periodic re-validation
- Manages gamification rewards and leaderboard settings
- Configures system-wide settings

#### 4. Executive

- Views approval progress and coverage dashboards
- Monitors confidence scores across domains
- Tracks organizational participation metrics

---

### Smart Surfacing Algorithm

The order assets appear for review should feel random to users but is actually an **intelligent sampling strategy**:

- **Sample without replacement** — A user never sees the same asset twice unless it has been updated since their last review
- **Coverage-weighted probability** — Assets with the fewest total reviews have the highest probability of being surfaced next (maximizes coverage speed)
- **Version-aware** — Tracks asset versions; updated assets re-enter the review pool
- **Freshness-based resurfacing** — Production assets that haven't been reviewed in a configurable period are periodically re-queued for re-validation
- **Multiple rounds exist internally** but are invisible to users — they just see a continuous stream of cards

---

### Campaign Model

#### Automatic Campaigns

- New or modified metric view assets automatically trigger review
- Configurable: which asset types auto-trigger, minimum change threshold

#### Manual Campaigns

- Data Stewards can create targeted campaigns (e.g., "Review all Claims domain measures")
- Scoped by domain, subdomain, asset type, or specific assets

#### Freshness Campaigns

- Admin configures periodic resurfacing intervals
- Production semantics that haven't been reviewed in N days re-enter the queue
- Ensures ongoing validation as business context evolves

#### RBAC Assignment

- Optional: assign specific campaigns to RBAC groups (e.g., "Claims SMEs review Claims measures")
- Default: all users can review all assets

---

### Confidence Scoring Model

A **weighted confidence score** determines when an asset is considered validated:

- **Business user votes** — Primary signal; weight increases as more votes accumulate
- **Industry standard definitions** — Secondary signal; weight decays as business votes accumulate (configurable decay curve)
- **Configurable threshold** — Data Steward sets the confidence level required for certification
- **Agreement percentage** — Visible to Data Stewards for conflict detection
- **Conflict resolution** — When votes diverge significantly, the Data Steward makes the final call

The key insight: early in the lifecycle, industry standards provide a baseline. As the organization's business users weigh in, their collective knowledge gradually supersedes the generic definitions.

---

### Gamification

- **Leaderboards** — Most active reviewers, most edits accepted, longest streaks
- **Rewards system** — Configurable by Admin (badges, recognition, etc.)
- **Progress indicators** — "You've reviewed 47 of 120 measures in the Claims domain"
- **Team competitions** — Optional team-based challenges to drive participation
- **Incentivize breadth** — Rewards for reviewing across multiple domains, not just depth in one

---

### Automated Feedback Loop

The critical differentiator — closing the loop from crowdsourced feedback back to code:

#### Daily Workflow

1. **End-of-day job** collects all rejections and edits from the day
2. **Genie Code task** analyzes the feedback in context of the current metric view YAML / config YAML
3. **Creates a feature branch** in the DAB repo with proposed edits
4. **Data Steward alerted** — notification that a new feature branch is ready for review

#### Promotion Pipeline

1. **Dev** — Data Steward reviews and refines proposed changes
2. **Test/Stage** — Updated assets re-enter the voting pool for re-validation
3. **Production** — Certified changes deployed; freshness clock resets

---

### Technical Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| **Deployment** | Two-bundle DAB pattern | Bundle 1: infra (schemas, tables, Lakebase); Bundle 2: app via `databricks apps init` |
| **Backend** | Node.js (Databricks AppKit) | Required — no Python backends |
| **Frontend** | React | Card-swipe UI, gamification components |
| **Database** | Lakebase plugin | Stores votes, campaigns, user activity, confidence scores |
| **Auth** | OBO (On Behalf Of) | User identity for RBAC and vote attribution |
| **Observability** | OpenTelemetry | Logs, metrics, traces — required for all apps |
| **Repo** | DAB with metric view YAML | Versioned semantic definitions; feature branch workflow |

---

### Open Questions for Design Phase

1. **Confidence scoring formula** — What's the right mathematical model for blending business votes with industry standards? Bayesian? Weighted average with decay?
2. **Conflict resolution UX** — How does the Data Steward see and resolve conflicting votes? Side-by-side comparison? Discussion thread?
3. **"Run a common aggregation" feature** — How do we generate meaningful sample queries automatically? Pre-configured per measure, or AI-generated?
4. **Plain-English pseudo-code generation** — How do we translate SQL/YAML logic into readable English? AI-generated from the YAML? Manually authored?
5. **Integration with UC APIs** — What's the read/write surface for metric view metadata, Pages, Domains, Subdomains?
6. **Notification system** — Slack integration? Email? In-app only?
7. **Mobile experience** — The card-swipe pattern is inherently mobile-friendly. Should we optimize for mobile from day one?
8. **Analytics for Executives** — What dashboards/metrics matter most? Coverage %, confidence trends, participation rates, time-to-certification?
9. **Versioning granularity** — What constitutes a "version change" that re-triggers review? Any edit? Only structural changes?
10. **Industry standard sources** — Where do baseline definitions come from? Pre-loaded glossaries? AI-generated? Customer-provided?
11. **Genie Agent feedback pipeline** — How do crowdsourced "Use it in a sentence" examples flow into Genie Agent SQL instructions and example queries? Automated via the same daily Genie Code task, or a separate curation workflow?
12. **Logic review UX** — What's the best side-by-side layout for plain-English explanation + real SQL/YAML? Tabs? Split pane? Collapsible sections within the accordion?

---

### Next Steps

- [ ] Design the data model (Lakebase schema for votes, campaigns, assets, scores)
- [ ] Design the API surface (AppKit endpoints)
- [ ] Design the React component library (card, swipe, chips, accordion, leaderboard)
- [ ] Design the confidence scoring algorithm
- [ ] Design the smart surfacing algorithm
- [ ] Design the Genie Code feedback loop workflow
- [ ] Create L100 system-level design document
- [ ] Create L200s for each component
