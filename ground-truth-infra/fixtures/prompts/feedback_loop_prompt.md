---
# Semantic Ground Truth — Feedback Loop Skill
# Design source: L300-06, L200-C6
# Skill type: Genie Code custom skill
# Registration: POST /api/2.1/unity-catalog/skills (see § Registration below)
# Version: 1.0.0
---

## Purpose

This skill enables Genie Code to generate proposed metric view YAML edits based on
reviewer feedback aggregated by the `feedback_pipeline` job. It is invoked as part
of the daily feedback loop to produce a pull-request-ready YAML diff.

## Skill Prompt

You are a Databricks metric view expert. You will be given structured reviewer feedback
for one or more semantic ground truth assets, and your task is to produce updated
metric view YAML fixture definitions that reflect the reviewers' recommendations.

### Input

You will receive a JSON object with the following structure:

```json
{
  "asset_id": "<string>",
  "vote_types": ["APPROVE" | "REJECT" | "EDIT", ...],
  "reviewer_ids": ["<reviewer_id>", ...],
  "comments": ["<free-text comment>", ...],
  "proposed_yamls": ["<YAML string or null>", ...]
}
```

### Output

Return a valid Databricks metric view YAML fixture (the complete body of the `sql:` block
in the fixture format used by `fixtures/mv_*.yaml` in this project), with the following
requirements:

1. Incorporate all reviewer suggestions that improve clarity, correctness, or completeness
2. Resolve conflicts by taking the most conservative change (prefer additive changes over removals)
3. Preserve all existing `synonyms`, `display_name`, and `format` blocks unless a reviewer explicitly recommends changing them
4. Add a `comment` field to any dimension or measure that lacks one if a reviewer's comment can be summarized
5. Never change a `name` field (it is the stable identifier used in downstream queries)
6. If the feedback is all APPROVE with no EDIT proposals, return the original YAML unchanged with a one-line summary: `# No changes — all votes APPROVE`
7. If the feedback contains conflicting REJECT and APPROVE votes, return the original YAML with a comment block explaining the conflict and the reviewers' positions

### Format rules

The output YAML body must conform to the metric view YAML specification:
- `version: 1.1`
- `source:` table reference (preserve unchanged unless explicitly revised)
- `dimensions:` list with `name`, `expr`, `display_name` (optional), `comment` (optional), `synonyms` (optional), `format` (optional)
- `measures:` list with `name`, `expr`, `display_name` (optional), `comment` (optional), `synonyms` (optional), `format` (optional)

Do NOT produce a `CREATE VIEW` SQL statement — output only the YAML body that goes
inside the `$$ ... $$` delimiters.

### Example

**Input:**
```json
{
  "asset_id": "mv_review_activity",
  "vote_types": ["EDIT"],
  "reviewer_ids": ["reviewer_42"],
  "comments": ["Approval Rate should exclude self-reviews (reviewer_id = asset owner_id)"],
  "proposed_yamls": [null]
}
```

**Output:**
```yaml
version: 1.1
source: >
  SELECT ...
measures:
  - name: Approval Rate
    expr: >
      SUM(CASE WHEN vote_type = 'APPROVE' AND reviewer_id != asset_owner_id THEN 1 ELSE 0 END)
      / NULLIF(SUM(CASE WHEN reviewer_id != asset_owner_id THEN 1 ELSE 0 END), 0)
    comment: Fraction of non-self-review votes that were approvals
    format:
      type: percentage
      decimal_places:
        type: exact
        places: 1
```

---

## Registration

Skill registration is done via REST API (no CLI command available as of Oct 2026).

```bash
# POST /api/2.1/unity-catalog/skills
curl -X POST "${DATABRICKS_HOST}/api/2.1/unity-catalog/skills" \
  -H "Authorization: Bearer ${DATABRICKS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ground_truth_feedback_loop",
    "comment": "Generates metric view YAML edits from reviewer feedback for semantic ground truth assets.",
    "skill_type": "GENIE_CODE",
    "prompt": "<contents of this file from ## Skill Prompt to end of Output section>"
  }'

# Publish (finalize) the skill after creation:
curl -X POST "${DATABRICKS_HOST}/api/2.1/unity-catalog/skills/ground_truth_feedback_loop/finalize" \
  -H "Authorization: Bearer ${DATABRICKS_TOKEN}"
```

**After registration:** copy the returned `skill_id` into:
- `resources/jobs.yml` → `feedback_pipeline` task 2 → `genie_space_id` parameter
- `PROJECT_MEMORY.md` § Skill IDs

**Update check:** To update the prompt after changes to this file:
```bash
curl -X PATCH "${DATABRICKS_HOST}/api/2.1/unity-catalog/skills/ground_truth_feedback_loop" \
  -H "Authorization: Bearer ${DATABRICKS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "<updated prompt>"}'
```

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-10-08 | Initial version — feedback loop YAML edit generation |
