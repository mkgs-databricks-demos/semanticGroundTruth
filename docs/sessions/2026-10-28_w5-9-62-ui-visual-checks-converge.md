# Session 62: Converge UI: `ui_visual_checks` 44/44 on the deployed app (wave 5-9)

* **Run:** build job run `229891579528310`, branch `mg-genie-build-5`, mode `converge`, runtime target `ui_visual_checks` (wave gate also checks `app`, `ui_visual_results`). Plan: `docs/plans/build-5/62_ui_visual_checks_converge.md`. Owner decision D-B5-2.
* **Status:** pass. Attempt 3 stable: job run `743244124674286` SUCCESS, **44/44 cells pass**, on app deployment `01f1d3145f051b5fbddf309e716f8304`.

## Summary table (for session 63)

| Metric | Value |
|---|---|
| Cells | 44/44 pass (11 routes x light/dark x 1440x900/390x844) |
| Attempts | 3 (19/44, then 38/44, then 44/44) |
| Failures fixed | 25 cells: 22 dark `bg_ok`, 2 `/leaderboard` 390 `scrollable-region-focusable`, 6 color-contrast cells over 2 runs (Approve light, Reject dark, admin freshness dark). Also 2 job defects: arm64 lib path, axe node targets |
| Figma similarity | min 0.858, mean 0.944, max 0.981 (report only) |

Lowest 5 `figma_similarity` (for the manual Figma comparison in wave `5-11`), screenshots in `/Volumes/hls_fde_dev/dev_matthew_giglia_semantic_ground_truth/ui_visual_checks/743244124674286/`:

| Route | Theme | Viewport | Similarity | Screenshot |
|---|---|---|---|---|
| `/settings` | dark | 390x844 | 0.858 | `settings__dark__390x844.png` |
| `/` | dark | 1440x900 | 0.910 | `review__dark__1440x900.png` |
| `/steward/feedback-branches` | dark | 390x844 | 0.911 | `steward-feedback-branches__dark__390x844.png` |
| `/steward` | dark | 390x844 | 0.912 | `steward__dark__390x844.png` |
| `/steward` | light | 390x844 | 0.913 | `steward__light__390x844.png` |

Per route/theme (1440 / 390): `/` dark 0.910/0.926, light 0.978/0.960; `/admin` 0.962/0.937, 0.969/0.942; `/assistant` 0.976/0.914, 0.976/0.921; `/does-not-exist` 0.976/0.924, 0.981/0.931; `/executive` 0.968/0.936, 0.971/0.941; `/leaderboard` 0.957/0.925, 0.967/0.932; `/settings` 0.975/0.858, 0.975/0.939; `/steward` 0.951/0.912, 0.953/0.913; `/steward/conflicts` 0.948/0.917, 0.963/0.926; `/steward/feedback-branches` 0.949/0.911, 0.965/0.930; `/steward/feedback-queue` 0.957/0.924, 0.958/0.928.

## Attempts

| # | Job run | App deployment | Result | Errors | Fix |
|---|---|---|---|---|---|
| 1 | `1099658488939115` | `01f1d3029bf1` (unchanged) | unhealthy, 19/44 | Task attempt 1 landed on an arm64 host: `libatk-1.0.so.0` not found (lib folder hard-coded to `x86_64-linux-gnu`); the platform retry ran on x86. 22 dark cells: body `lab(2.51 0.24 -0.89)` instead of `#0B2026`. `/leaderboard` 390 light+dark: `scrollable-region-focusable`. `/` light: color-contrast, node not reported | see problems 1-4 |
| 2 | `493269714873880` | `01f1d311f6411aa489a1271a210587d1` | unhealthy, 38/44 | color-contrast: Approve `#00875C` on `#F9F7F4` 4.25:1 (`/` light); Reject `#FF5F46` on `#253F47` 3.71:1 (`/` dark); "Run freshness check" `#FF5F46` on `#304B54` 3.08:1 (`/admin` dark) | problem 5 |
| 3 | `743244124674286` | `01f1d3145f051b5fbddf309e716f8304` | **stable, 44/44** | none | none |

## Problems, root causes, fixes

1. **Dark theme showed AppKit's palette, not the brand's.** AppKit `styles.css` declares its zinc dark tokens in `@media (prefers-color-scheme: dark) { :root:not(.light) { ... } }`, specificity (0,2,0). The app's `.dark { ... }` (0,1,0) lost to it whenever the OS was dark. The explicit dark theme on a light OS was fine. Real users with an OS in dark mode saw near-black (`oklch(0.141 ...)`) instead of Navy 900. Fix: `client/src/index.css` lists the same block under `:root.dark, .dark`. New `client/src/theme/dark-specificity.test.ts` asserts the selector, its order after the AppKit import, and that AppKit still uses that media selector. Verified in local Chromium with the built CSS: HEAD CSS reproduces `lab(2.51107 0.242703 -0.886115)`, the new CSS gives `rgb(11, 32, 38)` in all 4 class/OS combinations.
2. **Leaderboard table not keyboard-scrollable at 390 px.** AppKit `Table` wraps the `<table>` in its own `overflow-x-auto` `table-container` and spreads props only onto `<table>`. Fix: in `LeaderboardTable`, the wrapper is the only scroller (`[&>[data-slot=table-container]]:overflow-visible`) and is a named, focusable region (`role="region"`, `aria-label={caption}`, `tabIndex={0}`; the global `:focus-visible` ring applies). Local axe on the markup: 1 violation before, 0 after.
3. **Job: arm64 hosts (fixed in the job; the check itself was right).** `ui_visual_checks.ipynb` now picks `aarch64-linux-gnu` or `x86_64-linux-gnu` from `platform.machine()`.
4. **Job: axe node targets missing (fixed in the job; the check itself was right).** `ui_visual_lib.axe_counts` only printed `rule(impact, n nodes)`, though the runbook says it prints nodes. It now appends up to 5 `selector -> failure summary` entries. That made attempt 2's three offenders exact. New pytest `test_axe_counts_lists_node_targets`.
5. **Colored-label outline buttons on the wrong surface.** The vote-* and destructive tokens are contrast-tested as text on `card` (`theme/contrast.test.ts`). AppKit's `outline` variant paints `bg-background` (light, Oat) and `dark:bg-input/30` under them. Fix: `VoteBar` Reject/Edit/Approve and `MaintenanceActions` `DESTRUCTIVE_OUTLINE` add `bg-card dark:bg-card`. tailwind-merge drops the variant's `bg-background` and `dark:bg-input/30` (checked). On card the lowest pair is 4.52:1. No token values changed (build_conventions: sessions do not pick colors). Local axe with the rebuilt CSS: old light reproduces the 4.25:1 violation; the new CSS has 0 in light and dark.

## Decisions

* I fixed the job only where it was wrong for reasons other than the app (arm64, missing diagnostics). No pass rule was changed.
* `bundle deploy --target dev` still fails only on `apps/update` ("Invalid delegation claim", follow-up 10); the job already existed and is source-linked. The app was redeployed with `bundle run app --target dev` (twice), as in sessions 60/61.

## Checks run

| Check | Result |
|---|---|
| `ui_visual_checks` job run `743244124674286` | SUCCESS, 44/44 pass; `ui_visual_results` has 44 rows for the run, new commit v3 (21:23:18Z), all required columns |
| App probes (genie-build-waves `app_probes.py`, M2M SPN) | 12/12, 0 problems |
| App logs, deployment `01f1d3145f05` | 3584 rows, 0 error lines (manifest error/ignore patterns), `listening on` present |
| Traces since deploy | 307 traces, 0 `STATUS_CODE_ERROR` |
| Self-soak (about 3 min after probes) | same deployment, `RUNNING` |
| `/tmp/gt-62` `pnpm exec vitest run` (working tree) | 61 files, 1883 pass, 2 skipped |
| `tsc -b tsconfig.client.json` / `tsconfig.server.json` | exit 0 / exit 0 |
| `pytest ground-truth-app/src/notebooks/tests/test_ui_visual_lib.py` (/tmp copy) | 40 pass, 1 skipped (Figma export folders not in the copy) |
| `bundle validate --strict --target dev` (ground-truth-app) | Validation OK |
| `git status` vs files_changed | 9 files, no strays |

## Files modified

* `ground-truth-app/client/src/index.css`
* `ground-truth-app/client/src/theme/dark-specificity.test.ts` (new)
* `ground-truth-app/client/src/components/leaderboard/LeaderboardTable.tsx`
* `ground-truth-app/client/src/components/review/VoteBar.tsx`
* `ground-truth-app/client/src/components/admin/MaintenanceActions.tsx`
* `ground-truth-app/src/notebooks/ui_visual_checks.ipynb`
* `ground-truth-app/src/notebooks/ui_visual_lib.py`
* `ground-truth-app/src/notebooks/tests/test_ui_visual_lib.py`
* `docs/runbooks/ui_visual_checks.md` (arm64, axe details, first-run table)

All uncommitted (the integrator commits).

## Requests

* Owner (follow-up 10, open): run `bundle deploy --target dev` from a terminal once, to refresh the app's state `source_code_path`.
* Wave `5-11` (manual): compare the 5 lowest similarity screenshots above with Figma; `/settings` dark 390 (0.858) is the outlier.
* Optional (session 63 / owner): other AppKit `outline` buttons with status-color labels should use the same `bg-card dark:bg-card` pairing. I found none besides the four fixed here (grep of `variant="outline"` with `text-vote-*`/`text-destructive`/`text-success`/`text-warning-text`).
