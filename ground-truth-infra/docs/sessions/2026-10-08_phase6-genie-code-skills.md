# Session Summary: Phase 6 — Genie Code Skills

**Date:** 2026-10-08  
**Branch:** mg-genie-bundle-scaffolds  
**Phase:** 6 of 8  
**Status:** Complete ✅ (file created; manual registration step documented)

---

## What Was Done

### Files Created
- **`src/prompts/feedback_loop_prompt.md`** — versioned Genie Code skill prompt with full spec, registration commands, and version history

---

## Prompt Contents

The `feedback_loop_prompt.md` skill prompt instructs Genie Code to:
1. Accept structured reviewer feedback JSON (asset_id, vote_types, reviewer_ids, comments, proposed_yamls)
2. Produce updated metric view YAML body (LANGUAGE YAML body only, not the SQL CREATE VIEW wrapper)
3. Apply conflict resolution rules: conservative changes, preserve stable `name` fields, add `comment` fields from reviewer text
4. Handle edge cases: all-APPROVE → unchanged YAML; conflicting votes → explain conflict in comment block

---

## Manual Registration Step (out-of-band)

Skill registration uses the REST API (no CLI command as of Oct 2026 — per resolved question #10):

```bash
POST ${DATABRICKS_HOST}/api/2.1/unity-catalog/skills
  body: { name, comment, skill_type: "GENIE_CODE", prompt }

POST .../skills/ground_truth_feedback_loop/finalize
```

After registration:
- Copy returned `skill_id` to `resources/jobs.yml` → `feedback_pipeline` → `genie_space_id` param
- Record in `PROJECT_MEMORY.md` § Skill IDs

---

## Validation

```
databricks bundle validate --strict --target dev
→ Validation OK!
```

---

## Files Modified

| File | Action |
|------|--------|
| `src/prompts/feedback_loop_prompt.md` | Created |
| `fixtures/sessions/2026-10-08_phase6-genie-code-skills.md` | Created — this file |
