# Session 06: Review Engine (Phase E)

## Scope
Implement the Review Engine: Wilson score with an industry prior, the card surfacing algorithm, vote recording, confidence recomputation, certification status, gamification (streaks/badges/leaderboard) and executive summary stats. Pure math lives in separate, unit-tested files.

## Context
* `../docs/design/L200-C2_review_engine.md` (surfacing, scoring, REST shape), `L300-09_scoring_model.md` (Wilson + prior), `L100_semantic_ground_truth_app.md` § gamification.
* Contracts: `build_conventions.md` §7 (ReviewEngine constructor, `DomainEvent`, `AppSettings`). DTOs: `ReviewCard`, `VoteBody`, `VoteResult`, `UserStats`, `LeaderboardEntry`, `ExecutiveSummary`, `ConfidenceScore` (session 01).
* Uses `AssetRegistry` + `MetricViewService` (session 05) and tables from session 03.

## Tasks
1. `server/services/review/wilsonScore.ts` (pure):
   * `wilsonLowerBound(positive: number, total: number, z: number): number` — 0 when `total <= 0`; standard formula; clamp [0, 1].
   * `computeConfidence(input: { approvals: number; rejections: number; edits: number }, s: Pick<AppSettings, 'wilsonZ' | 'industryPrior' | 'priorWeight' | 'priorDecayThreshold'>): { score: number; total: number; priorApplied: boolean }` — `edits` count as 0.5 approval; `w = total >= priorDecayThreshold ? 0 : priorWeight * (1 - total / priorDecayThreshold)`; `score = wilsonLowerBound(approvals + 0.5*edits + industryPrior*w, total + w, wilsonZ)`.
   * `deriveStatus(score: number, total: number, s: Pick<AppSettings, 'certificationThreshold' | 'minVotesForCertification'>): AssetStatus` — `CERTIFIED` if `score >= threshold && total >= minVotes`; `REVIEWED` if `total >= 1`; else `PENDING`.
2. `server/services/review/surfacing.ts` (pure):
   * `interface Candidate { assetId: string; confidence: number; totalVotes: number; lastReviewedAt: string | null; inCampaign: boolean; isNewVersion: boolean }`.
   * `surfacingWeight(c: Candidate, now: Date, stalenessDays: number): number` = `0.5*(1 - confidence) + 0.25*staleness + 0.15*(1 / (1 + totalVotes)) + 0.1*(inCampaign || isNewVersion ? 1 : 0)`, where `staleness = min(1, daysSince(lastReviewedAt ?? never) / stalenessDays)` (never reviewed = 1).
   * `pickWeighted<T>(items: T[], weight: (t: T) => number, rng: () => number = Math.random): T | null`.
   * `reasonFor(c: Candidate, ...): ReviewCard['reason']`.
3. `server/services/review/gamification.ts` (pure): `nextStreak(lastVoteDate: string | null, today: string): { streakDelta: 'same_day' | 'continue' | 'reset' }`, `BADGES` (`first_vote`=1 vote, `ten_votes`, `fifty_votes`, `hundred_votes`, `streak_7`, `streak_30`) and `earnedBadges(totalVotes, streakDays, existing: string[]): string[]` (newly earned only). Dates are UTC `YYYY-MM-DD`.
4. `server/services/review/validationQuery.ts` (pure): `buildValidationQuery(asset: Asset): string | null` — use a `validation_query:` key from `yamlContent` if present; else for a measure with `metric_view:` key -> ``SELECT MEASURE(`<name>`) AS value FROM `<target_catalog>`.`<target_schema>`.`<metric_view>` ``; else `null`. Identifier parts must match `/^[A-Za-z0-9_]+$/`.
5. `server/services/review/reviewEngine.ts` — `class ReviewEngine`:
   * `getNext(user: UserContext, q: GetNextQuery): Promise<ReviewCard | null>` — fetch up to 200 candidates (active assets the user has **not** voted on at the current `version_hash`, optionally filtered by `assetType` and by `campaign_assets` when `campaignId` is set); weight with `surfacingWeight`; pick with `pickWeighted`; hydrate synonyms/examples/confidence via `AssetRegistry`; `progress` = user's votes vs pool size.
   * `submitVote(user: UserContext, body: VoteBody): Promise<VoteResult>` — insert into `app.votes` (`source = user.source`, `version_hash` = asset's current, `campaign_id` = first active campaign containing the asset or null); for `edit` call `assets.applyEdits`; recompute confidence (`recompute(assetId)`); mark `campaign_assets` rows `reviewed`; `assets.touchReviewed`; update `user_activity` (streak + badges); emit `vote.recorded` (with `campaignIds`), `vote.milestone` per new badge, `asset.certified` on transition to CERTIFIED; return `next` card.
   * `recompute(assetId): Promise<ConfidenceScore>` — counts by vote_type at the current version; upsert `app.confidence_scores`; update `assets.status` via `deriveStatus`.
   * `getUserStats(userId): Promise<UserStats>`; `getLeaderboard(period: '7d' | '30d' | 'all', limit = 20): Promise<LeaderboardEntry[]>`; `getExecutiveSummary(): Promise<ExecutiveSummary>`.
   * `runQuery(user: UserContext, assetId: string): Promise<QueryResult>` — `buildValidationQuery` -> `metricViews.runAssetQuery(user, sql)`; `badRequest('No validation query for this asset')` when null.
6. `server/services/review/index.ts` — barrel.
7. Vitest unit tests (pure functions only, no DB): `wilsonScore.test.ts` (known values: `wilsonLowerBound(0,0,1.96)=0`; `wilsonLowerBound(10,10,1.96)≈0.7225`; `wilsonLowerBound(5,10,1.96)≈0.2366`; prior decays to 0 at threshold), `surfacing.test.ts` (never-reviewed low-confidence outranks certified fresh; `pickWeighted` with fixed rng), `gamification.test.ts`, `validationQuery.test.ts`. Import `{ describe, it, expect } from 'vitest'`. Tests are written, not run (no toolchain); mark them `skipped` in checks.

## Acceptance Criteria
- [ ] All exports above exist with exact names/signatures; constructor matches conventions §7.
- [ ] Pure files import nothing from `server/lib/db` or services.
- [ ] Test expectations are mathematically correct (show the hand calculation for the two Wilson values in your summary).
- [ ] One vote = one `INSERT` + idempotent recompute; no client-side BEGIN/COMMIT.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/services/review/**`

## Dependencies
- Sessions 01, 02 (wave 0); 03, 05 (wave 1).
