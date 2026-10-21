# Session 14: Ground Truth Agents

**Wave:** 4 · **Run:** 16400513324108 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Replaced the scaffold sample agents (planner + helper) with a **review-assistant** markdown coordinator (default agent, shown on `/assistant`) and a **review-worker** code agent with 6 read-only tools backed by `getServices()`. Added two new skills: `review-guide` (how to judge definitions, approve/reject/edit criteria, synonym and example-question quality bar) and `scoring-model` (Wilson lower bound with worked example, industry prior and decay, certification threshold). Kept `tracer-bullets` unchanged.

## Files Created

| File | Exports / Purpose |
|---|---|
| `server/agents/review-assistant/agent.md` | Markdown agent, frontmatter: `default: true`, `agents: [review-worker]`, `skills: [review-guide, scoring-model, tracer-bullets]`. Prompt scopes the agent to read-only Ground Truth Q&A, delegates data lookups to review-worker, and explicitly bars vote claims. |
| `server/agents/review-worker/agent.ts` | `export default createAgent({ instructions, tools })` — 6 tools, all `effect: 'read'`: `get_asset`, `search_assets`, `explain_confidence`, `get_leaderboard`, `get_campaigns`, `get_coverage_summary`. Imports `getServices` from `../../services` and `computeConfidence` from `../../services/review`. |
| `server/agents/skills/review-guide/SKILL.md` | Skill: approve/reject/edit criteria for metric view definitions, synonym quality bar, example question quality bar. |
| `server/agents/skills/scoring-model/SKILL.md` | Skill: Wilson lower bound formula, edits = 0.5 approvals, industry prior with decay, certification threshold, worked example (8/10 approvals = 0.4902 lower bound before prior). |

## Files Deleted

| File | Reason |
|---|---|
| `server/agents/planner/agent.md` | Scaffold sample agent replaced by review-assistant |
| `server/agents/helper/agent.ts` | Scaffold sample agent replaced by review-worker |

## Tool Signatures (review-worker)

| Tool | Schema | Service call |
|---|---|---|
| `get_asset({ asset_id })` | `z.object({ asset_id: z.string() })` | `assets.get` + `listSynonyms` + `listExamples` + DB read `confidence_scores` |
| `search_assets({ asset_type?, status?, limit? })` | Optional string/number filters | `assets.list({ assetType, status, limit })` |
| `explain_confidence({ asset_id })` | `z.object({ asset_id: z.string() })` | DB read `confidence_scores` + `config.get()` + pure `computeConfidence()` |
| `get_leaderboard({ period })` | `z.enum(['7d','30d','all'])` | `review.getLeaderboard(period)` |
| `get_campaigns({ status? })` | Optional status string | Direct DB query with `rbac_groups = '{}'` filter (no user identity available) |
| `get_coverage_summary()` | `z.object({})` | `review.getExecutiveSummary()` |

## Checks

| Check | Result |
|---|---|
| Exactly one `agent.md` has `default: true` | pass |
| `review-worker/agent.ts` relative imports resolve (`../../services`, `../../services/review`) | pass |
| No tool writes to the database (no INSERT/UPDATE/DELETE/DROP, all effects 'read') | pass |
| `planner/agent.md` and `helper/agent.ts` no longer exist | pass |
| `tracer-bullets/` unchanged (SKILL.md + reference.md intact) | pass |
| `databricks bundle validate --strict --target dev` | pass |
| TypeScript compilation | skipped (no Node toolchain) |

## Decisions

* **get_campaigns bypasses CampaignManager.list()** because that method requires a `UserContext` for RBAC filtering. Agent tools do not receive caller identity in V1. Instead, the tool queries the campaigns table directly with `rbac_groups = '{}' OR rbac_groups IS NULL` to return only publicly visible campaigns. Decision documented in plan task 2.
* **explain_confidence reads from confidence_scores table** rather than calling `ReviewEngine.recompute()`, because `recompute()` writes to DB (violates read-only constraint). The pure `computeConfidence()` function is called with the stored vote counts to show the decomposition.
* **Empty directories** `planner/` and `helper/` remain in workspace after file deletion (workspace FS artifact). Git ignores empty directories, so they won't appear after the integrator commits.

## Assumptions

* `getServices()` singleton is initialised by the time agent tools execute (session 09's server.ts startup sequence runs `createServices` before `appkit.server.extend`).
* `AssetRegistry.listSynonyms(assetId)` and `listExamples(assetId)` accept a UUID string (verified in session 05 code).
* `ReviewEngine.getLeaderboard(period, limit?)` accepts `'7d' | '30d' | 'all'` as first arg (verified in session 06 code).
* `ReviewEngine.getExecutiveSummary()` takes no args (verified in session 06 code).
* Agent tool callbacks receive the zod-parsed input object but NOT a `UserContext` (AppKit V1 limitation, per plan context note).

## Requests

None.
