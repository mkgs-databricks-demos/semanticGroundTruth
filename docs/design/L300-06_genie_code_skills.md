# L300-06 — Genie Code Custom Skills (Feedback Loop Prompts)

## Implementation Spec

**Phase:** 1 (Bundle 1 — Infra)
**Type:** Manual + Genie Code
**Prerequisites:** L300-01 complete
**References:** L100 § Technology Decisions (Genie Code prompts)

---

### Step 1: Create the feedback loop skill

**Type:** Genie Code session

Prompt:
```
Create a custom Genie Code skill for the Ground Truth feedback loop.

The skill should:
1. Accept a feedback batch JSON as input (asset name, current YAML, list of user feedback)
2. Analyze the feedback in context of the current metric view YAML
3. Generate a proposed updated YAML that addresses the feedback
4. Validate the proposed YAML is syntactically correct
5. Return the proposed YAML and a summary of changes made

The skill should be versioned and stored in the workspace for reuse across deployments.
```

### Step 2: Version the skill prompt in the repo

**Type:** Manual (editor)

Store the skill definition in `bundle-infra/src/prompts/feedback_loop_prompt.md` (already created in L300-01). This file is the versioned source of truth — changes to the prompt go through the same PR process as code changes.

### Step 3: Register the skill

**Type:** Manual (workspace UI or API)

Register the custom skill in the workspace's Genie Code skills library so it's available to the Genie Code task in the feedback pipeline job.

---

### Open Questions

1. **Skill registration API:** Is there a programmatic API for registering Genie Code custom skills, or is it UI-only? If UI-only, this step can't be fully automated in the DAB.
