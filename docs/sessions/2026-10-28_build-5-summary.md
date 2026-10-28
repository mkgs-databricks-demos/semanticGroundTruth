# Build 5 summary: Figma redesign, steward triage, Share to Slack, infra/agent hardening, Chromium gate

**Date:** 2026-10-28 (started 2026-10-27)
**Build job:** `884230801831394` (Build Waves instance `-sgt-build-5`)
**Run:** `229891579528310` (waves 5-0..5-10; wave 5-11 is a separate run after the owner's manual checks)
**Branch:** `mg-genie-build-5` (plan commit `08766ac`)
**Manifest:** `docs/plans/build-5/waves.json` (sessions 42-64, 12 waves, 14 runtime targets)
**Plans:** `docs/plans/build-5/INDEX.md` · conventions `docs/plans/build-5/build_conventions.md`

## Result

All 21 build sessions (42-62) passed, and waves 5-0..5-9 passed their gates (`.build-status/229891579528310/wave_5-*_gate_result.json`). Wave 5-10 (session 63, this summary) writes the docs. Wave 5-11 (session 64) is the manual acceptance wave (D-B5-2): it waits for the owner to fill [`build-5_manual_checks.md`](build-5_manual_checks.md) (prerequisite `M5`) and then runs as a new build run with `only` = `w5-11_*`.

`.build-status/229891579528310/build_verdict.json` is stale: it was written while wave 5-7 was failing (session 60 blocked on AppKit 0.84.0) and still says `BUILD_FAILED: 5-7`. The 5-7 gate passed after the repair (`wave_5-7_gate_result.json`, commit `952669a`). The final verdict comes from the wave 5-11 run.

| Wave | Sessions | Mode | Commit(s) | Result |
| --- | --- | --- | --- | --- |
| 5-0 | 42 design-system port, 43 UI test harness, 44 contracts + server fixes, 45 app deps + MLflow traces, 46 infra post-deploy hardening, 47 metric view ids + monitoring, 48 `ui_visual_checks` job | edit | `f2312cd`, `a1e25fb` | pass after 1 repair (42 blocked on 6 catalog SVGs, owner download; 44 hit the step limit, resumed) |
| 5-1 | 49 shell + API hooks, 50 Share to Slack server | edit | `72040a2`, `0bdf4f0` | pass after 1 repair (50 blocked on unowned `tests/contract/**`, owner patch `1996517`) |
| 5-2 | 51 Review, 52 Settings, 53 Leaderboard + Assistant, 54 Steward + Executive + Admin | edit | `7f0fc22`, `0abf2c0`, `7aaa6d8` | pass after repair (52 blocked on unowned `Fallback.test.tsx`, owner `9cbae73`; 54 hit the step limit, owner resumed; owner `9cb0412` pinned `NODE_ENV=test` for vitest; `80f8127` contracts.test.ts 53 routes) |
| 5-3 | 55 steward triage screens, 56 Share to Slack UI | edit | `30d04a5`, `a3bd850` | pass after repair (56 blocked on unowned shell tests, owner `fc7a788`; 55 hit the step limit, owner finished S9/S10 tests) |
| 5-4 | 57 converge infra: setup + metric views | converge | `7d23460`, `4e14064`, `2038e82` | pass after 2 repairs (quality-monitor 429 quota -> owner D-B5-4 `9ec1219`; remote branch delete by owner; `files_changed` fix) |
| 5-5 | 58 converge infra: monitoring | converge | `af05653`, `16673bf` | pass after 1 repair (M2M SPN volume grant; owner `6d2b95f` + direct grant) |
| 5-6 | 59 converge agent | converge | `98ba3de` | pass (attempt 1 stable) |
| 5-7 | 60 converge app: deploy | converge | `a3c4173`, `952669a` | pass after 1 repair (AppKit 0.84.0 -> 0.89.0 by the owner, attempt 3 stable) |
| 5-8 | 61 converge app: contract tests | converge | `4a1e239` | pass (attempt 1 stable) |
| 5-9 | 62 converge UI: Chromium visual gate | converge | `3d74b2a` | pass (attempt 3 stable, 44/44) |
| 5-10 | 63 docs + manual-check worksheet | edit | this wave | see `63.json` |
| 5-11 | 64 manual acceptance | edit | pending `M5` | not run |

Other owner commits during the build: `ffc62de` (`GT_FEEDBACK_REPO_URL` from bundle var `feedback_repo_url`), `52c7bc6` + `7befd1a` (`resources/app.app.yml` `config` is the single source of the app command and env; `app.yaml` is a comment stub).

Gate warnings: sessions 44, 54 and 55 hit the Genie Code step limit after (44) or before (54, 55) their final status; the owner resumed 54 and 55.

## Owner decisions

* **D-B5-1 Brand values win:** Green 600 `#00A972`, Yellow 500 `#FCBA33`, Maroon 500 `#AB4057`, Maroon 300 `#D69EA8`; new semantic token `warning-text` (light `#7D5319`, dark `#FFAB00`). `tokens.ts`, `index.css` and `variables.json` agree in both modes (session 42).
* **D-B5-2 Gates are automated; manual checks are the last wave:** jsdom (Testing Library + axe) in every UI session, headless Chromium `ui_visual_checks` as a runtime gate after deploy, manual checks in wave 5-11.
* **D-B5-3 Scope is the whole solution:** infra, app and agent items from `docs/requests/2026-10-27_build-4-follow-ups.md` and `docs/design/ui/**`.
* **D-B5-4 Bronze quality monitor is prod-only (2026-10-28):** the shared metastore is at its 1000 quality-monitor limit (`429 RESOURCE_EXHAUSTED`). The monitor is under `targets.prod` only; dev has none.

## Visual checks (session 62)

`ui_visual_checks` job run `743244124674286` against app deployment `01f1d3145f051b5fbddf309e716f8304`:

| Metric | Value |
| --- | --- |
| Cells | 44/44 pass (11 routes x light/dark x 1440x900/390x844) |
| Attempts | 3 (19/44, then 38/44, then 44/44) |
| Failures fixed | 25 cells: 22 dark `bg_ok`, 2 `/leaderboard` 390 `scrollable-region-focusable`, color-contrast cells over 2 runs (Approve light, Reject dark, admin freshness dark). Also 2 job defects: arm64 lib path, axe node targets |
| axe serious / console errors | 0 / 0 |
| Figma similarity | min 0.858, mean 0.944, max 0.981 (report only) |

Lowest 5 `figma_similarity` (start of the manual Figma comparison): `/settings` dark 390 (0.858), `/` dark 1440 (0.910), `/steward/feedback-branches` dark 390 (0.911), `/steward` dark 390 (0.912), `/steward` light 390 (0.913).

## Gaps

| Gap | Before | After build 5 | Evidence |
| --- | --- | --- | --- |
| G5 Slack | Researched | **Done (Option A); live Send pending manual check** | Sessions 44 (route stubs), 50 (server: `SlackMcpClient` OBO only, `SlackShareService`, steward/admin routes, `ai-gateway` scope), 56 (dialog, bell, asset sheet); contract tests mock the MCP client; live use `draft` only |
| G6 steward triage | Backend done | **Done (screens); manual checks pending** | Sessions 54 (Steward console, Executive, Admin, RoleGate), 55 (Feedback queue S8, Conflicts S9, Feedback branches S10) |
| G7 / G8 UI and accessibility | Partial | **Automated gate done; manual pending wave 5-11** | 44/44 Chromium cells, axe in every jsdom state, `@a11y-strict` files |
| G11 ops observability | Partial | **Prod-only monitor defined (D-B5-4)** | Monitor YAML under `targets.prod`; dev has none (1000-monitor limit); first prod refresh not yet proven |

Full table: `docs/plans/gap_analysis_2026-10.md` §7.

## What was built

**App (`ground-truth-app`)**

* Design system (42): brand-value tokens, `warning-text`, Databricks icon set under `client/public/brand/icons/` (`icons.manifest.json`, no runtime CDN), 11 UI primitives; `contrast.test.ts` / parity tests.
* UI test harness (43): render helpers, schema-checked `mockApi`, fixtures, axe, keyboard, `online`, `media` helpers; opt-in `@a11y-strict` rules.
* Contracts and server (44): `FeedbackBranch.htmlUrl`, `slackShareEnabled` in config, `resurfacedFromSkip`, edit votes need a proposed value (400 over REST and MCP), notify only on create or a status change, 3 Share to Slack routes (53 routes in `ROUTE_CONTRACTS`).
* Dependencies (45, 60): `@mlflow/core` 0.4.0 for AppKit agent traces (`GT_MLFLOW_TRACES`), `pnpm run check:bundle`; AppKit + AppKit UI 0.84.0 -> 0.89.0 (owner, session 60 attempt 3) because 0.84.0-0.88.1 deep-import `@mlflow/core` without `.js` and fail under Node ESM; generated `shared/appkit-types/*.d.ts` committed. `lucide-react` removed.
* Screens (49, 51-56): shell S0/S11 with lazy `/steward/**`, `/executive`, `/admin`, `/settings`; Review S1 (skip reasons, resurfaced badge, K1), Leaderboard S2, Assistant S3, Steward S4, Executive S5, Admin S6, Settings S7, Feedback queue S8, Conflicts S9 (K2), Feedback branches S10, Share to Slack dialog. Entry chunk 235.18 kB gzip (budget 350).
* Converge fixes (60, 62): 13 components `@a11y-strict`; dark tokens also under `:root.dark` (AppKit's `prefers-color-scheme` selector beat `.dark`); Leaderboard table wrapper is the only, focusable scroller; outline vote / destructive buttons on `bg-card`.
* Tests: vitest 1883 pass, 2 skipped (61 files); both `tsc -b` exit 0; live `api_contract_tests` run `281019161761628` 153 pass / 0 fail / 201 `skipped_live`, 100% coverage (61).
* Final deployment `01f1d3145f051b5fbddf309e716f8304`: 12/12 probes, 0 error lines, 307 traces with 0 errors (62).

**Infra (`ground-truth-infra`)**

* One Genie Code automation (46, 57): `genie_automation_lib.py` keeps the automation on the job, else the recorded or previous id; three `post_deploy_setup` runs kept `20536fcd...`; duplicate `e9bdf433...` deleted.
* `deploy.sh --infra` always runs `post_deploy_setup` with `run_setup=true` (46); `setup_cdf_config` widget fix; `bundle_target` job parameter.
* `collect_feedback`: edit votes with no proposed value are recorded processed with reason `no_proposed_value`; `dry_run` widget (46; dry run `987733913612827` in 57).
* Metric view ids are canonical lowercase UUID strings (47; run `244859253802206`, 0 non-UUID values).
* `post_deploy_validation` 11/11 (57). Quality monitor on `bronze_lakebase_cdf`, prod target only (47, D-B5-4, 58). `ui_visual_checks` job + volume (48, 62); M2M SPN READ/WRITE VOLUME through `app_post_deploy_setup` (`6d2b95f`).
* Test data: batch `21bb95ea...` rejected through the app; remote branch `mg-genie-feedback-20261026` deleted by the owner (57).

**Agent (`ground-truth-agent`)**

* No code change (59): deploy no-op; ops dashboard republished, 17/17 datasets execute with UUID string ids (no `hex()` wrapper needed); `agent_verification` `562019912984705` 29/29; Genie space 9 tables, 9 examples, 2 probes.

**Docs**

* Runbooks: `ui_visual_checks.md`, `ui_theming.md`, `deploy_order_and_permissions.md` (infra always runs `post_deploy_setup`; Slack `ai-gateway` consent), `cdf_bronze_operations.md` §6 (prod-only monitor).

## Problems and root causes

| Problem | Root cause | Fix |
| --- | --- | --- |
| Every `post_deploy_setup` made a new automation | Unscheduled automations are not listed and have no `display_name`, so lookup by name never matched | Keep the id on the job / recorded / previous (46, 57) |
| Dev infra deploy hung | Metastore at the 1000 quality-monitor limit; CLI retries the 429 | D-B5-4: monitor prod-only (owner `9ec1219`) |
| `ui_visual_checks` could not write screenshots | M2M SPN grant moved to `app_post_deploy_setup`, not run since | Owner grant (`6d2b95f` + direct) |
| App logged "Cannot find module" and MLflow tracing was off | AppKit 0.84.0-0.88.1 extensionless `@mlflow/core` deep imports | AppKit 0.89.0 (owner) |
| App build failed in Apps prebuild | `NODE_ENV=production` inherited by vitest (`React.act` missing) | `NODE_ENV=test` pin (owner `9cb0412`) |
| Dark theme showed AppKit zinc on an OS in dark mode | `:root:not(.light)` (0,2,0) beat `.dark` (0,1,0) | Dark block also under `:root.dark` (62) |
| Outline buttons failed contrast | AppKit `outline` paints `bg-background` / `dark:bg-input/30` under status-colored labels | `bg-card dark:bg-card` (62); no token change |
| Apps logs tagged passing test titles as ERROR | Ingestion marks any line containing `error:` | 4 test titles renamed (60) |
| Unattended `bundle deploy` fails at `apps update` | "Invalid delegation claim"; state `source_code_path` stale | `bundle run app` fallback; owner terminal deploy still needed (follow-up 10) |
| Sessions blocked on unowned test files | Shared tests (`tests/contract/**`, `Fallback.test.tsx`, shell tests) had no build-5 owner | Owner patches from session summaries (`1996517`, `9cbae73`, `fc7a788`) |

## Open requests (from every status file)

Collected from `.build-status/229891579528310/42.json`..`62.json`. Items still open are in [`../requests/2026-10-28_build-5-follow-ups.md`](../requests/2026-10-28_build-5-follow-ups.md).

| Session | Request | State |
| --- | --- | --- |
| 42 | Green 700 is 4.25:1 as text on Oat Light (owner decision) | Mitigated: session 62 puts those labels on `card` (4.52:1); token unchanged |
| 42, 43 | fixtures / generated schema follow session 44 contracts | Done in wave 5-0 (gate pass) |
| 43 | build-5 UI files start with `// @a11y-strict` | Done (sessions 51-56, 60) |
| 44 | contracts.test.ts route count 50 -> 53 | Done (owner `80f8127`) |
| 44 | `GT_FEEDBACK_REPO_URL` env | Done (owner `ffc62de`, `52c7bc6`) |
| 45 | confirm MLflow agent trace with `gt.*` attributes after deploy | Open (follow-ups #5) |
| 45 | optional: AppKit AGENT span records full chat messages | Open, upstream (follow-ups #12) |
| 45, 50 | app PROJECT_MEMORY / runbook notes | Done (session 63) |
| 46 | app route to mark no-value votes processed | Superseded: app rejects them (44), pipeline records old ones `no_proposed_value` (46); first real run open (follow-ups #6) |
| 47, 58 | monitor created and first refresh writes `bronze_lakebase_cdf_profile_metrics` | Open: prod-only, unproven (follow-ups #1, #2) |
| 47, 59 | `ds_top_skipped_assets` tie-break `ORDER BY skip_count DESC, asset_id` (no `hex()`) | Open (follow-ups #7) |
| 48 | M2M SPN volume grant | Done (owner `6d2b95f`) |
| 49 | `resetOnline()` dispatches an `online` event | Open (follow-ups #10) |
| 51 | expose `skip_cooldown_hours` in `GET /api/config` | Open, optional (follow-ups #9) |
| 52 | Fallback.test.tsx `GET /api/campaigns` | Done (owner `9cbae73`) |
| 52 | apply `settings.motion` / `density` at the root; `/settings` unsaved-changes guard | Open (follow-ups #8) |
| 54 | optional `enabled` for `useCatalogs` / `useSources` | Open, optional (follow-ups #10) |
| 56 | AppLayout / StewardPage `GET /api/config` | Done (owner `fc7a788`) |
| 57 | remote branch `mg-genie-feedback-20261026` delete | Done (owner) |
| 57 | free or raise the monitor quota, then move the monitor back to dev | Open (follow-ups #1) |
| 58 | deploy app so `app_post_deploy_setup` grants the volume | Done (owner direct grant; session 60 deploy re-applies) |
| 60, 61, 62 | owner runs `bundle deploy --target dev` once from a terminal (stale `source_code_path`) | Open (follow-ups #3) |
| 61 | notify-once live invariant becomes a real pass once dev has a proposed / failed batch | Open, optional (follow-ups #11) |
| 62 | compare the 5 lowest-similarity screenshots with Figma | In the worksheet (wave 5-11) |

No session recorded an open suppression except session 50 (`SlackShareService.audit()` logs a failed audit insert at error level without changing the response; recorded with its reason).

## Next

1. Owner: reconnect `system.ai.slack`, run the checks in [`build-5_manual_checks.md`](build-5_manual_checks.md), push it, start a new build run with `only` = `w5-11_*`.
2. Owner: `bundle deploy --target dev` of `ground-truth-app` once from a terminal.
3. After wave 5-11: open the PR for `mg-genie-build-5`.
