# Session 11 — App bundle: permissions, bootstrap env, M2M verification, demo seed job

**Wave 1 · edit · run 713417549836954 · 2026-10-23**

## Summary

Re-validation only. Session 11 was already completed in prior run 991892831639332 (2026-10-22) with status `pass`. All 8 files produced by that run are still present and unchanged on the `mg-genie-agent-build` branch. This run re-validated the outputs against the plan acceptance criteria.

## Prior run outputs (verified present)

| File | Purpose |
|---|---|
| `ground-truth-app/databricks.yml` | Added `m2m_client_id_key` variable |
| `ground-truth-app/resources/app.app.yml` | Added `m2m-client-id` secret resource |
| `ground-truth-app/app.yaml` | Added `GT_BOOTSTRAP_ADMIN_IDS` + `GT_ADMIN_EMAILS` env |
| `ground-truth-app/resources/jobs/deploy_verification.job.yml` | M2M OAuth verification job |
| `ground-truth-app/src/notebooks/grant_app_permissions.ipynb` | Additive CAN_USE for users group |
| `ground-truth-app/src/notebooks/deploy_verification.ipynb` | M2M OAuth health/API/MCP checks |
| `ground-truth-app/resources/jobs/demo_campaign_seed.job.yml` | 3-task demo seed job |
| `ground-truth-app/src/notebooks/demo_campaign_seed.ipynb` | Grant, seed, verify tasks |

## Checks

| Check | Result | Detail |
|---|---|---|
| `bundle validate --strict --target dev` | pass | Validation OK! |
| Notebook paths match disk | pass | 4 notebooks in `src/notebooks/`, all YAML `notebook_path` references resolve |
| No hardcoded secrets or SPN IDs | pass | All credentials via `${var.*}` or `valueFrom` |
| pnpm typecheck | skipped | No Node toolchain in Genie Code serverless |
| vitest | skipped | No Node toolchain in Genie Code serverless |

## Decisions

None — no new work performed. All decisions from the prior run carry forward.

## Requests

None.
