# Session 54: Steward console (S4) + Executive (S5) + Admin (S6)

**Build 5 · wave `5-2` · edit (parallel)**

Reference: `screen_inventory.md` S4, S5, S6, F4, F8; `figma_make_brief.md` S4-S6; `figma/_code/src/pages/StewardPage.tsx`, `ExecutivePage.tsx`, `AdminPage.tsx`; screenshots `docs/design/ui/figma/steward/`, `executive/`, `admin/`.

## Steps

1. **Shared access gate** `components/access/RoleGate.tsx`: distinguishes loading, **error** (`GET /api/me` failed → alert + Retry) and **forbidden** (`<page>-forbidden-root`, no page requests sent) (F4).
2. **Steward console:** tabs Campaigns / Assets / Metric views (roving tabindex); campaign list + create sheet; asset browser with paging and asset detail sheet (`AssetDetailSheet.tsx`; leave an `actions` slot for session 56's Share to Slack); metric view validate panel with result; import wizard (steps, scan pending, partial failure list, `ImportAssetsBody` parse); per-tab empty CTAs and per-tab errors (other tabs stay usable); offline disables writes.
3. **Executive:** 6 KPI groups by label; dashboard link name includes "opens in a new tab"; `executive_dashboard_url: null` → no link (dashboard-unconfigured); `totalAssets 0` copy; error / forbidden / offline.
4. **Admin:** three groups (members/roles, scoring incl. "Skip cooldown (hours)", system); validation (900 hours → inline error, no request); last-admin `DELETE` 409 `CONFLICT` → inline alert; notification preferences **removed** from Admin (moved to Settings, F8).
5. `// @a11y-strict` on every file written. Tests: every S4, S5, S6 row of `ui_test_strategy.md` §8, F4 regression on all three pages, axe light + dark.
6. vitest + both `tsc -b` in `/tmp/gt-54/`.

## Owned paths

* `ground-truth-app/client/src/pages/steward/StewardPage.tsx`, `ground-truth-app/client/src/components/steward/**`
* `ground-truth-app/client/src/pages/executive/**`, `ground-truth-app/client/src/components/executive/**`
* `ground-truth-app/client/src/pages/admin/**`, `ground-truth-app/client/src/components/admin/**`
* `ground-truth-app/client/src/components/access/**`

## Dependencies

49
