# Brand + gaps build summary: genie-build-waves run 745271774924215 and post-build work

* **Date:** 2026-10-23 → 2026-10-24
* **Branch:** `mg-genie-ui-brand-and-gaps` (16 commits ahead of `main`, head `d136316` before this summary)
* **Build job:** `[dev matthew_giglia] Semantic Ground Truth: Build Waves` (`1079028753739581`); setup job `818046072228128` (run `558509899055317`)
* **Build run:** `745271774924215`: 7/7 waves passed, after one repair of `w5_integrate`
* **Manifest:** `docs/plans/waves.json` (sessions 16–24)
* **Framework:** genie-build-waves from the `mbp` repo, branch `mg-genie-build-waves-improvements` (commits `36ad6f1`, `231de33`, `5dd1a43`; not merged to `main` yet)
* **Result:** gaps G1, G2, G3, G7, G8, G9, G17 Done; G6 Partial. App redeployed with real brand assets (deployment `01f1cf6c934d17048daca183beca9788`).

This is the cross-session summary for the whole build plus the interactive work after it. Per-session details are in the `2026-10-23_wN-*.md` and `2026-10-24_w6-24-*.md` files listed in [INDEX.md](INDEX.md). Gap evidence is in [gap analysis §5](../plans/gap_analysis_2026-10.md).

## Goal

Close the gaps found in the post-build review ([2026-10-23_post-build-review-brand-plan.md](2026-10-23_post-build-review-brand-plan.md)):

1. Apply the Databricks brand to the app (tokens, light/dark, fonts, assets, accessibility) per [ui_brand_plan.md](../plans/ui_brand_plan.md).
2. Fix the app SPN's missing READ on the secret scope (G1) and schedule the bronze refresh (G2).
3. Ship the executive AI/BI dashboard and pass its URL to the app at runtime (G3).
4. Run the vitest suite in every Apps build (G17).

## Pre-run: framework review and manifest restructure

* **genie-build-waves improvements reviewed.** These change no files under `resources/`, so no bundle redeploy was needed. The setup run republishes the skills and writes job parameter defaults.
  * `36ad6f1`: gate accuracy (`ELIFECYCLE` dropped from error patterns, default ignore patterns, JSON `"level":(error|fatal)` pattern, tagged error samples).
  * `231de33`: session resilience (provisional `in_progress` status file, credit for incomplete sessions, setup writes `branch`/`build_root`/`manifest_path` defaults).
  * `5dd1a43`: planner rules (one runtime target per converge session, 25–35 min budget, branch-on-remote check).
* **`waves.json` restructured** (`1056ada`) to meet the one-target rule. Session 22 became 22a (`cdf_bronze_refresh`), 22b (`executive_dashboard`) and 22c (`agent_verification`); session 23 converges `app` only, with `app_deploy_verification` checked in the runtime gate; docs moved to wave 6. New plan files `22b_*.md` and `22c_*.md`; `22_converge_infra.md`, `23_converge_app.md` and `INDEX.md` updated.
* **Setup run** `558509899055317` succeeded: 28 tasks (w0–w6), branch default `mg-genie-ui-brand-and-gaps`. This closes gap G13 (stale branch default).

## Waves

| Wave | Mode | Sessions | Outcome | Commit |
| --- | --- | --- | --- | --- |
| 0 | edit | 16 brand foundation · 18 secret ACL + bronze refresh job · 19 MCP card brand · 20 runtime config + verification · 21 executive dashboard | pass | `7465998` |
| 1 | edit | 17 brand components, a11y, Logic View | pass | `3b3e5f4` |
| 2 | converge | 22a `cdf_bronze_refresh` | pass + runtime | `871a607` |
| 3 | converge | 22b `executive_dashboard` | pass + runtime | `25fe180` |
| 4 | converge | 22c `agent_verification` | pass + runtime | `b4f2696` |
| 5 | converge | 23 `app` | pass + runtime (after a repair) | `6771630` + `81ed11f` |
| 6 | edit | 24 project memory, READMEs, gap status, brand runbook | pass | `2e1021d` |

## Problems, root causes, fixes

| # | Problem | Root cause | Fix |
| --- | --- | --- | --- |
| 1 | Wave 5 gate failed although the app was stable (attempt 3, all probes and `deploy_verification` passing) | Session 23 edited `ground-truth-app/app.yaml` **before** attempt 1 and never listed it in any attempt's `files_changed`. The integrator treats a session whose `files_changed` is not the union of its attempts as inconsistent. | Patched `.build-status/745271774924215/23.json` (added `app.yaml` to attempt 1), then `repair_run` from `w5_integrate` with explicit `job_parameters`. Integrator, static gate and runtime gate passed; wave 6 then ran. |
| 2 | Session 23 hard-coded the dashboard URL in `app.yaml` | The plan expected a bundle variable; the session took the shortest path | `6771630`: `app.yaml` value reset to `""`; `app.app.yml` `config.env` maps `GT_EXEC_DASHBOARD_URL` to `${var.exec_dashboard_url}`; `deploy.sh` builds the URL from the infra dashboard ID and passes `--var exec_dashboard_url`. |
| 3 | Plain `bundle deploy --target dev` failed: `Must specify environment variable source using either value or valueFrom` (400) | The Apps API rejects a `config.env` entry whose value resolves to `""` | `bd45836`: the dev target's `exec_dashboard_url` defaults to the published dashboard URL. `deploy.sh` still overrides it. |
| 4 | Header symbol and favicons were placeholders after the build | `ui_brand_plan.md` assumed the images were in `/Shared/brandfolder`; that folder only has the fonts and two CSVs. The images are only on the brandfolder CDN, which build sessions cannot reach. | `05e8c1a` / `d3aefe3`: new `ground-truth-app/src/notebooks/download_brand_assets` (run interactively); plan §5 corrected in `d136316`. |
| 5 | `repair_run` returned `KeyError: 'repair_id'` | The SDK returns a `Wait` object; the repair had actually started | Polled task state instead. A second call failed with "Repair is not allowed on an active run", which confirmed it. |
| 6 | False-failure commit `af67172` ("wave(5): (no passing sessions)") in the history | Integrator commit from the failed first pass | Squashed into `81ed11f` by interactive rebase (sequence editor `sed`), then `push --force-with-lease`. The two `INDEX.md` conflicts were resolved by keeping the corrected session 23 row. |
| 7 | After the rebase, docs cited commit hashes that no longer exist | The rebase rewrote every commit after wave 4 | Updated references in the gap analysis, session 24 summary, `INDEX.md`, both `PROJECT_MEMORY.md` files and `README.md`. |

## Post-build work (interactive, 2026-10-24)

* **Brand plan audit.** Checked the shipped code against `ui_brand_plan.md`. All token decisions match (light and `.dark`: primary, input, muted-foreground, vote, success, ring), as do D1 (Lava 700), the `ThemeProvider` / `MotionConfig` setup, the 6 self-hosted fonts, title and manifest, 0 hard-coded palette classes, the contrast and a11y tests, Logic View, `/api/config` and the MCP card. The two misses were the placeholder header symbol / favicons (fixed below) and `EmptyState.tsx`, which still uses a lucide icon instead of the Databricks primary icons (open).
* **CDN links vs. committed assets.** Decided to commit the assets rather than link to the CDN: the plan forbids runtime CDN calls, the workspace is HIPAA, third-party requests leak usage, there is an availability risk, and MCP host sandboxes block external images.
* **`download_brand_assets` notebook** (`ground-truth-app/src/notebooks/`):
  * Widgets: `public_dir` (blank = derived from the notebook's own location + `relative_public_path`, default `../../client/public`), `brand_subdir` (`brand`), `assets_csv` (`/Workspace/Shared/brandfolder/assets.csv`). Nothing user- or repo-specific is hard-coded; it refuses to create a missing output directory.
  * CDN URLs are looked up by filename in `assets.csv`, and the `?auto=webp&format=png` query is stripped so SVGs download as SVGs.
  * Uses brandfolder's official 16/32/48/512 px orange favicons as-is; derives only 192 px and `apple-touch-icon` (180 px) from 512 px. `favicon.svg` = `databricks-symbol-color.svg`.
  * Verification cell (also runnable on its own) fails on `Placeholder` text, the AppKit colour `#FABFBA`, missing `#FF3621` in `favicon.svg`, wrong PNG sizes or invalid symbol SVGs. Passed.
* **Redeploy.** `bundle deploy --target dev` → deployment `01f1cf6c934d17048daca183beca9788` SUCCEEDED, compute ACTIVE. Files checked on disk. Browser rendering was not checked: the Apps auth sidecar returns the SPA shell to notebook requests.
* **`deploy.sh` wiring.** Already complete in `6771630` (`resolve_infra_vars` reads `resources.dashboards.executive.id`, builds `${WORKSPACE_HOST}/dashboardsv3/<id>/published`, and `APP_EXTRA_ARGS` passes `--var exec_dashboard_url`). No change needed.
* **Docs.** G7 marked Done in gap analysis §5 (`e453407`); `ui_brand_plan.md` §5 sourcing corrected (`d136316`); `docs/runbooks/ui_theming.md`, `README.md` and both `PROJECT_MEMORY.md` files updated for the real assets (this commit).

## Changes delivered (by bundle)

### ground-truth-app
* Brand foundation: `client/src/theme/tokens.ts`, `index.css` (`:root` + `.dark`), `ThemeProvider` + `MotionConfig` in `main.tsx`, DM Sans / DM Mono in `client/public/fonts/`, title, `site.webmanifest`, header symbol and 3-state theme toggle.
* Components: vote tokens, icons, labels, 44 px targets, ←/→/↑/S shortcuts, `aria-live` region; `LogicView.tsx`; `DashboardLink` reads `/api/config`.
* Server: `GET /api/config` (`server/routes/config.ts`); MCP card light/dark tokens (`server/mcp/views/cardHtml.ts`).
* Tests: `contrast.test.ts`, `a11y-static.test.ts`, `cardHtml.test.ts`, `config.test.ts`; `prebuild` runs vitest (21 files green in the Apps build).
* Converge fixes (session 23): `.venv/**` excluded in `vitest.config.ts`, glossary parser subdomain flush, `'skip'` in `VOTE_TYPES`, optional `Asset.synonyms`, strict `useRef` in `CardStack.tsx`.
* Runtime config: `app.app.yml` `config.env` for `GT_EXEC_DASHBOARD_URL`; `exec_dashboard_url` variable with a dev default.
* Jobs: `grant_app_permissions` re-grants scope READ; `deploy_verification` checks the ACL and `/api/config`.
* Real Databricks symbol SVGs, favicons and `download_brand_assets` notebook.

### ground-truth-infra
* Secret scope `permissions` include the app SPN as READ (variable `app_service_principal_id`).
* `cdf_bronze_refresh` job: hourly `pipeline_task` on `cdf_bronze` (paused in dev mode).
* Executive dashboard: `resources/dashboards/executive.dashboard.yml` + `src/dashboards/executive.lvdash.json` (9 datasets over 6 metric views; ID `01f1cf0b38d31b7cbac5bdac6cafe3eb`).

### Solution root
* `deploy.sh`: resolves the app SPN for the scope ACL, the executive dashboard URL, and passes both across bundles.
* `docs/plans/`: gap analysis, brand plan, `waves.json`, plans 16–24; `docs/runbooks/ui_theming.md`.

## Decisions

* **One runtime target per converge session.** Followed the new planner rule. Splitting 22 into 22a/22b/22c made each failure easy to isolate; all three passed on the first try.
* **Patch the status file instead of re-running session 23.** The app was already stable and verified. Re-running would have meant another 25–35 minute converge for a bookkeeping error.
* **Commit brand assets, no runtime CDN.** See post-build work above.
* **Squash the false-failure commit.** The feature branch had not been reviewed, so rewriting it with `--force-with-lease` was acceptable.
* **G7 is Done with one open item.** The theme, tokens, fonts and assets are done. `EmptyState.tsx` icons are listed under "Remaining" in the gap analysis.

## Verification

| Check | Result |
| --- | --- |
| Wave gates 0–6 | pass (`.build-status/745271774924215/wave_N_gate.json`) |
| Wave 5 runtime gate | app RUNNING, deployment `01f1cf13577d1d66a5fb26679855e41d` SUCCEEDED; `deploy_verification` run `4617382917183` SUCCESS |
| `bundle validate --strict --target dev` (app) | Validation OK |
| Redeploy with real assets | deployment `01f1cf6c934d17048daca183beca9788` SUCCEEDED |
| Brand asset verification cell | pass (6 PNG sizes, valid SVGs, `#FF3621`, no placeholders) |
| Old commit hashes in docs after the rebase | none |

## Open follow-ups

* Look at the app in a browser: header symbol, orange favicon, light/dark symbol switch, theme toggle.
* Run `./deploy.sh --target dev --app` once to exercise the `--var exec_dashboard_url` path, then re-check `/api/config`.
* `EmptyState.tsx`: Databricks primary icons (`unity-catalog`, `genie`, `ai-bi`) instead of lucide.
* Lakebase migration if `skip` votes should be stored (`votes.vote_type` CHECK allows `approve`/`reject`/`edit`).
* Manual Lighthouse accessibility and keyboard-only voting checks.
* genie-build-waves bug (fix in the `mbp` repo): the session runner should attribute edits made before attempt 1 to attempt 1's `files_changed`.
* Merge `mg-genie-build-waves-improvements` in `mbp`; until then the build job reads skills and the gate notebook from that branch.
* GitHub reports 35 Dependabot alerts on the default branch (14 high).
* Deferred: G4, G5, G6 steward views, G10–G12.

## Files modified in the post-build session

* `ground-truth-app/client/public/brand/databricks-symbol-{color,light}.svg`, `favicon.svg`, `favicon-{16x16,32x32,48x48,192x192,512x512}.png`, `apple-touch-icon.png`
* `ground-truth-app/src/notebooks/download_brand_assets.ipynb` (new)
* `ground-truth-app/databricks.yml` (dev `exec_dashboard_url` default)
* `ground-truth-app/PROJECT_MEMORY.md`, `PROJECT_MEMORY.md`, `README.md`
* `docs/plans/gap_analysis_2026-10.md`, `docs/plans/ui_brand_plan.md`, `docs/runbooks/ui_theming.md`
* `docs/sessions/INDEX.md`, `docs/sessions/2026-10-24_w6-24-docs-project-memory.md` (rebased hashes), this file
* `.build-status/745271774924215/23.json` (patched for the repair; not tracked in git)
