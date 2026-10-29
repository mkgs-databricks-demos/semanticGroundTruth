# Session 48: `ui_visual_checks` job (headless Chromium against the deployed app)

**Build 5 · wave `5-0` · edit (parallel)** · owner decision D-B5-2. Runtime proof is session 62.

## Context

Tested on 2026-10-27 on serverless (Ubuntu 24.04, no root): `pip install playwright`, `python -m playwright install chromium` (headless shell 156) works; launch needs 4 libraries that are not installed: `libatk1.0-0t64`, `libatk-bridge2.0-0t64`, `libatspi2.0-0t64`, `libxdamage1`. Rootless install that works:

```bash
A=/tmp/apt; mkdir -p $A/lists/partial $A/cache/archives/partial /tmp/cdeps/debs
O="-o Dir::State::Lists=$A/lists -o Dir::Cache=$A/cache -o Debug::NoLocking=1 -o APT::Sandbox::User=$(id -un)"
apt-get $O update && (cd /tmp/cdeps/debs && apt-get $O download libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libxdamage1)
for d in /tmp/cdeps/debs/*.deb; do dpkg -x "$d" /tmp/cdeps/root; done
export LD_LIBRARY_PATH=/tmp/cdeps/root/usr/lib/x86_64-linux-gnu
```

## Steps

1. **Job** `ground-truth-app/resources/jobs/ui_visual_checks.job.yml` (pattern of `api_contract_tests.job.yml`: serverless, no schedule, `max_retries: 0`, same app/secret/catalog/schema parameters, plus `figma_dir` default `/Workspace/Users/matthew.giglia@databricks.com/semanticGroundTruth/docs/design/ui/figma` for dev and `output_volume`). Name `${var.app_display_name}-ui-visual-checks`. Environment dependencies: `playwright`, `axe-playwright-python` (or vendored `axe.min.js` from the `axe-core` npm tarball committed under the notebook folder), `pillow`, `numpy`.
2. **Notebook** `ground-truth-app/src/notebooks/ui_visual_checks.ipynb` (+ pure helpers `ui_visual_lib.py`, pytest in `ground-truth-app/src/notebooks/tests/test_ui_visual_lib.py`):
   * Install deps (rootless recipe above), launch Chromium.
   * Auth as the M2M SPN (same secret keys as `api_contract_tests`): OAuth token, `extra_http_headers={'Authorization': 'Bearer …'}`; the SPN is admin in dev, so every route renders.
   * Matrix: routes `/`, `/leaderboard`, `/assistant`, `/steward`, `/steward/feedback-queue`, `/steward/conflicts`, `/steward/feedback-branches`, `/executive`, `/admin`, `/settings`, `/does-not-exist` × `color_scheme` light/dark × viewport 1440×900 and 390×844.
   * Per cell: wait for `[data-testid$="-root"]` (fail after 20 s); record console `error` messages and failed same-origin requests; run axe (WCAG 2.1 AA, **including `color-contrast`**); check exactly one `h1`; check `body` background equals the token (`#F9F7F4` light, `#0B2026` dark); tab 15 times and check every focused element has a visible focus ring (outline or box-shadow width > 0); screenshot to `output_volume/<run_id>/<route>__<theme>__<viewport>.png`.
   * Figma similarity (report only, live data differs from the export's sample data): downscale both to 360 px width, grayscale, mean absolute difference → `figma_similarity` 0-1 when `figma_dir/<slug>/<slug>__populated__<theme>.png` exists.
   * Write one row per cell to `<catalog>.<schema>.ui_visual_results` (`run_id, route, theme, viewport, status, axe_violations, axe_serious, console_errors, failed_requests, h1_count, bg_ok, focus_ok, figma_similarity, screenshot_path, duration_ms, ts`), create table if missing.
   * Fail the task if any cell has `status='fail'` (render timeout, axe serious/critical > 0, console errors > 0, failed requests > 0, `h1_count != 1`, `!bg_ok`, `!focus_ok`). Print a summary table first.
3. **Volume** `ground-truth-infra/resources/ui_visual_checks.volume.yml` (`ui_visual_checks` in the project schema, owner grants as other volumes); the app job's `output_volume` default points at it. Grant the M2M SPN `READ_VOLUME`/`WRITE_VOLUME` via the volume grants in the same file.
4. **Runbook** `docs/runbooks/ui_visual_checks.md`: what it checks, how to run (`bundle run ui_visual_checks --target dev`), how to read results, the rootless Chromium recipe.
5. pytest for `ui_visual_lib.py` (matrix, pass/fail rules, similarity on two synthetic images); `bundle validate --strict --target dev` for app and infra.

## Acceptance

Validate passes for both bundles; pytest passes; the notebook runs end-to-end only in session 62.

## Owned paths

* `ground-truth-app/resources/jobs/ui_visual_checks.job.yml`
* `ground-truth-app/src/notebooks/ui_visual_checks.ipynb`, `ground-truth-app/src/notebooks/ui_visual_lib.py`, `ground-truth-app/src/notebooks/tests/**`, `ground-truth-app/src/notebooks/vendor/**`
* `ground-truth-infra/resources/ui_visual_checks.volume.yml`
* `docs/runbooks/ui_visual_checks.md`

## Dependencies

None.
