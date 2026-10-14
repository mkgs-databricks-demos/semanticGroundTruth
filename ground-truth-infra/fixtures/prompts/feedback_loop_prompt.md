---
# Semantic Ground Truth — Feedback Loop Prompt Rules
# Design source: L300-06, L200-C6, docs/plans/feedback_pipeline_rework_plan.md
# Consumed by: src/notebooks/setup_genie_automation.py
# The § Skill Prompt section is extracted at deploy time and embedded in the
# Genie Code automation prompt ("Ground Truth Feedback Loop" scheduled insight).
# Version: 1.1.0
---

## Purpose

These rules govern how Genie Code generates proposed metric view YAML edits
based on reviewer feedback aggregated by the `feedback_pipeline` job. The
`setup_genie_automation` notebook reads this file, extracts the § Skill Prompt
section, and embeds it in the automation's `user_prompt`.

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

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-10-08 | Initial version — feedback loop YAML edit generation |
| 1.1.0 | 2026-10-11 | Reframed as Genie Code automation prompt rules. Removed UC skill registration section (superseded by setup_genie_automation.py). |
