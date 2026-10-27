# Session 52: Settings screen (S7, new)

**Build 5 · wave `5-2` · edit (parallel)**

Reference: `screen_inventory.md` S7, F8, F9; `figma_make_brief.md` S7; `figma/_code/src/pages/SettingsPage.tsx`; screenshots `docs/design/ui/figma/settings/`.

## Steps

1. Replace the placeholder `pages/settings/SettingsPage.tsx` (from session 49) with the export's layout: sections Appearance (theme radiogroup system/light/dark), Review (exactly the fields and limits of the `UserSettings` contract in `shared/contracts`, e.g. cards per session; do not add fields the contract lacks), Notifications (per-user preferences moved here from Admin, F8; in-app channel on; Slack / Teams / webhook shown disabled with "Coming later"; the Slack **share** action lives on notifications and assets, not here).
2. Load with `GET /api/me/settings` and notification preferences; "Using defaults" note when the API returns defaults; dirty footer (Save / Discard); `PUT /api/me/settings` body contains only changed fields; saving / saved toast; validation (cards per session 150 → inline error, no request); error (alert + Retry); offline (form disabled, theme still switches locally).
3. Theme change applies immediately through session 49's `ThemeSync` and persists on save.
4. Components in `components/settings/**`. `// @a11y-strict` on every file written. Tests: every S7 row of `ui_test_strategy.md` §8 incl. KB K5 and the §7 theme wiring, axe light + dark.
5. vitest + both `tsc -b` in `/tmp/gt-52/`.

## Owned paths

* `ground-truth-app/client/src/pages/settings/**`
* `ground-truth-app/client/src/components/settings/**`

## Dependencies

49
