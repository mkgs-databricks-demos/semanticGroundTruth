# Build Plans — ground-truth-agent (Genie Build Waves)

Manifest: [`waves.json`](waves.json) · Design docs: [L200-C9](../../docs/design/L200-C9_operational_genie_agent.md), [L300-14](../../docs/design/L300-14_genie_agent_creation.md), [L300-15](../../docs/design/L300-15_bundle3_deploy.md)

**Mode:** git · **Branch:** `mg-genie-agent-build` · **Target:** `dev` · **Planned:** 2026-10-21

Genie Agent over metric views for operational analytics. 3 sessions across 2 waves. Depends on Part A (app deploy, waves 6–8 on `mg-genie-app-first-deploy`) completing first.

| Wave | Session | Plan | Owned paths | Depends on |
|---|---|---|---|---|
| 0 Config | 01 | [Bundle config + Genie Agent resource](01_bundle_config_and_genie_resource.md) | `databricks.yml`, `ground_truth_ops.geniespace.json` | — |
| 0 Config | 02 | [Metric view SQL + deploy/verification jobs](02_metric_views_and_deploy_jobs.md) | `src/notebooks/**`, `resources/jobs/**` | — |
| 1 Converge | 03 | [Deploy agent, create metric views, verify](03_converge_deploy_and_verify.md) | All owned paths + infra fixture drift fixes | 01, 02, Part A w8 |

## Data sources

### Business metric views (4, from infra fixtures)
* `mv_review_activity` — votes, reviewers, approval rate (source: `lb_votes_history`)
* `mv_coverage_metrics` — coverage %, certification rate (source: `lb_assets_history`)
* `mv_user_leaderboard` — top reviewers, streaks (source: `lb_user_activity_history`)
* `mv_feedback_pipeline` — batch success rates (source: `lb_feedback_batches_history`)

### Operational metric views (2, new)
* `mv_otel_error_rate` — error counts by severity/time (source: `semantic_ground_truth_otel_logs`)
* `mv_otel_request_latency` — p50/p95/p99 latency (source: `semantic_ground_truth_otel_spans`)

## Known risks
* Lakehouse Sync tables (`lb_*_history`) don’t exist yet — require app to deploy first.
* Infra metric view column names may not match actual app schema (column drift).
* `genie_spaces` resource type requires `engine: direct` (already set).
* Genie Agent benchmarking (L300-15) is a manual follow-up, not automated in this build.
