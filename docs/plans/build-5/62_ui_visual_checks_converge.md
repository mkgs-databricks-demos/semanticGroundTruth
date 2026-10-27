# Session 62: Converge UI: Chromium visual + accessibility checks on the deployed app

**Build 5 · wave `5-9` · converge (alone) · target `ui_visual_checks`; the wave gate also checks `app`, `ui_visual_results`**

Owner decision D-B5-2: this is the automated visual gate. Job from session 48.

## Steps

1. From `ground-truth-app`: `bundle deploy --target dev` (or `bundle run app` per follow-up 10) so the job exists; `bundle run ui_visual_checks --target dev`.
2. Read `ui_visual_results` for the run (11 routes × 2 themes × 2 viewports = 44 cells). Every cell `pass`.
3. For each failing cell, open its screenshot from the volume and fix the cause in the app: axe serious/critical (real contrast in the browser, landmark, name), console errors, failed requests, `h1` count, wrong background token, invisible focus ring, render timeout. Fix the job itself only when the check is wrong (record why in the status file). Redeploy the app, let the app gate pass, rerun the job.
4. Report `figma_similarity` per route/theme (informational): list the 5 lowest with their screenshots for the owner's manual Figma comparison (wave `5-11`).
5. Put the summary table (cells, failures fixed, lowest similarity) in your status file; session 63 writes it into the build summary.

## Stable when

Latest `ui_visual_checks` run succeeded with 44/44 cells `pass`, rows in `ui_visual_results` for that run, and the `app` gate still passes.

## Owned paths

* `ground-truth-app/**` (excluding `ground-truth-app/.build-status/**`, `ground-truth-app/.databricks/**`, `ground-truth-app/docs/plans/**`)
* `docs/runbooks/ui_visual_checks.md`

## Dependencies

48, 58, 60, 61
