---
# Semantic Ground Truth — Feedback Loop Prompt Rules
# Design source: L300-06, L200-C6, docs/plans/feedback_pipeline_rework_plan.md
# Consumed by: src/notebooks/setup_genie_automation.py
# The § Automation Prompt block is extracted at deploy time and becomes the
# user_prompt of the "Ground Truth Feedback Author (<target>)" Genie Code
# automation. The rules live in the versioned skill
# fixtures/skills/ground-truth-feedback-author/SKILL.md, not here.
# Version: 2.0.0
---

## Purpose

Thin pointer. The `feedback_pipeline` job's `author_feedback_branch` task is a
Genie Code task (`genie_task`) whose automation prompt is the block below. The
prompt only passes the per-run values (as `{{name}}` placeholders filled from
`genie_task.parameters`) and tells Genie Code to read and follow the versioned
skill [`fixtures/skills/ground-truth-feedback-author/SKILL.md`](../skills/ground-truth-feedback-author/SKILL.md)
at its bundle-deployed path (`{{skill_path}}`).

`setup_genie_automation.py` replaces `__SKILL_VERSION__` with the skill's
`version` and updates the automation's `user_prompt` when it changes. Keep every
`{{name}}` placeholder in sync with `setup_job_params.py` /
`feedback_pipeline.job.yml` (`author_feedback_branch` parameters).

## Automation Prompt

```text
You are the Semantic Ground Truth feedback author, running unattended as the author_feedback_branch task of the feedback_pipeline job.

Inputs for this run:
- run_date: {{run_date}}
- batch_id: {{batch_id}}
- branch_prefix: {{branch_prefix}}
- feedback_table: {{feedback_table}}
- repo_path: {{repo_path}}
- base_branch: {{base_branch}}
- skill_path: {{skill_path}}

1. Read the skill file at {{skill_path}} and follow it exactly. It is the only source of rules for this task (expected skill version: __SKILL_VERSION__). If you cannot read it, change nothing and report branch null with reason bad_input.
2. Process only rows of {{feedback_table}} with batch_id = '{{batch_id}}'.
3. The only branch name you may create is {{branch_prefix}}{{run_date}}, or {{branch_prefix}}{{run_date}}-2, -3 ... when it already exists on the remote. Start from {{base_branch}}. Never commit to {{base_branch}} or main, never merge, never force-push.
4. End your response with the JSON summary block defined by the skill, including "batch_id" and "skill_version" (the version field of the skill file you actually read).
```

---

## Superseded rules (1.1.0, kept for history)

The 1.1.0 inline rules below are no longer sent to Genie Code; the skill
replaces them.

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
| 2.0.0 | 2026-10-24 | Thin pointer to the versioned skill `ground-truth-feedback-author` 1.0.0. New § Automation Prompt with `{{run_date}}`, `{{batch_id}}`, `{{branch_prefix}}`, `{{feedback_table}}`, `{{repo_path}}`, `{{base_branch}}`, `{{skill_path}}` placeholders; branches are `mg-genie-feedback-<yyyymmdd>`. Old rules kept above as history only. |
