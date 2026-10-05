# L200-C6 — Feedback Pipeline

## Component Design Document

**Component:** C6 — Feedback Pipeline
**Type:** Lakeflow Job + Genie Code task
**Owner:** TBD
**References:** L100 § Feedback Loop Pipeline, § Automated Feedback Loop

---

### Overview

The Feedback Pipeline is the automated workflow that closes the loop from crowdsourced business feedback back to governed code. It collects rejections and edits from Lakebase, sends them to a Genie Code task that proposes YAML edits, creates a feature branch in the owning DAB repo, and notifies the Data Steward.

### Dependencies

| Dependency | Type | Description |
|---|---|---|
| C1 Asset Registry | Data source | Unprocessed votes with feedback |
| Genie Code (Platform) | Compute | AI-powered YAML edit generation |
| Genie Code Custom Skills (Bundle 1) | Configuration | Versioned prompts for feedback processing |
| DAB Repos (External) | Target | Feature branches created here |
| C7 Notification Service | Consumer | Alerts Data Steward when branch is ready |

### Design

#### Pipeline Flow

```
Lakeflow Job (daily, end-of-day)
  ├── Query: SELECT * FROM votes WHERE processed = FALSE AND vote_type IN ('reject', 'edit')
  ├── Group by: asset_id → batch per asset
  ├── For each asset batch:
  │     ├── Read current fixture YAML from repo
  │     ├── Compile feedback context (all rejections + edits for this asset)
  │     ├── Send to Genie Code task with custom skill prompt
  │     ├── Genie Code generates proposed YAML edits
  │     ├── Create feature branch: `ground-truth/feedback-{date}-{asset_name}`
  │     ├── Commit proposed changes to branch
  │     ├── Record branch URL in feedback_batches table
  │     └── Mark votes as processed
  └── Trigger notification to Data Steward(s)
```

#### Genie Code Custom Skill Prompt (versioned in Unity Gateway skills library)

```
You are a UC Semantics editor. Given the current metric view YAML and a batch of 
business user feedback (rejections and edits), propose updated YAML that addresses 
the feedback while maintaining valid metric view syntax.

Rules:
- Preserve all existing measures and dimensions unless explicitly rejected
- Update descriptions based on edit suggestions
- Add/remove synonyms based on synonym votes
- Update comments based on feedback
- Do NOT change SQL expressions unless a technical user provided a logic correction
- Output the complete updated YAML (not a diff)

Current YAML:
{current_yaml}

Feedback batch:
{feedback_json}
```

#### Retry Logic

- If Genie Code fails, the batch is marked as `failed` with error message
- Failed batches are retried on the next run (up to 3 attempts)
- After 3 failures, the batch is escalated to the Data Steward via notification

#### Git Integration

- Uses Databricks Repos API or Git CLI to create branches and commit
- Branch naming: `ground-truth/feedback-{YYYY-MM-DD}-{asset_name_slug}`
- Commit message: `[Ground Truth] Proposed edits from {N} business user reviews`

### Non-Functional Requirements

| NFR | Target | Notes |
|---|---|---|
| Pipeline completion | < 1 hour | For up to 100 asset batches |
| Genie Code task | < 5 minutes per asset | Single YAML generation |
| Retry reliability | 3 attempts | Exponential backoff |
| Branch creation | < 30s per asset | Git API call |

### Testing

- **End-to-end test:** Submit test votes → run pipeline → verify feature branch created with correct YAML
- **Genie Code output validation:** Generated YAML must parse as valid metric view definition
- **Retry tests:** Simulate Genie Code failure → verify retry on next run
- **Idempotency tests:** Running the pipeline twice doesn't create duplicate branches

### Deployment

- Lakeflow Job defined in Bundle 1 (Infra)
- Genie Code custom skill deployed in Bundle 1
- Scheduled: daily at configurable time (default: 11 PM workspace timezone)
- Can also be triggered manually by Data Steward

> See [docs/diagrams/mermaid/02_feedback_loop.md] for the feedback loop pipeline sequence diagram.

### Resolved Questions

1. ✅ **Batch (end-of-day) for V1.** Consolidates multiple rejections on the same asset into one coherent edit proposal. Fewer branches = less noise for Data Steward. Manual "process now" button available for immediate processing.
2. ✅ **One branch per asset.** Cleaner for Data Steward review — each branch is a focused change. Easier to approve/reject individually. Branch naming: `ground-truth/feedback-{YYYY-MM-DD}-{asset_name_slug}`.
3. ✅ **No auto-merge for V1.** Every change goes through the Data Steward — governed code means no bypass. V2 consideration: auto-merge for synonym adds with 5+ approvals, 0 rejections, and Data Steward pre-approval.
4. ✅ **Regenerate, don't rebase.** Genie Code regenerates the proposal against the *current* YAML. Feedback context is still valid. If the target field no longer exists, mark feedback as stale and notify Data Steward.
