# Session 61: Converge app: live contract tests at 100% (build 5 contracts)

**Build 5 · wave `5-8` · converge (alone) · target `api_contract_tests`; the wave gate also checks `app`, `api_contract_results`**

Same procedure as build-4 plan `docs/plans/40_app_converge_contract_tests.md`, with the build-5 contract changes from session 44.

## Steps

1. From `ground-truth-app`: `bundle deploy --target dev` (or `bundle run app` per follow-up 10), `bundle run api_contract_tests --target dev`.
2. New checks must be present and pass: `FeedbackBranch.htmlUrl` shape; same-status upsert sends no notification; edit vote without a proposed value → 400 `VALIDATION_ERROR` (REST and MCP `submit_vote`); `/api/config` has `slackShareEnabled`; the 3 Slack routes are `skipped_live: obo-only` and covered in-process; `resurfacedFromSkip` present on review cards.
3. For each `fail`: the contract is the spec; fix the server (redeploy, let the app gate pass, rerun). Coverage 100%.
4. No `contract-test-*` campaign is left active.

## Stable when

Latest `api_contract_tests` run: 0 `fail`, 100% coverage, rows in `api_contract_results`; `app` gate still passes.

## Owned paths

* `ground-truth-app/**` (excluding `ground-truth-app/.build-status/**`, `ground-truth-app/.databricks/**`, `ground-truth-app/docs/plans/**`)

## Dependencies

44, 60
