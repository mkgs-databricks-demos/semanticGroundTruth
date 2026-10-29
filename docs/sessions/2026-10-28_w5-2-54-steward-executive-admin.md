# Session 54: Steward console (S4) + Executive (S5) + Admin (S6)

**Build 5 · wave `5-2` · edit · run `229891579528310` · branch `mg-genie-build-5` · 2026-10-28**

Plan: `docs/plans/build-5/54_steward_executive_admin.md`. Status: **pass** (attempt 2).

## What happened

The build session (attempt 1) completed RoleGate, Executive and Admin with their tests, and rewrote the seven Steward files, then hit its step limit before the Steward tests, the summary and its final status. `54.json` was left `in_progress`, and the wave 5-2 gate failed (vitest: 1 failure in `theme/a11y-static` d3, plus session 52's 4 Fallback failures). The owner finished the session on 2026-10-28 (attempt 2).

## Work by step

| Step | Done by | Result |
| --- | --- | --- |
| 1. `components/access/RoleGate.tsx` (F4: loading / error + Retry / forbidden, children mount only when allowed) | session | done |
| 2. Steward console (tabs, campaigns, assets + paging, detail sheet `actions` slot, metric view validate, import wizard, per-tab empty / error, offline) | session (code), owner (fixes + tests) | done |
| 3. Executive S5 (6 KPI groups, dashboard link, unconfigured, empty, error / forbidden / offline) | session | done, 11 tests |
| 4. Admin S6 (three groups, 900 h validation, last-admin 409, notification prefs removed - F8) | session | done, 19 tests |
| 5. `// @a11y-strict` on every written file; S4-S6 rows of `ui_test_strategy.md` §8; F4 on all three pages; axe light + dark | session + owner | done |
| 6. vitest + both `tsc -b` | owner | pass |

## Owner completion (attempt 2)

### Problems and root causes

1. **a11y-static d3 (`pages/steward/StewardPage.tsx` must render exactly one `<h1>`)**: the header comment contained the literal text `<h1>`, and the static check counts every `<h1` match, including comments. Fix: reworded the comment to "level-1 heading".
2. **Import wizard queries ran on every console load**: `ImportWizard` was always mounted, and `useCatalogs` / `useSources` have no `enabled` flag, so `/steward` listed UC catalogs and sources even when nobody opened the wizard. Fix: `StewardPage` mounts the wizard only while it is open. Closing it now also resets the wizard state.
3. **Unhandled promise rejections in the wizard**: `void handleImport()` (and register / scan / create campaign) awaited `mutateAsync` without a catch, so a failed import raised an unhandled rejection in the browser (vitest reported it). Campaign-creation errors were also never shown. Fix: each call catches and returns early, and the error surfaces through `wizardError`, which now also includes `createCampaignM.error`.
4. **Existing-source cards were not keyboard-operable**: the `Card` had an `onClick` and no button role. Fix: the card content is now a `<button type="button" aria-pressed>` (44 px minimum), and the redundant "Selected" icon label was removed because `aria-pressed` carries the selection state.

### Tests: `client/src/components/steward/StewardPage.test.tsx` (21)

| `ui_test_strategy.md` §8 row | Tests |
| --- | --- |
| S4 loading / populated (3 tabs) | access skeleton with no steward requests; campaigns skeleton; tablist "Steward views" with 3 tabs; campaign rows (name, progress, status group) and no wizard requests while closed; status PATCH body; assets paging (Previous / Next, offset query); asset detail sheet with the session-56 `actions` slot; metric view validate passed, then failed; one `<h1>` + axe light and dark |
| S4 empty (per tab) | "New campaign" CTA opens the create sheet; assets "Import assets" CTA opens the wizard; metric views "Import assets" CTA |
| S4 error | campaigns 503: per-tab alert with Retry, and Assets still loads; assets 502 does not affect Campaigns |
| S4 forbidden + F4 | reviewer gets `steward-forbidden-root` and no steward requests; `GET /api/me` 500 shows an error with Retry (not forbidden), and Retry loads the console |
| S4 offline | offline alert; header and campaign status buttons disabled |
| S4 import wizard | step navigation (Next gated, Back keeps the selection); scan pending `role="status"`; `ImportAssetsBodySchema.parse` of the request body (metricViews + sourceId + glossaryTerms); partial failure "Skipped items" list; import error alert |

The wizard and detail route fixtures (catalogs, schemas, scan, import, metric view detail, versions) are local to the test file because `test/fixtures/steward.ts` belongs to session 43.

### Checks (owner tree copy `/tmp/gt-owner-5-2`, all wave 5-2 work + session 52 patch)

| Check | Result |
| --- | --- |
| `vitest run client/src/components/steward/StewardPage.test.tsx` | 21/21 |
| `NODE_ENV=production vitest run` (full; same env as the app `prebuild`) | 56 files, 1712 passed, 2 skipped, 0 errors |
| `tsc -b tsconfig.client.json` | exit 0 |
| `tsc -b tsconfig.server.json` | exit 0 |
| a11y-static d1-d3 | pass (inside the full run) |

## Files modified

* `ground-truth-app/client/src/components/access/RoleGate.tsx` (new)
* `ground-truth-app/client/src/pages/steward/StewardPage.tsx`
* `ground-truth-app/client/src/components/steward/{AssetBrowser,AssetDetailSheet,CampaignList,CreateCampaignSheet,ImportWizard,MetricViewPanel}.tsx`
* `ground-truth-app/client/src/components/steward/StewardPage.test.tsx` (new)
* `ground-truth-app/client/src/pages/executive/ExecutivePage.tsx`, `ExecutivePage.test.tsx` (new)
* `ground-truth-app/client/src/components/executive/{KpiCards,DashboardLink}.tsx`
* `ground-truth-app/client/src/pages/admin/AdminPage.tsx`, `AdminPage.test.tsx` (new)
* `ground-truth-app/client/src/components/admin/{ConfirmDialog (new),MembersPanel,ScoringConfigForm,RoleListsForm,MaintenanceActions}.tsx`

## Decisions

* The Steward tests live at `components/steward/StewardPage.test.tsx` (owned path), not `pages/steward/` (only `StewardPage.tsx` is owned there).
* The wizard is conditionally mounted, not gated with `enabled:` in `lib/api/hooks.ts` (not an owned path).

## Requests

* `lib/api/hooks.ts` (owner of the hooks): optional `enabled` parameter for `useCatalogs` / `useSources`, so any future always-mounted caller does not list catalogs eagerly. Not blocking.
