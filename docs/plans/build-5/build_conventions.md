# Build 5 conventions (sessions 42-64, waves `5-0`..`5-11`)

Read this before every build-5 session. It overrides `docs/plans/build_conventions.md` (root conventions) where they disagree; the root file still applies otherwise (§1 build rules, §2 identifiers, §3 RBAC, §9 calling the app). If the session `scope` in `docs/plans/build-5/waves.json` disagrees with this file, `scope` wins.

Decisions below were made by the project owner on 2026-10-27 and are not open for redesign inside a session.

## 1. Workflow

* **Manifest:** `docs/plans/build-5/waves.json` (build 5 only, nothing archived). Plans: `docs/plans/build-5/`. Status: `.build-status/` (gitignored).
* **Build Waves instance:** `-sgt-build-5` (its own build, setup and smoke jobs). The build-4 instance (job `1079028753739581`) is not used and not changed.
* **Branch:** `mg-genie-build-5` (holds the plan commit; the build commits on top of it). Never commit to `main`.
* **Session ids** continue from build 4 (42-64) so ids stay unique across builds.
* **Plan files are planner-owned.** No session edits `docs/plans/**` except session 63 (`docs/plans/build-5/INDEX.md` status column and `docs/plans/gap_analysis_2026-10.md`).

## 2. Owner decisions (2026-10-27)

* **D-B5-1 Brand values win.** Brand primitives in `ground-truth-app/client/src/theme/tokens.ts` are corrected to the Databricks brand values (also in `docs/design/ui/figma/design-system/variables.json`):

  | Primitive | Today (wrong) | Build 5 |
  |---|---|---|
  | Green 600 | `#3AA278` | `#00A972` |
  | Yellow 500 | `#FFB800` | `#FCBA33` |
  | Maroon 500 | `#9E2B6E` | `#AB4057` |
  | Maroon 300 | `#D776A8` | `#D69EA8` |

  Add the semantic token `warning-text` (light `#7D5319` Yellow 800, dark `#FFAB00` Yellow 600). Every semantic token in `variables.json` must equal `tokens.ts` and `index.css` in both modes. Sessions do not pick new colors: if a corrected value fails a contrast pair used in the app, record a `request` and stop `blocked`.
* **D-B5-2 Gates are automated; manual checks are the last wave.** UI sessions gate on Testing Library + axe (jsdom). After deploy, the `ui_visual_checks` job runs headless Chromium (Playwright) against the deployed app and is a runtime gate. Manual checks (screen reader, touch device, forced colors, Lighthouse if not automated, Figma side-by-side) are recorded by the owner in `docs/sessions/build-5_manual_checks.md` and checked in wave `5-11` (manual prerequisite `M5`).
* **D-B5-3 Scope is the whole solution:** infra, app and agent work from `docs/requests/2026-10-27_build-4-follow-ups.md` and `docs/design/ui/**`.
* **D2 header variant A** (Oat Light / Gray Navigation) per `docs/design/ui/figma/README.md`.

## 3. UI rules

* **Sources, in order:** `docs/design/ui/screen_inventory.md` (behavior, states, findings F1-F11), `docs/design/ui/ui_test_strategy.md` (test ids §3, keyboard flows §6, matrix §8, gate §10), `docs/design/ui/figma/_code/` + screenshots (layout and visuals), `docs/plans/ui_brand_plan.md` (brand rules).
* **The Figma export is reference code.** Port components into `ground-truth-app/client/src/**`; never import from `docs/`. Keep existing data hooks (`@tanstack/react-query`, `lib/api`) and the `shared/contracts` types; the export's mock data stays in tests only.
* **Tokens only:** no Tailwind palette classes, no hex outside `theme/tokens.ts`, `index.css`, `server/mcp/views/**`; `a11y-static.test.ts` and `contrast.test.ts` stay green.
* **Icons:** Databricks icon set from `/Workspace/Shared/brandfolder/assets.csv`, committed under `client/public/brand/icons/` with `icons.manifest.json` (name → attachment id). The 6 icons without an id in the export README (`copyIcon`, `fileCodeIcon`, `arrowUpIcon`, `arrowDownIcon`, `SendIcon`, `FolderBranchIcon`) are looked up in `assets.csv`; if absent, use the closest catalog icon and record the substitution in the manifest. `lucide-react` is removed from every component that build 5 touches. No runtime CDN requests.
* **Every UI session ships its tests:** every §8 row for its screens, axe in every state, `data-testid` per §3. Shared harness: `client/src/test/**` (session 43).
* **Bundle budget:** main chunk ≤ 350 kB gzip; `/steward/**`, `/executive`, `/admin`, `/settings` are lazy routes.
* **MCP App card** (`server/mcp/views/cardHtml.ts`) is unchanged in build 5.

## 4. App rules

* **Node toolchain** per `docs/runbooks/node_toolchain_genie_code.md`. Only session 45 changes `package.json` (session 60 may remove `lucide-react`) / `pnpm-lock.yaml`; every other session runs `pnpm install --frozen-lockfile`.
* **Contracts:** session 44 owns `ground-truth-app/shared/contracts/**` for build 5 (feedback-branch `htmlUrl`, edit-vote validation, Slack share routes). Any other contract change is a `request`.
* **Slack (G5 Option A, `docs/research/05_slack_mcp_notifications.md`):** user-initiated share through `system.ai.slack` with the user's OBO token, steward/admin only, never the app SPN. Automated tests mock the MCP client; live use is `draft` mode only until the manual wave. Prerequisite (owner, before the build): reconnect `system.ai.slack` in Catalog Explorer.
* **MLflow traces:** `@mlflow/core` (session 45) records agent chat traces to the existing app experiment; failures to trace never fail a request.
* **Unattended deploy:** `bundle deploy` from Genie Code can fail with "Invalid delegation claim" (follow-up 10). Session 60 investigates once; the fallback is `bundle run app`.

## 5. Infra and agent rules

* **Infra deploys use `./deploy.sh --target dev --infra`** once session 46 lands; it always runs `post_deploy_setup` so `author_feedback_branch` is never left on the placeholder.
* **`setup_genie_automation`** reuses the automation recorded on the job (or found by name) and updates it in place; two runs give the same automation id.
* **Metric view ids:** BINARY id dimensions in `ground-truth-infra/fixtures/metric_views/*.yaml` become canonical lowercase UUID strings, using the SQL tested in follow-up 4 (`docs/requests/2026-10-27_build-4-follow-ups.md`). No dashboard JSON edits: `*.lvdash.json` files are workspace dashboard objects.
* **G11 Lakehouse Monitoring:** a `quality_monitors` resource on `bronze_lakebase_cdf` in the infra bundle (dev included), time-series profile on the commit timestamp, output in the project schema.
* **Test data cleanup (approved):** session 57 rejects the build-4 test branch `mg-genie-feedback-20261026` through `POST /api/steward/feedback-branches/:batchId/status` and deletes the remote branch. Keep test asset `efaa7f30…` and vote `644eff17…`.
* **Feedback pipeline** runs only from the `semanticGroundTruth-feedback` Git folder.
* **Never add an `ignore_patterns` entry to pass a gate.**
