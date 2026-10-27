# Session 14: Ground Truth Agents (Phase J)

## Scope
Replace the scaffold sample agents with a **Review Assistant** (markdown coordinator, default agent shown on `/assistant`) and a **review-worker** code agent with read-only Ground Truth tools. Add two skills (`review-guide`, `scoring-model`); keep `tracer-bullets`.

## Context
* AppKit agents pattern: `server/agents/planner/agent.md` (frontmatter `default`, `agents`, `skills`) and `server/agents/helper/agent.ts` (`createAgent`, `tool` from `@databricks/appkit/beta`, zod schemas, `annotations: { effect: 'read' }`). Agent id = folder name. Read both before changing them.
* Skills live at `server/agents/skills/<name>/SKILL.md` (see `tracer-bullets`).
* Services via `getServices()` from `server/services/index.ts` (session 09). Tools are **read-only** in V1: agent tool callbacks do not receive the caller's identity in this AppKit version, so no votes or campaign writes from agents (record as assumption; voting happens in the UI and MCP).
* `../docs/design/L300-09_scoring_model.md`, `L200-C2_review_engine.md`, `L100_semantic_ground_truth_app.md` for skill content.

## Tasks
1. Create `server/agents/review-assistant/agent.md` — frontmatter `default: true`, `agents: [review-worker]`, `skills: [review-guide, scoring-model, tracer-bullets]`. Prompt: helps reviewers understand assets, explains confidence scores and certification, suggests what to review next, answers questions about campaigns and leaderboard; never claims to have recorded a vote; directs users to the Review tab for voting.
2. Create `server/agents/review-worker/agent.ts` — `export default createAgent({ instructions, tools })` with tools (all `effect: 'read'`):
   * `get_asset({ asset_id })` -> asset + synonyms + examples + confidence.
   * `search_assets({ asset_type?, status?, limit? })` -> `assets.list`.
   * `explain_confidence({ asset_id })` -> counts, Wilson score, prior weight applied, distance to certification (uses `computeConfidence` + current settings).
   * `get_leaderboard({ period })`, `get_campaigns({ status? })` (no RBAC filter possible without identity: return only campaigns whose assignment is default).
   * `get_coverage_summary()` -> `review.getExecutiveSummary()`.
3. Delete the sample agents `server/agents/planner/` and `server/agents/helper/` (the new `review-assistant` replaces `planner` as default; only one agent may have `default: true`).
4. Create `server/agents/skills/review-guide/SKILL.md` (frontmatter `name`, `description`; how to judge a measure/dimension definition, approve vs reject vs edit criteria, synonym and example-question quality bar) and `server/agents/skills/scoring-model/SKILL.md` (Wilson lower bound with z = 1.96, industry prior and its decay, certification threshold, worked example with 8/10 approvals = 0.4902 lower bound before prior).
5. Keep `server/agents/skills/tracer-bullets/` unchanged.

## Acceptance Criteria
- [ ] Exactly one agent markdown file has `default: true`.
- [ ] `review-worker/agent.ts` imports only from `@databricks/appkit/beta`, `zod`, and relative server modules that exist.
- [ ] No tool writes to the database.
- [ ] `server/agents/planner/` and `server/agents/helper/` no longer exist; `tracer-bullets` unchanged.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/agents/**`

## Dependencies
- Waves 0-3 (06 `computeConfidence`, 09 `getServices`). Parallel with 11, 12, 13.
