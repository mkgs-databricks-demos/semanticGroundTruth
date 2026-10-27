# Build plans — Semantic Ground Truth (all bundles, all builds)

One manifest for everything: [`waves.json`](waves.json) (genie-build-waves instance `-sgt-root`: setup job `818046072228128`, build job `1079028753739581`). Conventions: [`build_conventions.md`](build_conventions.md) (root) and [`app/build_conventions.md`](app/build_conventions.md) (app code rules). Consolidated on 2026-10-24 (owner-approved).

## Layout and naming

* **Waves** are `<build>-<n>` (task prefix `w<build>-<n>`). Builds 1-3 are history (`"archived": true`; scope and some `owned_paths` are condensed, the frozen originals are in [`manifests/`](manifests/)). Build 4 is active.
* **Session ids** are global and never reused: `app-01`..`app-20` (build 1), `01`..`24` (builds 2-3), `25`.. onward.
* **Plan files:** `<session>_<bundle>_[converge_]<topic>.md`, bundle = `app` | `infra` | `agent` | `root`. Build-1 plans keep their original names under [`app/`](app/); the never-run agent bundle plans are under [`agent/`](agent/).
* **Session summaries:** build-wave sessions write to root `docs/sessions/`; interactive per-bundle sessions stay in `<bundle>/docs/sessions/`.

| Build | Waves | Sessions | Result | Frozen manifest |
|---|---|---|---|---|
| 1 — app bundle (edit + first deploy) | 1-0..1-8 | app-01..app-20 | Complete, 2026-10-20/21 | [`manifests/build-1_app.json`](manifests/build-1_app.json) |
| 2 — root: CDF, bronze, metric views, Genie agent, RBAC/import | 2-0..2-5 | 01..15 | Complete, PR #6, run `713417549836954`, main `fbc552b` | [`manifests/build-2_root.json`](manifests/build-2_root.json) |
| 3 — brand UI + gaps | 3-0..3-6 | 16..24 | Complete, PR #7, run `745271774924215`, main `0741bc7` | [`manifests/build-3_brand_gaps.json`](manifests/build-3_brand_gaps.json) |
| 4 — skips, settings, steward APIs, feedback loop, MCP App, contract tests, research | 4-0..4-9 | 25..41 | Waves 4-0..4-8 pass (runs `110489694161084` + `655172288447819`, last wave commit `e5156d4`); wave 4-9 (docs) in this run. See [build-4 summary](../sessions/2026-10-26_build-4-summary.md) | (this manifest) |
| (agent bundle manifest) | — | agent 01..03 | Never run; replaced by build 2 sessions 05, 06, 14 | [`manifests/agent_superseded.json`](manifests/agent_superseded.json) |

## Build 4 (planned 2026-10-24, branch `mg-genie-build-4`)

Scoped with the owner on 2026-10-24 from [`gap_analysis_2026-10.md`](gap_analysis_2026-10.md) and the build-3 follow-ups. Owner decisions: skip is tracked but is not a vote; feedback branches are `mg-genie-feedback-<yyyymmdd>`; Slack/Teams webhooks deferred (research Slack MCP instead); Node toolchain re-tested and documented ([runbook](../runbooks/node_toolchain_genie_code.md)); G10 deletions approved; UI redesign goes through Figma Make before build 5.

| Wave | Session | Plan | Mode | Bundle | Gaps | Status |
|---|---|---|---|---|---|---|
| 4-0 | 25 | [Contracts + migration 009: skips, settings, triage](25_app_contracts_skip_settings_migration.md) | edit | app | skip fix, G6, G17 | pass (`c4a634d`) |
| 4-0 | 26 | [Node toolchain proof, deps, audit](26_app_toolchain_deps_audit.md) | edit | app | Dependabot, G17 | pass (`c4a634d`) |
| 4-0 | 27 | [Feedback pipeline as a Genie Code task + skill](27_infra_feedback_pipeline_genie_task.md) | edit | infra | G4 | pass (`c4a634d`) |
| 4-0 | 28 | [Skip metrics + G10 cleanup](28_infra_skip_metrics_g10_cleanup.md) | edit | infra | G10 | pass (`c4a634d`) |
| 4-0 | 29 | [Operations dashboard](29_agent_operations_dashboard.md) | edit | agent | G11 (partial) | pass (`c4a634d`) |
| 4-0 | 30 | [Research: Slack MCP notifications](30_root_research_slack_mcp_notifications.md) | edit (docs) | root | G5 | pass (`c4a634d`) |
| 4-0 | 31 | [MCP App design](31_root_research_mcp_app_design.md) | edit (docs) | root | G9 | pass (`c4a634d`) |
| 4-0 | 32 | [UI review + Figma Make brief + UI test strategy](32_root_ui_design_review_figma_brief.md) | edit (docs) | root | G6, G8 | pass (`c4a634d`) |
| 4-1 | 33 | [Server: skip, settings, steward APIs](33_app_server_skip_settings_steward_api.md) | edit | app | G6 | pass (`e9e4748`, planner fixes `e14b56f`) |
| 4-2 | 34 | [MCP: review_skip_card + MCP App](34_app_mcp_skip_tool_mcp_app.md) | edit | app | G9 | pass (`339425c`) |
| 4-3 | 35 | [Contract tests (in-process + live job)](35_app_contract_tests.md) | edit | app | G17 | pass on retry (`914746f`) |
| 4-4 | 36 | [Converge app](36_app_converge.md) | converge | app | — | blocked in run `110489694161084` (`8be12a8`); owner fixes `d634f99`/`dca8dc0`; pass in run `655172288447819` (`b83fd52`) |
| 4-5 | 37 | [Converge skips through CDF/bronze/MVs](37_infra_converge_metric_views_skips.md) | converge | infra | G10 | pass, attempt 3 (`1a987a8`) |
| 4-6 | 38 | [Converge feedback pipeline](38_infra_converge_feedback_pipeline.md) | converge | infra | G4 | blocked (`566e041`), app fix `e7c8736`, pass on repair (`fe061da`) |
| 4-7 | 39 | [Converge operations dashboard](39_agent_converge_operations_dashboard.md) | converge | agent | — | pass, attempt 1 (`6d26b3f`) |
| 4-8 | 40 | [Converge live contract tests at 100%](40_app_converge_contract_tests.md) | converge | app | G17 | pass, attempt 3 (`e5156d4`) |
| 4-9 | 41 | [Docs + project memory](41_root_docs_project_memory.md) | edit | root | — | this run (`655172288447819`) |

**How to run build 4** (until genie-build-waves can skip archived waves):

1. Push `mg-genie-build-4`; run setup job `818046072228128` with `build_root` = repo root and `manifest_path` = `docs/plans/waves.json`. It regenerates the build job for all 32 waves.
2. Start the build job with `run-now` `only` = the `w4-*` task keys (copy them from the regenerated job). Do not run archived waves.

**Manual steps (owner):**

* Drop the four empty, unused `ground_truth_app_otel_{logs,spans,metrics,annotations}` tables in `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth` (approved 2026-10-24; empty since 2026-10-19; the app exports to `semantic_ground_truth_otel_*`). The planner's DROP was blocked by the approval layer.
* After build 4: run the Figma Make brief (`docs/design/ui/figma_make_brief.md`), commit the export to `docs/design/ui/figma/`, then plan build 5 from `docs/design/ui/build5_outline.md`.
* Review and merge or close the first `mg-genie-feedback-*` branch.

**Result (2026-10-27):** run `655172288447819` `BUILD_PASSED` (6 wave gates, 3 repairs). Follow-ups: [`docs/requests/2026-10-27_build-4-follow-ups.md`](../requests/2026-10-27_build-4-follow-ups.md) (all request files: [`docs/requests/README.md`](../requests/README.md)).

**Build 5 (outline, after the Figma Make export):** UI shell + Settings, review flow with skip reasons, steward Feedback queue / Conflicts / Feedback branches, admin/executive/leaderboard redesign, Databricks icons (EmptyState, nav), MCP App visual match, Testing Library + axe suite, converge app, manual Lighthouse + keyboard-only check.

## Build 3 — brand UI + gaps (COMPLETE, PR #7, run `745271774924215`)

Branch `mg-genie-ui-brand-and-gaps`. Scoped from [`gap_analysis_2026-10.md`](gap_analysis_2026-10.md) and [`ui_brand_plan.md`](ui_brand_plan.md). Wave ids were `0`..`6`; they are `3-0`..`3-6` in the consolidated manifest.

| Wave | Session | Plan | Mode | Bundle | Gaps |
|---|---|---|---|---|---|
| 0 | 16 | [Brand foundation: tokens, theme, fonts, assets, shell](16_app_brand_foundation.md) | edit | app | G7, G8 |
| 0 | 18 | [Secret-scope READ + bronze refresh job](18_infra_secret_acl_bronze_refresh.md) | edit | infra | G1, G2 |
| 0 | 19 | [MCP card brand](19_app_mcp_card_brand.md) | edit | app | G9 |
| 0 | 20 | [Runtime config, ACL safety net, verification](20_app_runtime_config_verification.md) | edit | app | G1, G3, G17 |
| 0 | 21 | [Executive AI/BI dashboard](21_infra_executive_dashboard.md) | edit | infra | G3 |
| 1 | 17 | [Branded components, a11y, Logic View](17_app_brand_components_a11y.md) | edit | app | G6, G7, G8 |
| 2 | 22a | [Converge secret ACL + bronze refresh](22a_infra_converge_secret_acl_bronze_refresh.md) | converge | infra | G1, G2 |
| 3 | 22b | [Converge executive dashboard](22b_infra_converge_executive_dashboard.md) | converge | infra | G3 |
| 4 | 22c | [Converge agent regression](22c_agent_converge_regression.md) | converge | infra (agent read-only) | — |
| 5 | 23 | [Converge app](23_app_converge.md) | converge | app | all app gaps |
| 6 | 24 | [Docs + project memory](24_root_docs_project_memory.md) | edit | all | — |

Converge sessions have exactly one runtime target each (genie-build-waves planner rule, mbp `5dd1a43`): the original 4-target session 22 became 22a/22b/22c, and session 23 converges `app` only, with `app_deploy_verification` checked by its wave gate.

## Build 2 — root build, waves 0–5 (COMPLETE, PR #6, main `fbc552b`)

Ran on `mg-genie-agent-build` (run `713417549836954`). Wave ids `2-0`..`2-5` in the consolidated manifest.

| Wave | Session | Plan | Mode | Bundle |
|---|---|---|---|---|
| 0 | 01 | [App shared contracts](01_app_contracts_rbac_sources.md) | edit | app |
| 0 | 02 | [Lakebase CDF setup job](02_infra_lakebase_cdf_setup.md) | edit | infra |
| 0 | 03 | [CDF → bronze SDP pipeline](03_infra_cdf_bronze_pipeline.md) | edit | infra |
| 0 | 04 | [Metric views over bronze](04_infra_metric_views_over_bronze.md) | edit | infra |
| 0 | 05 | [Genie space resource](05_agent_genie_space.md) | edit | agent |
| 0 | 06 | [Agent verification job](06_agent_verification_job.md) | edit | agent |
| 1 | 07 | [Migration 007](07_app_migration_007.md) | edit | app |
| 1 | 08 | [RBAC + members](08_app_rbac_membership.md) | edit | app |
| 1 | 09 | [Catalog browse, sources, import](09_app_asset_import_sources.md) | edit | app |
| 1 | 10 | [Client wizard + members page](10_app_client_import_members.md) | edit | app |
| 1 | 11 | [App bundle jobs + demo seed](11_app_bundle_jobs_demo_seed.md) | edit | app |
| 2 | 12 | [Converge app](12_app_converge.md) | converge | app |
| 3 | 13 | [Converge CDF, bronze, metric views](13_infra_converge_data_plane.md) | converge | infra |
| 4 | 14 | [Converge Genie agent](14_agent_converge.md) | converge | agent |
| 5 | 15 | [Docs + project memory](15_root_docs_project_memory.md) | edit | all |

## Build 1 — app bundle build (COMPLETE, 2026-10-20/21)

The app bundle's own manifest (edit waves 0-5, compile fixes 6, converge 7-8). Plans in [`app/`](app/) with their original index [`app/INDEX.md`](app/INDEX.md) (its links use the pre-move names, which are unchanged inside `app/`). Waves `1-0`..`1-8`, sessions `app-01`..`app-20`.

| Wave | Sessions | Topic |
|---|---|---|
| 1-0 | app-01, app-02 | Contracts, server foundation |
| 1-1 | app-03..app-05 | Migrations, middleware, asset registry |
| 1-2 | app-06..app-08 | Review engine, campaigns, notifications |
| 1-3 | app-09, app-10 | REST routes, client API layer |
| 1-4 | app-11..app-14 | MCP server, review UI, secondary pages, agents |
| 1-5 | app-15, app-16 | Tests, docs |
| 1-6 | app-17, app-18 | Compile fixes |
| 1-7 | app-19 | Converge app |
| 1-8 | app-20 | Converge deploy verification |

Older design-level plans that never ran as waves stay with their bundles: `ground-truth-infra/docs/plans/` and the root `*_plan.md` files.
