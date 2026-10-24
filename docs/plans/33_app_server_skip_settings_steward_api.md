# Session 33: Server: skip endpoint, user settings, steward triage APIs (G6 backend)

**Build 4 · wave `4-1` · edit · app**

## Scope

Implement the 8 new routes from plan 25, make the review queue honour skips, validate every route's request with the plan 25 zod schemas, and switch the client's skip action from a vote to the skip endpoint. MCP tools are session 34.

## Context

* Contracts, schemas and `ROUTE_CONTRACTS`: `ground-truth-app/shared/contracts/{values,entities,api,review,config,schemas}.ts` (plan 25). Tables: `app.review_skips`, `app.user_settings`, new columns on `app.user_activity`, `app.feedback_batches`, `app.votes` (migration 009).
* Services: `server/services/{review,campaign,notification,asset,metricView,membership,sources}/`; routes `server/routes/*.ts` registered in `server/routes/index.ts`; RBAC middleware (`reviewer` < `steward` < `admin`, app-managed groups). Errors: `server/lib/errors.ts` (`VALIDATION`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `UPSTREAM_ERROR`).
* Client call sites that send `vote_type: 'skip'` today: `client/src/components/review/CardStack.tsx`, `client/src/components/review/SwipeActions.tsx`; API layer `client/src/lib/api/**`.
* Node toolchain allowed in a `/tmp/gt-33/` copy (conventions §0).

## Tasks

1. **Request validation middleware** `server/lib/validate.ts`: `validate({body?, query?, params?})` using the zod schemas; on failure respond `400 {error:{code:'VALIDATION', message, details: issues}}`. Apply it to every route (existing and new) using `ROUTE_CONTRACTS`; no route may parse `req.body` unchecked.
2. **Skip** (`services/review/`): `skip(user, {assetId, campaignId?, reason?}, source)` inserts `app.review_skips` (with the asset's current `version_hash`), bumps `user_activity.total_skips`/`last_skip_at`, writes an activity row, and **does not** touch votes, `confidence_scores`, Wilson inputs, streaks or certification. `getNext` excludes assets the user skipped within `skip_cooldown_hours` (from `app_config`); if every eligible asset is in cooldown, return the oldest-skipped one rather than an empty queue, flagged `resurfacedFromSkip: true`. `POST /api/review/vote` with `voteType: 'skip'` now returns 400 `VALIDATION` with a message pointing at `/api/review/skip`.
3. **Routes:** `POST /api/review/skip` (reviewer, 201 `SkipResponse`); `GET /api/me/settings` (reviewer; returns defaults when no row) and `PUT /api/me/settings` (reviewer; partial update, upsert); `GET /api/review/stats/me` and `GET /api/leaderboard` include skip counts; `GET /api/steward/feedback-queue` (steward; filters `campaignId`, `assetType`, `status=pending|all`, paging); `GET /api/steward/conflicts` (steward; assets with ≥ 2 differing edit proposals for the same field, or edits plus rejects); `POST /api/steward/conflicts/:assetId/resolve` (steward; writes `votes.resolution/resolved_by/resolved_at`, audit log, notifies the edit authors); `GET /api/steward/feedback-branches` (steward); `POST /api/steward/feedback-branches` (admin, used by the feedback job via M2M; upserts `feedback_batches` and notifies all stewards in-app); `POST /api/steward/feedback-branches/:batchId/status` (steward; `in_review|merged|rejected`, sets `reviewed_by/at`).
4. **Admin config:** expose `skipCooldownHours` through the existing admin scoring-config GET/PUT.
5. **Client:** replace the skip-as-vote call in `CardStack.tsx` and `SwipeActions.tsx` with `api.review.skip(...)`; add `api.review.skip`, `api.me.getSettings`, `api.me.updateSettings`, `api.steward.*` in `client/src/lib/api/**`. Optional reason picker is build 5; send no reason now. Keep the `S` shortcut.
6. **Tests** (vitest, mocked `pg`): skip does not change confidence score or vote count; cooldown exclusion and resurfacing; settings defaults and partial update; conflict detection; feedback-branch upsert notifies stewards; RBAC per route (reviewer gets 403 on steward routes); vote with `skip` → 400.
7. Run in `/tmp/gt-33/`: frozen install, `vitest run`, `tsc -b` server and client. Fix all compile errors from plan 25's `VOTE_TYPES` change in owned paths.

## Acceptance Criteria

- [ ] All 49 `ROUTE_CONTRACTS` entries are registered, each behind `validate(...)` and the role the contract states (a vitest walks `ROUTE_CONTRACTS` against the Express router).
- [ ] Skipping never changes `confidence_scores` or vote counts (test).
- [ ] Client no longer sends `voteType: 'skip'` anywhere (`grep`).
- [ ] `vitest run` and both `tsc -b` pass in the temp copy.

## Owned Paths

- `ground-truth-app/server/**`
- `ground-truth-app/client/src/lib/api/**`
- `ground-truth-app/client/src/components/review/CardStack.tsx`
- `ground-truth-app/client/src/components/review/SwipeActions.tsx`

## Exclude Paths

- `ground-truth-app/server/mcp/**`
- `ground-truth-app/server/migrations/**`

## Dependencies

- 25 (contracts + migration), 26 (dependencies/vitest config)
