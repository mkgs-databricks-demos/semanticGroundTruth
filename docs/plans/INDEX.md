# Root build plans — Semantic Ground Truth

Manifest: [`waves.json`](waves.json) (genie-build-waves instance `-sgt-root`, job `1079028753739581`). Conventions: [`build_conventions.md`](build_conventions.md).

This root manifest drives all three bundles. It supersedes `ground-truth-agent/docs/plans/waves.json`. The app bundle's own manifest (`ground-truth-app/docs/plans/waves.json`) is left untouched.

## Next build — brand UI + gaps (DRAFT, 2026-10-23, not run)

Branch `mg-genie-ui-brand-and-gaps`. Scoped from [`gap_analysis_2026-10.md`](gap_analysis_2026-10.md) and [`ui_brand_plan.md`](ui_brand_plan.md). Session ids continue from the root build; 17 runs in wave 1 because it needs 16 and 20.

| Wave | Session | Plan | Mode | Bundle | Gaps |
|---|---|---|---|---|---|
| 0 | 16 | [Brand foundation: tokens, theme, fonts, assets, shell](16_app_brand_foundation.md) | edit | app | G7, G8 |
| 0 | 18 | [Secret-scope READ + bronze refresh job](18_infra_secret_acl_bronze_refresh.md) | edit | infra | G1, G2 |
| 0 | 19 | [MCP card brand](19_app_mcp_card_brand.md) | edit | app | G9 |
| 0 | 20 | [Runtime config, ACL safety net, verification](20_app_runtime_config_verification.md) | edit | app | G1, G3, G17 |
| 0 | 21 | [Executive AI/BI dashboard](21_infra_executive_dashboard.md) | edit | infra | G3 |
| 1 | 17 | [Branded components, a11y, Logic View](17_app_brand_components_a11y.md) | edit | app | G6, G7, G8 |
| 2 | 22a | [Converge secret ACL + bronze refresh](22_converge_infra.md) | converge | infra | G1, G2 |
| 3 | 22b | [Converge executive dashboard](22b_converge_executive_dashboard.md) | converge | infra | G3 |
| 4 | 22c | [Converge agent regression](22c_converge_agent_regression.md) | converge | infra (agent read-only) | — |
| 5 | 23 | [Converge app](23_converge_app.md) | converge | app | all app gaps |
| 6 | 24 | [Docs + project memory](24_docs_project_memory.md) | edit | all | — |

Converge sessions have exactly one runtime target each (genie-build-waves planner rule, mbp `5dd1a43`): the original 4-target session 22 became 22a/22b/22c, and session 23 converges `app` only, with `app_deploy_verification` checked by its wave gate.

Before running: confirm decision D1 in `ui_brand_plan.md`, then run setup job `818046072228128`. Setup regenerates the task graph and, since mbp `231de33`, also writes the build job's `branch` / `build_root` / `manifest_path` defaults from this manifest (closes G13).

## Root build — waves 0–5 (COMPLETE, PR #6, main `fbc552b`)

Ran on `mg-genie-agent-build` (run `713417549836954`). Its manifest is in git history at `fbc552b:docs/plans/waves.json`.

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
| 2 | 12 | [Converge app](12_converge_app.md) | converge | app |
| 3 | 13 | [Converge CDF, bronze, metric views](13_converge_infra_data_plane.md) | converge | infra |
| 4 | 14 | [Converge Genie agent](14_converge_agent.md) | converge | agent |
| 5 | 15 | [Docs + project memory](15_docs_project_memory.md) | edit | all |
