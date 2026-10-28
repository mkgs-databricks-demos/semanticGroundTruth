# Runbook: `ui_visual_checks` (headless Chromium + axe against the deployed app)

Owner decision D-B5-2 (build 5): UI gates are automated. This job is the runtime visual and accessibility gate for the deployed app (`dev-semantic-ground-truth` in dev). Built in session 48; first real run is session 62 (wave `5-9`). Manual checks (screen reader, touch, forced colors, side-by-side Figma) stay in wave `5-11`.

## What it checks

44 cells: 11 routes x `color_scheme` light/dark x viewport 1440x900 and 390x844.

Routes: `/`, `/leaderboard`, `/assistant`, `/steward`, `/steward/feedback-queue`, `/steward/conflicts`, `/steward/feedback-branches`, `/executive`, `/admin`, `/settings`, `/does-not-exist` (not-found screen).

Per cell (a cell **fails** on any of these):

| Check | Rule | Column |
|---|---|---|
| Render | `[data-testid$="-root"]` visible within 20 s | `status` (reason "render timeout") |
| Accessibility | axe-core, tags `wcag2a wcag2aa wcag21a wcag21aa`, `color-contrast` explicitly on; serious or critical violations > 0 fail | `axe_violations` (all), `axe_serious` (serious + critical) |
| Console | any `console.error` or uncaught page error | `console_errors` |
| Network | any same-origin request that errored or returned HTTP >= 400 | `failed_requests` |
| Heading | exactly one `h1` | `h1_count` |
| Theme | `body` computed background = `#F9F7F4` (light) / `#0B2026` (dark) | `bg_ok` |
| Focus | 15 Tab presses; every focused element (not `body`) has a visible outline (style not none, width > 0, color not transparent) or box-shadow ring (blur/spread > 0, color not transparent) | `focus_ok` |

Report only (never fails a cell): `figma_similarity` = 1 - mean absolute grayscale difference with both images scaled to 360 px width (heights cropped to the shorter one), against `docs/design/ui/figma/<slug>/<slug>__populated__<theme>.png` (390 px cells prefer `__populated-mobile__`). Live data differs from the export's sample data, so expect values well below 1.

Pure logic (matrix, rules, color and focus-ring parsing, similarity) lives in `ground-truth-app/src/notebooks/ui_visual_lib.py`, tested by `ground-truth-app/src/notebooks/tests/test_ui_visual_lib.py`.

## Resources

| Resource | Where |
|---|---|
| Job `ui_visual_checks` (dev name `[dev matthew_giglia] dev-semantic-ground-truth-ui-visual-checks`) | `ground-truth-app/resources/jobs/ui_visual_checks.job.yml` |
| Notebook | `ground-truth-app/src/notebooks/ui_visual_checks.ipynb` |
| Results table `<catalog>.<schema>.ui_visual_results` (created by the job if missing) | dev: `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.ui_visual_results` |
| Screenshot volume `ui_visual_checks` | `ground-truth-infra/resources/ui_visual_checks.volume.yml`; files at `/Volumes/<catalog>/<schema>/ui_visual_checks/<run_id>/<slug>__<theme>__<viewport>.png` |

Job parameters: `app_name`, `secret_scope`, `client_id_key`, `client_secret_key`, `catalog`, `schema` (same as `api_contract_tests`), `output_volume`, `figma_dir`. `run_id` = `{{job.run_id}}`.

## How to run

Prerequisites: infra deployed (the volume exists), app deployed and `RUNNING`, M2M SPN secret present and the SPN has `CAN_USE` on the app and the app `admin` role (as for `api_contract_tests`). The SPN's app theme setting must be `system`, otherwise `color_scheme` emulation cannot switch themes and one theme fails `bg_ok` (the notebook prints a warning).

```bash
cd ground-truth-app
databricks bundle deploy --target dev        # creates/updates the job
databricks bundle run ui_visual_checks --target dev
```

Runtime is roughly 10-20 minutes (pip install + Chromium download, then about 15-25 s per cell). No retries (`max_retries: 0`): a retry would keep the run id and append a second set of rows. Re-run the job instead.

## How to read results

The task output prints a summary table (failures first), the details of each failing cell (reasons, axe rule ids with up to 5 nodes, console messages, failed URLs, focus offenders) and the 5 lowest `figma_similarity` cells.

```sql
-- latest run, failures first
SELECT route, theme, viewport, status, axe_serious, console_errors, failed_requests, h1_count, bg_ok, focus_ok,
       figma_similarity, screenshot_path
FROM hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.ui_visual_results
WHERE run_id = (SELECT max_by(run_id, ts) FROM hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.ui_visual_results)
ORDER BY status = 'pass', route, theme, viewport;
```

Open a screenshot from Catalog Explorer (volume `ui_visual_checks`) or with `databricks fs cp dbfs:/Volumes/<catalog>/<schema>/ui_visual_checks/<run_id>/<file>.png .`.

Fix failures in the app, not in the job. Change the job only when a check is wrong, and record why.

## Rootless Chromium on serverless

Serverless is Ubuntu 24.04 without root. `pip install playwright` and `python -m playwright install chromium` (headless shell) work, but the browser needs 4 libraries that are not installed: `libatk1.0-0t64`, `libatk-bridge2.0-0t64`, `libatspi2.0-0t64`, `libxdamage1`. The notebook downloads and unpacks them without root:

```bash
A=/tmp/apt; mkdir -p $A/lists/partial $A/cache/archives/partial /tmp/cdeps/debs
O="-o Dir::State::Lists=$A/lists -o Dir::Cache=$A/cache -o Debug::NoLocking=1 -o APT::Sandbox::User=$(id -un)"
apt-get $O update && (cd /tmp/cdeps/debs && apt-get $O download libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libxdamage1)
for d in /tmp/cdeps/debs/*.deb; do dpkg -x "$d" /tmp/cdeps/root; done
export LD_LIBRARY_PATH=/tmp/cdeps/root/usr/lib/x86_64-linux-gnu   # aarch64-linux-gnu on arm64 hosts
```

Serverless hosts can be x86_64 or arm64; apt downloads the host's architecture, so the notebook picks the library folder from `platform.machine()` (session 62: an arm64 host failed with `libatk-1.0.so.0: cannot open shared object file` while the folder was hard-coded).

`apt-get` may print `rm: cannot remove '/var/cache/apt/archives/partial/*.deb': Permission denied`; it is harmless (exit code 0).

Other notebook details:

* **Sync API in a thread.** The notebook kernel runs an asyncio loop, and `sync_playwright()` refuses to start inside one ("It looks like you are using Playwright Sync API inside the asyncio loop"). The matrix runs in a single worker thread.
* **axe injection.** axe-core comes from the `axe-playwright-python` wheel (`axe.min.js`); no npm or CDN access is needed. Browser contexts use `bypass_csp=True` so the script can be injected despite the app's Content Security Policy.
* **Auth.** Each cell gets a fresh M2M OAuth token in `extra_http_headers` (`Authorization: Bearer ...`); the Apps proxy rejects a PAT.
* **axe details.** Each axe entry in the task output is `rule(impact, n nodes): <selector> -> <failure summary> | ...` (up to 5 nodes), e.g. the measured foreground/background colors and ratio for `color-contrast`.

## First runs (session 62, build 5 wave 5-9)

| Job run | App deployment | Cells pass | Failures and fixes |
|---|---|---|---|
| `1099658488939115` | `01f1d3029bf1` | 19/44 | 22 dark cells `bg_ok` false: body `lab(2.51 ...)` = AppKit's zinc `oklch(0.141 ...)`. AppKit declares its dark palette in `@media (prefers-color-scheme: dark) { :root:not(.light) }` (specificity 0,2,0), which beat the app's `.dark` (0,1,0) whenever the OS is dark. Fix: `client/src/index.css` lists the dark block under `:root.dark, .dark` (guarded by `theme/dark-specificity.test.ts`). `/leaderboard` 390 px: `scrollable-region-focusable` on AppKit's inner `table-container`; fix: `LeaderboardTable` wrapper is the only scroller and a focusable named region. `/` light: color-contrast (see next row). |
| `493269714873880` | `01f1d311f641` | 38/44 | color-contrast on colored-label outline buttons: AppKit's outline variant paints `bg-background` (light) / `bg-input/30` (dark) under the label. Approve `#00875C` on `#F9F7F4` 4.25:1, Reject `#FF5F46` on `#253F47` 3.71:1, admin "Run freshness check" `#FF5F46` on `#304B54` 3.08:1. Fix: those buttons use `bg-card dark:bg-card` (vote-* and destructive are contrast-tested as text on card; lowest 4.52:1). No token values changed. |
| `743244124674286` | `01f1d3145f05` | **44/44** | none |

Lesson: an outline button whose label uses a status color must sit on the surface its token is contrast-tested against (`card`), not on AppKit's outline background.
