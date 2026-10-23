# Session 15 (wave 5, edit): Project memory, runbooks, READMEs

* Run: `713417549836954` (job `1079028753739581`, task `w5_session`), branch `mg-genie-agent-build`
* Mode: `edit`
* Result: **pass**. All 10 owned files created or updated. Both runbooks exist. All resource keys from waves 0–4 mentioned in bundle READMEs.

## Changes

### Root level
* `PROJECT_MEMORY.md` — Added 2026-10-23 status log entry summarizing the root build (waves 0–4). Replaced stale "future Lakebase Lakehouse Sync tables" note with current state (21 history tables active, feeding `bronze_lakebase_cdf`).
* `README.md` — Updated Current Status section: all three bundles now show as deployed with details (app stable with probes, data plane 281 rows / 13 sources / 7 metric views, agent 9 data sources). Updated observability line to include UC tables.

### Runbooks (new)
* `docs/runbooks/onboarding_users.md` — How to add members to app groups, grant `CAN_USE`, grant app SPN `CAN_READ` on Git folders, register sources, create campaigns. Covers UI and API paths, bootstrap admin flow.
* `docs/runbooks/cdf_bronze_operations.md` — Architecture overview (Lakebase → CDF → bronze → metric views), full refresh recovery for schema changes, how to add new Postgres tables to bronze (REPLICA IDENTITY, YAML entry, deploy, optional metric view), current CDF table inventory (21), troubleshooting (PY4J_BLOCKED_API, timestampNtz, empty fixtures_path, wait_timeout).

### Infra bundle
* `ground-truth-infra/PROJECT_MEMORY.md` — Updated header date, replaced stale CDF note, added SDP pipeline resource section, updated source files list (7 metric views, setup_cdf_config notebook, cdf_bronze builder), added 2026-10-23 status log entry.
* `ground-truth-infra/README.md` — Updated resources table (Lakebase CDF, SDP pipeline, 6 jobs, 7 metric views). Updated project structure tree (pipelines dir, lib dir with cdf_bronze, 7 fixture YAMLs, pipelines fixtures).

### Agent bundle
* `ground-truth-agent/PROJECT_MEMORY.md` — Added 2026-10-23 build status. Added Build Results section with wave 0 and wave 4 details, converge fixes. Marked Known Risks 1, 2, 4 as resolved. Marked Open Questions as resolved with actual values.
* `ground-truth-agent/README.md` — Replaced scaffold boilerplate with real content: bundle purpose, resource table (Genie space + verification job), data sources (5 business + 2 operational metric views), targets, deploy commands, project structure, related bundles, design sources.
* `ground-truth-agent/docs/plans/INDEX.md` — Added supersession note: root manifest drives all bundles; local `waves.json` kept for reference only.

### App bundle
* `ground-truth-app/README.md` — Updated Roles section (Lakebase app groups instead of env var lists, link to onboarding runbook). Added Bundle Jobs table (deploy_verification, demo_campaign_seed, app_post_deploy_setup, create_mcp_connection).
* `ground-truth-app/PROJECT_MEMORY.md` — Updated header date. Added 2026-10-23 status log entry (waves 0–2: migration 007/008, RBAC, import, client, seed, converge 7 deploys).

## Checks

| Check | Result |
|---|---|
| `docs/runbooks/onboarding_users.md` exists | pass |
| `docs/runbooks/cdf_bronze_operations.md` exists | pass |
| `PROJECT_MEMORY.md` has 2026-10-23 status log entry | pass |
| Stale "future lb_*_history" note removed | pass |
| Infra README mentions: setup_lakebase_cdf, cdf_bronze, 7 MVs, SDP pipeline, mv_campaign_progress, mv_otel_error_rate, mv_otel_request_latency | pass (all present) |
| App README mentions: deploy_verification, demo_campaign_seed, app_post_deploy_setup, create_mcp_connection, app groups | pass (all present) |
| Agent README mentions: ground_truth_ops, agent_verification, genie_spaces, 9 data sources | pass (all present) |
| Agent INDEX.md notes root manifest supersedes local waves.json | pass |

## Decisions

* Kept the agent-local `docs/plans/waves.json` file rather than deleting it, per the plan ("keep the file") — added a blockquote noting the root manifest supersedes it.
* Wrote runbooks at the solution root (`docs/runbooks/`) rather than in any bundle, since they span multiple bundles.
* Did not touch `ground-truth-app/docs/plans/**` per plan step 5.

## Requests

None.
