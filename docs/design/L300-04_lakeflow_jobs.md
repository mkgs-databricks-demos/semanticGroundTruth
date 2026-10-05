# L300-04 — Lakeflow Jobs (Feedback Pipeline, Freshness Resurfacing)

## Implementation Spec

**Phase:** 1 (Bundle 1 — Infra)
**Type:** Genie Code session
**Prerequisites:** L300-02 complete (Lakebase schema deployed), L300-03 complete (warehouse configured)
**References:** L200-C6 § Feedback Pipeline, L200-C5 § Campaign Manager

---

### Step 1: Implement the feedback collection notebook

**Type:** Genie Code session

Prompt:
```
Create bundle-infra/src/notebooks/collect_feedback.py:

This notebook runs as the first task in the daily feedback pipeline job.

1. Connect to Lakebase using the app service principal
2. Query unprocessed votes:
   SELECT v.*, a.name, a.asset_type, a.yaml_content, a.repo_url, a.fixture_path
   FROM votes v JOIN assets a ON v.asset_id = a.asset_id
   WHERE v.processed = FALSE AND v.vote_type IN ('reject', 'edit')
   ORDER BY v.created_at
3. Group votes by asset_id
4. For each asset group:
   a. Read the current fixture YAML from the repo (via Git API)
   b. Compile feedback context JSON:
      {
        "asset_id": "...",
        "asset_name": "...",
        "current_yaml": "...",
        "feedback": [
          {"user": "...", "vote_type": "reject", "feedback": "...", "edits": {...}},
          ...
        ]
      }
5. Write the compiled feedback batch to a temporary Delta table or task value
   for the downstream Genie Code task to consume
6. Create a feedback_batches record with status='pending'
```

### Step 2: Implement the Genie Code feedback prompt

**Type:** Manual (editor)

The Genie Code task uses the prompt from `src/prompts/feedback_loop_prompt.md` (created in L300-01 Step 5). The task receives the feedback batch as context.

### Step 3: Implement the freshness check notebook

**Type:** Genie Code session

Prompt:
```
Create bundle-infra/src/notebooks/freshness_check.py:

This notebook runs daily to identify stale production assets.

1. Connect to Lakebase
2. Query assets approaching freshness expiry:
   SELECT a.*, c.freshness_interval_days
   FROM assets a
   JOIN campaigns c ON c.campaign_type = 'freshness' AND c.status = 'active'
   WHERE a.environment = 'production'
     AND a.is_active = TRUE
     AND (a.last_reviewed_at IS NULL 
          OR a.last_reviewed_at < NOW() - INTERVAL c.freshness_interval_days DAY)
3. For each stale asset:
   a. Check if it's already in an active freshness campaign
   b. If not, add it to the freshness campaign's review pool
   c. Update the campaign's asset count
4. Log: "{N} stale assets added to freshness review pool"
```

### Step 4: Implement the feature branch creation logic

**Type:** Genie Code session

Prompt:
```
Create bundle-infra/src/notebooks/create_feature_branch.py:

This notebook is called after Genie Code generates proposed YAML edits.

1. Read the proposed YAML edits from the Genie Code task output
2. For each asset with proposed changes:
   a. Read the git_token from UC Secrets
   b. Create a feature branch: ground-truth/feedback-{YYYY-MM-DD}-{asset_name_slug}
   c. Commit the proposed YAML to the branch
   d. Update the feedback_batches record with:
      - status = 'completed'
      - feature_branch_url = branch URL
   e. Mark all votes in the batch as processed = TRUE
3. Trigger notification to Data Steward via notification destination API
```

---

### Open Questions

1. **Genie Code task output format:** How does the Genie Code task pass its output (proposed YAML) to the downstream notebook task? Task values? Temporary file? Delta table?
2. **Git API for branch creation:** Which Git API does the notebook use? Databricks Repos API? GitHub API directly? The approach may differ based on the customer's Git provider.
