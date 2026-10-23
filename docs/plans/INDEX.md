# Root build plans — Semantic Ground Truth

Manifest: [`waves.json`](waves.json) (genie-build-waves instance `-sgt-root`, branch `mg-genie-agent-build`). Conventions: [`build_conventions.md`](build_conventions.md).

This root manifest drives all three bundles. It supersedes `ground-truth-agent/docs/plans/waves.json`. The app bundle's own manifest (`ground-truth-app/docs/plans/waves.json`) is left untouched.

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
