# Session 40: Converge app: live contract tests at 100%

**Build 4 · wave `4-8` · converge (alone) · target `api_contract_tests`; the wave gate also checks `app`, `api_contract_results`**

## Steps

1. From `ground-truth-app`: `bundle validate --strict --target dev`; `bundle deploy --target dev`; `bundle run api_contract_tests --target dev`.
2. Read `api_contract_results` for the run. For each `fail`: decide whether the app or the contract is wrong. The contract (plan 25 schemas) is the spec: fix the server, unless the contract contradicts an owner decision recorded in `docs/plans/build_conventions.md`, in which case stop as `blocked` with both sides quoted. Never loosen a schema, delete a check or mark it `skipped_live` to pass. `skipped_live` is allowed only for 403 role checks (the SPN is admin), which the in-process suite covers.
3. After any app fix: redeploy (`bundle deploy`, `bundle run app`), let the app runtime gate pass, then rerun the job.
4. Coverage: the job's own check must show every manifest entry has a row (49 routes, 13 tools, 1 resource, invariants).
5. Confirm cleanup: no `contract-test-*` campaign is left active.

## Stable when

The last `api_contract_tests` run in this build has 0 `fail` rows and 100% coverage, `api_contract_results` has rows for that run, and the `app` runtime gate still passes.

## Owned Paths

- `ground-truth-app/**` (excluding `ground-truth-app/.build-status/**`, `ground-truth-app/.databricks/**`)

## Dependencies

- 35, 36, 38
