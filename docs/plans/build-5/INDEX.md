# Build 5 plans

Manifest: [`waves.json`](waves.json) (build 5 only) · conventions: [`build_conventions.md`](build_conventions.md) · Build Waves instance `-sgt-build-5` · branch `mg-genie-build-5` · deploy vars: [`build-waves.vars.json`](build-waves.vars.json).

Inputs: `docs/design/ui/**` (Figma Make export, screen inventory, test strategy; supersedes the session list in `docs/design/ui/build5_outline.md`) and `docs/requests/2026-10-27_build-4-follow-ups.md`.

Status as of 2026-10-28 (run `229891579528310`; session 63). `pass` = the session status and its wave gate passed (several after a repair; see the build 5 summary).

| Wave | Session | Plan | Mode | Status |
|---|---|---|---|---|
| 5-0 | 42 | [Design-system port](42_design_system_port.md) | edit | pass |
| 5-0 | 43 | [UI test harness](43_ui_test_harness.md) | edit | pass |
| 5-0 | 44 | [Contracts + server fixes](44_contracts_and_server_fixes.md) | edit | pass |
| 5-0 | 45 | [App deps + MLflow traces](45_app_deps_and_mlflow_traces.md) | edit | pass |
| 5-0 | 46 | [Infra post-deploy hardening](46_infra_post_deploy_hardening.md) | edit | pass |
| 5-0 | 47 | [Metric view ids + monitoring](47_metric_view_ids_and_monitoring.md) | edit | pass |
| 5-0 | 48 | [ui_visual_checks job](48_ui_visual_checks_job.md) | edit | pass |
| 5-1 | 49 | [Shell + API hooks](49_shell_and_api_hooks.md) | edit | pass |
| 5-1 | 50 | [Share to Slack server](50_slack_share_server.md) | edit | pass |
| 5-2 | 51 | [Review screen](51_review_screen.md) | edit | pass |
| 5-2 | 52 | [Settings screen](52_settings_screen.md) | edit | pass |
| 5-2 | 53 | [Leaderboard + Assistant](53_leaderboard_and_assistant.md) | edit | pass |
| 5-2 | 54 | [Steward + Executive + Admin](54_steward_executive_admin.md) | edit | pass |
| 5-3 | 55 | [Steward triage screens](55_steward_triage_screens.md) | edit | pass |
| 5-3 | 56 | [Share to Slack UI](56_share_to_slack_ui.md) | edit | pass |
| 5-4 | 57 | [Converge infra: setup + metric views](57_infra_converge_setup_and_metric_views.md) | converge | pass |
| 5-5 | 58 | [Converge infra: monitoring](58_infra_converge_monitoring.md) | converge | pass |
| 5-6 | 59 | [Converge agent](59_agent_converge_regression.md) | converge | pass |
| 5-7 | 60 | [Converge app: deploy](60_app_converge_deploy.md) | converge | pass |
| 5-8 | 61 | [Converge app: contract tests](61_app_converge_contract_tests.md) | converge | pass |
| 5-9 | 62 | [Converge UI: Chromium visual gate](62_ui_visual_checks_converge.md) | converge | pass |
| 5-10 | 63 | [Docs + manual-check worksheet](63_docs_and_summary.md) | edit | done in wave 5-10 (see `63.json`; [build 5 summary](../../sessions/2026-10-28_build-5-summary.md)) |
| 5-11 | 64 | [Manual acceptance](64_manual_acceptance.md) (manual prereq `M5`) | edit | pending `M5` ([worksheet](../../sessions/build-5_manual_checks.md)) |

## Running it

1. Deploy the instance from `mbp/genie-build-waves` with `python scripts/deploy_instance.py --target dev --vars <this folder>/build-waves.vars.json` (check-only first), through Python `subprocess`.
2. Run the instance's setup job; expect `Manifest OK: 12 waves, 23 sessions, 14 runtime targets`.
3. Run the instance's build job. Wave `5-11` fails until the owner records the manual checks (`M5`); then start a new run with `only` = the `w5-11_*` task keys.

Owner prerequisites before wave `5-11`: reconnect `system.ai.slack` in Catalog Explorer; fill `docs/sessions/build-5_manual_checks.md`.
