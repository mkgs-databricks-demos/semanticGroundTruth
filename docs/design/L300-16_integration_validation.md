# L300-16 — End-to-End Integration Validation

## Implementation Spec

**Phase:** 4 (Integration)
**Type:** Manual + Genie Code
**Prerequisites:** L300-08, L300-13, L300-15 all complete (all 3 bundles deployed)
**References:** L100 § CI/CD Orchestration

---


> See [docs/diagrams/mermaid/06_card_lifecycle.md] for the full card lifecycle being validated.
> See [docs/diagrams/mermaid/02_feedback_loop.md] for the feedback pipeline flow.
### Step 1: End-to-end smoke test — Standalone App

**Type:** Manual (browser)

1. Open the Ground Truth App URL
2. Log in (OBO)
3. Verify a review card appears
4. Approve a card → verify vote recorded in Lakebase
5. Reject a card with feedback → verify feedback stored
6. Add a synonym → verify synonym appears
7. Add an example question → verify it appears
8. Click "Run a common aggregation" → verify query executes
9. Check the leaderboard → verify your votes appear
10. Check the executive summary → verify coverage metrics update

### Step 2: End-to-end smoke test — MCP in Genie One

**Type:** Manual (Genie One)

1. Open Genie One
2. Say: "I want to review some UC semantics"
3. Verify the MCP Apps View renders a review card
4. Approve the card via the View
5. Say: "Show me my review stats"
6. Verify stats are returned

### Step 3: End-to-end smoke test — Feedback Pipeline

**Type:** Manual (CLI + browser)

1. Submit several rejection votes with feedback via the app
2. Manually trigger the feedback pipeline:
   ```bash
   databricks bundle run -t dev feedback_pipeline
   ```
3. Verify a feature branch was created in the repo
4. Verify the Data Steward received a notification (Slack/Teams/in-app)
5. Review the proposed YAML changes on the branch

### Step 4: End-to-end smoke test — Genie Agent

**Type:** Manual (Genie Agent)

1. Open the Ground Truth Operations agent
2. Ask: "How many votes were cast today?"
3. Verify the count matches what you submitted in Steps 1-2
4. Ask: "What's the current coverage %?"
5. Verify it reflects the assets you reviewed

### Step 5: End-to-end smoke test — Freshness Resurfacing

**Type:** Manual (SQL + CLI)

1. Manually set an asset's `last_reviewed_at` to 200 days ago:
   ```sql
   UPDATE assets SET last_reviewed_at = NOW() - INTERVAL '200 days' 
   WHERE asset_id = '<test-asset-id>';
   ```
2. Run the freshness check:
   ```bash
   databricks bundle run -t dev freshness_resurfacing
   ```
3. Verify the asset appears in the review pool

### Step 6: Document results

**Type:** Manual (editor)

Create `docs/research/03_integration_test_results.md` with:
- Test date
- Environment (dev/staging/prod)
- Pass/fail for each smoke test
- Any issues found and their resolution
- Screenshots of key flows

---

### Open Questions

1. **Automated integration tests:** Should we create a CI/CD job that runs these smoke tests automatically on every deploy? If so, which tests can be automated vs. which require manual verification?
2. **Test data seeding:** What's the best approach for seeding realistic test data? A dedicated seed script? Sample fixture YAMLs with known expected results?
