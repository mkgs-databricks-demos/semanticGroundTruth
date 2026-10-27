# Session 48 (wave 5-0, build 5): `ui_visual_checks` job

* **Run:** build job run `229891579528310`, branch `mg-genie-build-5`, mode `edit`. Plan: `docs/plans/build-5/48_ui_visual_checks_job.md`. Owner decision D-B5-2.
* **Status:** pass. The job is written and validated; it runs against the deployed app for the first time in session 62 (wave 5-9).

## What was built

| File | Purpose |
|---|---|
| `ground-truth-app/src/notebooks/ui_visual_lib.py` | Pure helpers: 44-cell matrix (11 routes x light/dark x 1440x900/390x844), route -> Figma slug, screenshot path, CSS color parsing, `bg_matches`, focus-ring detection, `axe_counts`, same-origin failed-request rule, `evaluate_cell` (plan pass/fail rules), Figma reference lookup, `image_similarity`, summary table, result column list. |
| `ground-truth-app/src/notebooks/tests/test_ui_visual_lib.py` | 40 pytest cases: matrix, slugs vs the Figma export folders, path guards, colors, focus ring (including Tailwind `outline-none` = transparent outline, `ring-*` box-shadows), axe counts, network rule, each fail rule, similarity on synthetic images (identical, inverse, half changed, height crop), Figma lookup, summary, columns = manifest `required_columns`. |
| `ground-truth-app/src/notebooks/ui_visual_checks.ipynb` | Job notebook: pip deps, rootless Chromium libraries, M2M auth precheck (`/api/me`, theme setting warning), matrix run in Chromium, write `ui_visual_results`, summary, fail on any failing cell. |
| `ground-truth-app/resources/jobs/ui_visual_checks.job.yml` | Serverless job `${var.app_display_name}-ui-visual-checks` (dev: `[dev matthew_giglia] dev-semantic-ground-truth-ui-visual-checks`, matches the manifest runtime target). Same parameters as `api_contract_tests` plus `output_volume` and `figma_dir`; `max_retries: 0`, 1 h timeout, no schedule. |
| `ground-truth-infra/resources/ui_visual_checks.volume.yml` | Managed volume `ui_visual_checks` in the project schema, `prevent_destroy`. |
| `docs/runbooks/ui_visual_checks.md` | What it checks, how to run and read results, rootless Chromium recipe, notebook details. |

## Problems found and decisions

1. **Playwright sync API fails in a notebook.** Running `sync_playwright()` in a Databricks Python cell raises "It looks like you are using Playwright Sync API inside the asyncio loop" (the kernel has a running loop). Reproduced in this session; the notebook runs the whole matrix in one `ThreadPoolExecutor` worker, which I verified works (Chromium launched, axe ran, screenshot taken).
2. **axe without npm/CDN.** The `axe-playwright-python` wheel ships `axe.min.js`; the notebook injects it itself (`runOnly` tags `wcag2a wcag2aa wcag21a wcag21aa`, `color-contrast` explicitly enabled). Nothing vendored, so `src/notebooks/vendor/**` is unused. Browser contexts use `bypass_csp=True` so injection works under a strict CSP (verified on a page with `script-src 'self'`).
3. **Job `environments` not used.** Plan step 1 lists "environment dependencies"; serverless notebook tasks take their environment from the notebook, so the deps are in the first `%pip install` cell (same as `api_contract_tests`). The YAML comment says so.
4. **No M2M SPN grant on the volume.** Plan step 3 asks for `READ_VOLUME`/`WRITE_VOLUME` to the M2M SPN, but no bundle variable holds the SPN's application id (`ensure_m2m_service_principal` creates it at runtime; `agent_skills` has no grants either). The job runs as the deployer, who owns the schema and volume and writes the screenshots; the SPN only authenticates the browser. So no grant is needed for the job to work. Recorded as an assumption and a request (below) in case the owner wants the SPN grant anyway.
5. **Mobile Figma frames.** 390 px cells compare against `<slug>__populated-mobile__<theme>.png` when it exists, else the desktop frame (the export has mobile frames for most screens). Report only.
6. **Theme emulation depends on the SPN setting.** `color_scheme` only switches the app's theme when the SPN's `/api/me/settings` theme is `system`; otherwise one theme fails `bg_ok`. The notebook prints a warning before the matrix. It does not change the setting (no side effects).
7. **Focus check details.** Before tabbing, the page is clicked at (1,1) so Tab starts inside the document; 150 ms after each Tab for ring transitions. Stops that land on `body` are ignored. A cell that throws is recorded as `fail` with the error, and the matrix continues.

## Checks run

| Check | Result |
|---|---|
| `python -m pytest ground-truth-app/src/notebooks/tests` (from the repo root) | pass, 40 passed |
| `bundle validate --strict --target dev` in `ground-truth-app` | pass ("Validation OK!"); the resolved config includes `resources/jobs/ui_visual_checks.job.yml` |
| `bundle validate --strict --target dev` in `ground-truth-infra` | pass ("Validation OK!") |
| Notebook code cells parse (`ast.parse`) | pass, 7 cells (1 markdown, 6 code) |
| Local Chromium smoke (sandbox `/tmp`, static HTML page, no project assets) | pass: rootless libs installed, axe found the planted `color-contrast` (serious), focus check flagged the `outline:none` link and passed the outlined button, `bg_ok` true, 1 `h1`, screenshot taken |
| Job run against the deployed app | not run (edit session, `allow_execute` false); session 62 |

## Requests

* `ground-truth-infra/databricks.yml` (owner): optional. If the M2M SPN should get `READ_VOLUME`/`WRITE_VOLUME` on `ui_visual_checks` (plan 48 step 3), add a variable with its application id (or have `ensure_m2m_service_principal` grant it at runtime), then add a `grants` block to `ui_visual_checks.volume.yml`. Not needed for the job as written.
* Session 62: before the first run, confirm the M2M SPN theme setting is `system` (the notebook warns otherwise), and deploy infra so the volume exists.

## Files modified

All new: the six files in the table above.
