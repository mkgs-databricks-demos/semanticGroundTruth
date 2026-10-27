# Session 44: Contracts + server fixes (feedback branch link, notify once, edit votes, Slack share contract)

**Build 5 · wave `5-0` · edit (parallel)**

Session 44 owns `shared/contracts/**` for all of build 5 (conventions §4).

## Steps

1. **`FeedbackBranch.htmlUrl`** (build5_outline open question 2, follow-up 11): add `htmlUrl: string | null` to the entity, response schemas and generated JSON schemas (`shared/contracts/generate-schemas.ts`). Server: `StewardService` builds it from the configured repo (`GT_FEEDBACK_REPO_URL` env or the Git folder's remote, read once at startup via the workspace Repos API as the app SPN; `null` if unknown) as `<repo>/tree/<branch>`; never stored.
1b. **`ReviewCard.resurfacedFromSkip`** (follow-up 11): if not already in the contract, add `resurfacedFromSkip: boolean` and set it in the review engine when the card's asset has a prior skip by the same user past the cooldown. Unit test.
2. **Notify once** (follow-up 5): `StewardService.upsertFeedbackBranch` sends `feedback.branch_ready` / `feedback.branch_failed` only when the row is created or `status` changes. Unit test + contract test (same-status upsert → 0 notifications).
3. **Edit votes need a proposed value** (follow-up 6): `VoteBody` refine: `voteType: 'edit'` requires at least one `edit_*` field (non-empty after trim); error `VALIDATION_ERROR` with field path. MCP `submit_vote` tool input uses the same refine. Server returns 400. Tests for REST and MCP.
4. **Slack share contract** (G5 Option A, `docs/research/05_slack_mcp_notifications.md` §Exact changes 1): `POST /api/notifications/:id/share-slack`, `POST /api/assets/:id/share-slack`, `GET /api/slack/channels?query=`. Body `{ channelId, message?, mode: 'send'|'draft' }`; response `{ status: 'sent'|'drafted'|'needs_slack_login', permalink?: string }`; `SLACK_SHARE_MODES` in `values.ts`; add `slackShareEnabled: boolean` to the `GET /api/config` response (server returns `true` until session 50 wires the flag); add all three to `ROUTE_CONTRACTS` with `roles: ['steward','admin']`. `server/routes/contracts.test.ts` requires every contracted route to be registered, so create `server/routes/slack.ts` with the 3 routes registered (RBAC enforced, request validated) returning `501 NOT_IMPLEMENTED`, and register it in `server/routes/index.ts`. Session 50 implements them. Add them to the contract-test manifest as `skipped_live: 'obo-only'`.
5. Update `tests/contract/**` manifest so coverage stays 100% (new routes listed).
6. vitest + both `tsc -b` in `/tmp/gt-44/`.

## Acceptance

* `schemas.test.ts`, `api.test.ts`, `stewardService.test.ts`, review/vote tests pass; contract manifest lists the 3 new routes.
* Existing edit votes without a value are handled by session 46 (pipeline), not here.

## Owned paths

* `ground-truth-app/shared/contracts/**`
* `ground-truth-app/server/services/steward/**`
* `ground-truth-app/server/services/review/**`
* `ground-truth-app/server/routes/review.ts`, `ground-truth-app/server/routes/steward.ts`, `ground-truth-app/server/routes/slack.ts`, `ground-truth-app/server/routes/index.ts`, `ground-truth-app/server/routes/config.ts`
* `ground-truth-app/server/mcp/tools/**`
* `ground-truth-app/tests/contract/**`

## Dependencies

None.
