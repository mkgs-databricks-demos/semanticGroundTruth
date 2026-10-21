# Session 06: Review Engine

**Wave:** 2 · **Run:** 842455926421383 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Created `server/services/review/` with 10 files: 4 pure utility modules, the ReviewEngine class, a barrel index, and 4 vitest test files. The implementation covers Wilson score confidence with an industry prior, weighted-random card surfacing, gamification (streaks + badges), validation query building, and the full ReviewEngine orchestrator (getNext, submitVote, recompute, getUserStats, getLeaderboard, getExecutiveSummary, runQuery).

## Files Created

| File | Exports |
|---|---|
| `server/services/review/wilsonScore.ts` | `wilsonLowerBound(positive, total, z): number`, `computeConfidence(input, settings): ComputeConfidenceResult`, `deriveStatus(score, total, settings): AssetStatus` + interfaces: `ComputeConfidenceInput`, `ComputeConfidenceSettings`, `ComputeConfidenceResult`, `DeriveStatusSettings` |
| `server/services/review/surfacing.ts` | `surfacingWeight(c, now, stalenessDays): number`, `pickWeighted<T>(items, weight, rng?): T | null`, `reasonFor(c): SurfacingReason` + interface: `Candidate` |
| `server/services/review/gamification.ts` | `nextStreak(lastVoteDate, today): StreakResult`, `BADGES` (as const), `earnedBadges(totalVotes, streakDays, existing): string[]` + interface: `StreakResult` |
| `server/services/review/validationQuery.ts` | `buildValidationQuery(asset): string \| null` |
| `server/services/review/reviewEngine.ts` | `class ReviewEngine` — constructor `(deps: ServiceDeps, assets: AssetRegistry, metricViews: MetricViewService)` — methods: `getNext`, `submitVote`, `recompute`, `getUserStats`, `getLeaderboard`, `getExecutiveSummary`, `runQuery` |
| `server/services/review/index.ts` | Barrel re-export of all above |
| `server/services/review/wilsonScore.test.ts` | Tests: `wilsonLowerBound(0,0,1.96)=0`, `(10,10,1.96)≈0.7225`, `(5,10,1.96)≈0.2366`, prior decay, deriveStatus |
| `server/services/review/surfacing.test.ts` | Tests: never-reviewed outranks certified fresh, campaign +0.1, pickWeighted with fixed rng, reasonFor |
| `server/services/review/gamification.test.ts` | Tests: nextStreak (continue/same_day/reset), BADGES thresholds, earnedBadges (new/multi/dedup) |
| `server/services/review/validationQuery.test.ts` | Tests: null yaml, explicit query, MEASURE builder, non-measure, unsafe identifiers |

## Wilson Score Hand Calculations

**wilsonLowerBound(10, 10, 1.96):**
- p=1.0, z²=3.8416, denom=1.38416, centre=1.19208
- margin = 1.96 × √(0.009604) = 1.96 × 0.098003 ≈ 0.192086
- lower = (1.19208 − 0.192086) / 1.38416 ≈ **0.7225** ✓

**wilsonLowerBound(5, 10, 1.96):**
- p=0.5, denom=1.38416, centre=0.69208
- margin = 1.96 × √(0.034604) = 1.96 × 0.186016 ≈ 0.364591
- lower = (0.69208 − 0.364591) / 1.38416 ≈ **0.2366** ✓

## Checks

| Check | Result |
|---|---|
| `databricks bundle validate --strict --target dev` | pass |
| index.ts exports `wilsonLowerBound`, `computeConfidence`, `deriveStatus`, `surfacingWeight`, `pickWeighted`, `ReviewEngine` | pass |
| No file under `server/services/review/` imports from `campaign` or `notification` | pass |
| Pure files (`wilsonScore`, `surfacing`, `gamification`, `validationQuery`) do not import from `server/lib/db` or services | pass |
| Every relative import resolves to an existing file | pass |
| `wilsonLowerBound(10,10,1.96) ≈ 0.7225` and `(5,10,1.96) ≈ 0.2366` (Python verification) | pass |
| ReviewEngine constructor matches `(deps: ServiceDeps, assets: AssetRegistry, metricViews: MetricViewService)` | pass |
| One vote = one INSERT + idempotent recompute, no BEGIN/COMMIT | pass (static) |
| TypeScript compilation | skipped (no Node toolchain) |
| Vitest test execution | skipped (no Node toolchain) |

## Decisions

* `version_hash` is not on the `Asset` DTO interface — ReviewEngine queries it directly from the DB when needed (submitVote, recompute).
* Wilson upper bound is computed alongside the lower bound in `recompute()` for the `confidence_scores` table, using the same formula inverted.
* `reasonFor` returns `'stale'` as the default fallback for reviewed assets with confidence ≥ 0.3 (no `'random'` case in the current heuristic).
* `pickWeighted` returns the first item when all weights are zero (safe fallback).
* `nextStreak` returns `'continue'` for the first-ever vote (null lastVoteDate).
* `user_activity.badges` stored as JSONB array; parsed from string fallback for safety.
* `getLeaderboard` uses `COUNT(*) FILTER (WHERE ...)` Postgres syntax for per-type counts in a single query.
* `surfacingWeight` uses `Infinity` for `daysSince(null)` which correctly gives staleness = 1 (clamped by `Math.min(1, ...)`).

## Assumptions

* Sessions 03 (migrations) created `app.votes.version_hash` and `app.votes.campaign_id` columns.
* Session 05 (AssetRegistry) `applyEdits` logs proposed edits but does not mutate asset descriptions.
* `app.user_activity.badges` column is JSONB (migration 005).
* `app.confidence_scores` has a UNIQUE/PK on `asset_id` (migration 002).

## Requests

None.
