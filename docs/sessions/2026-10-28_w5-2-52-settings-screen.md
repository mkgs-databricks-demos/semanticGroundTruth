# Session 52 · Build 5 · wave 5-2 — Settings screen (S7)

Run `229891579528310`, branch `mg-genie-build-5`, mode edit. Plan: `docs/plans/build-5/52_settings_screen.md`.

**Status: blocked.** The screen and its tests are done, and both `tsc -b` pass. One file I do not own fails: `client/src/pages/fallback/Fallback.test.tsx` (session 49). It mounts the real `/settings` route without a `GET /api/campaigns` handler, so the strict `mockApi` fails 4 of its tests. A 3-line patch is below. With it, the full suite passes in `/tmp/gt-52`.

## What changed

**`pages/settings/SettingsPage.tsx`** replaces the session-49 placeholder. It has one `<h1>` in every state and a side index of its sections (Appearance, Motion, Review, Notifications, About).
* **Data:** `useMySettings` (GET `/api/me/settings`), `useNotificationPreferences` (GET `/api/notifications/preferences`, moved here from Admin per F8), `useCampaigns` (default-campaign select) and `useMe` (About). There are no new hooks or contract changes.
* **Appearance:** a Theme radiogroup (Light / Dark / System). A change applies at once through `next-themes`, the same provider `ThemeSync` seeds. It marks the form dirty, and Save persists it. Density is Comfortable / Compact. **Motion:** System / Reduce / Full, with the WCAG 2.3.3 helper text.
* **Review:** exactly the `UserSettings` contract fields. These are the default campaign (with "No default campaign"), the default asset type ("All types" = null, plus `ASSET_TYPES`), cards per session (a number input plus a slider, 5-100) and a Show keyboard hints switch. No fields were added beyond the contract.
* **Notifications:** one row per `NOTIFICATION_EVENT_TYPES` entry. Missing rows get the server default (in-app on, no digest). In-app and Daily digest are switches. Slack, Teams and webhook show the stored value as a disabled switch, and the column header says "Coming later". There is no Slack share action here.
* **About:** the signed-in user's name, email and roles.
* **States:**
  * Loading: a form skeleton (`role=status` "Loading settings").
  * Defaults: when `updatedAt` is null, a muted "Using defaults" note.
  * Dirty: a sticky footer with Save / Discard, plus a `beforeunload` guard. Discard also restores the saved theme.
  * Saving: "Saving changes…", with both buttons disabled.
  * Saved: the toast "Settings saved".
  * Validation: a card count outside 5-100 shows an inline error with `aria-invalid` and `aria-describedby`. Save focuses the field and sends nothing.
  * Load error: an alert with Retry. A preferences load error stays inside the Notifications section.
  * Save error: an alert with Retry, and the edits are kept.
  * Offline (`useOnlineStatus`): every field is disabled except Theme, which still switches locally. Save is disabled, and Ctrl+S sends nothing.
* **Keyboard (K5):** the radiogroups have one tab stop and use arrow, Home and End keys. Ctrl/Cmd+S saves.
* **PUT bodies:** `PUT /api/me/settings` carries only the changed fields. `PUT /api/notifications/preferences` carries only the changed rows (the server upserts by row). The two run in parallel. Toggling in-app keeps a stored Slack channel.

**`components/settings/**`** (new): `settingsForm.ts` (pure model: draft, diff, validation, preference merge and diff), `SegmentedControl`, `SettingsSwitch` (`role=switch`), `SettingsSection` and `SettingsIndex`, `NotificationPrefsTable`, `SettingsFooter`, `SettingsSkeleton`, and `index.ts`. Every file starts with `// @a11y-strict`. They use tokens only (no hex, no palette classes) and no lucide. The theme glyphs reuse `layout/ShellIcons`.

## Tests
* `pages/settings/SettingsPage.test.tsx` (18 tests) covers every S7 row of §8:
  * loading / populated / defaults, with radiogroups checked from the fixture and the "Using defaults" note;
  * dirty / saving / saved, with the PUT body parsed by `UpdateUserSettingsRequestSchema` holding only the changed fields, the preferences body parsed by `UpdatePreferencesBodySchema` holding only the changed rows, and the toast;
  * Discard;
  * save error + Retry;
  * validation (150: inline error, focus, no request);
  * load error + Retry;
  * preferences error;
  * offline;
  * KB K5 (Tab to the Theme group, ArrowRight / ArrowLeft toggle `<html class="dark">`, single tab stop, Ctrl+S sends `{theme:'dark'}` only);
  * §7.3 theme wiring (light and dark, plus `ThemeSync` seeding `system` with a `prefersDark` matchMedia stub).
  * axe runs in each state.
* `components/settings/settingsForm.test.ts` (19 tests) covers card parsing edge cases, diff and dirty logic, preference merge order and defaults, keeping Slack on toggle, and changes that cancel out.
* **Negative checks** in `/tmp`. Each mutation made the suite fail:
  * no `setTheme` on change: 6 failures;
  * no validation block: 1;
  * `diffSettings` always sending `motion`: 9;
  * offline ignored: 5.

## Validation (`/tmp/gt-52`, copy of HEAD + the working tree)
* `pnpm install --frozen-lockfile`: OK.
* `tsc -b tsconfig.server.json`: exit 0. `tsc -b tsconfig.client.json`: exit 0.
* vitest without the patch: 49 of 50 files pass. 4 tests fail, all in `pages/fallback/Fallback.test.tsx` (`mockApi: GET /api/campaigns was requested but has no handler`). The first failure leaves extra DOM behind, so two more tests then fail with "2 h1" and "multiple shell-theme-toggle".
* vitest with the patch: 50 files, 1459 passed, 2 skipped.
* `a11y-static.test.ts` (d1-d3) passes: one `<h1>` in the page file, test ids match §3.
* No YAML touched, so `bundle validate` was not needed.

## Request 1 (blocking): `client/src/pages/fallback/Fallback.test.tsx` (owner: session 49, wave 5-1; no build-5 owner after it)

The Settings page loads `GET /api/campaigns` for its default-campaign select (screen_inventory S7 "Data"). The route-table and ThemeSync tests mount the real `/settings` route through `shellApi()`, which does not register that route. The patch below applies with `git apply` from the repo root and was proven in `/tmp/gt-52`:

```diff
--- a/ground-truth-app/client/src/pages/fallback/Fallback.test.tsx
+++ b/ground-truth-app/client/src/pages/fallback/Fallback.test.tsx
@@ -14,6 +14,7 @@
 import { THEME_STORAGE_KEY } from '../../lib/settings/ThemeSync';
 import { expectNoAxeViolations } from '../../test/axe';
 import {
+  campaign,
   conflictsRoutes,
   feedbackBranchesRoutes,
   feedbackQueueRoutes,
@@ -54,6 +55,8 @@
     'GET /api/me': me,
     'GET /api/me/settings': settingsWithTheme(theme),
     'PUT /api/me/settings': userSettings,
+    // The Settings page (session 52) loads campaigns for its default-campaign select.
+    'GET /api/campaigns': [campaign],
   });
 }
```

After applying it, set `.build-status/229891579528310/52.json` to `pass` and repair from `w5-2_integrate`.

I rejected one workaround: fetching campaigns lazily (on focus) only to avoid the unmocked route. That would hide the problem (guardrail 13), and the saved default campaign would show without its name.

## Other requests (not blocking)
* **Motion and density app-wide (shell owner, `main.tsx` / `App.tsx`):** S7 says Motion applies through `MotionConfig`. Today `main.tsx` hard-codes `reducedMotion="user"`. Map `settings.motion` to `reduce` → `"always"`, and `system` / `full` → `"user"`, because the OS reduce preference must still win (WCAG 2.3.3). This page saves `motion` and `density` but does not apply them outside itself. Density likewise needs a root class.
* **In-app unsaved-changes guard:** S7 asks for a guard on navigation. `useBlocker` needs the data router, and the page is also rendered in `MemoryRouter` tests, so I added a `beforeunload` guard only. An in-app blocker belongs in the shell or router (session 49 / the converge session).

## Decisions
* The theme is saved with the form, not on every click (plan step 3: "applies immediately … persists on save"). The header `ThemeToggle` keeps its own write-through. While the form is clean, a header change updates this page because the page follows the `mySettings` cache. When dirty, the page keeps the user's edits and compares them with the new data.
* Offline theme changes switch the theme locally and mark the form dirty. Save stays disabled until the browser is back online.
* Slack / Teams / webhook show the stored value (e.g. the fixture's `feedback.branch_ready` Slack) as disabled switches, so turning in-app off never drops a stored channel.

## Files
`ground-truth-app/client/src/pages/settings/{SettingsPage.tsx, SettingsPage.test.tsx}`; `ground-truth-app/client/src/components/settings/{settingsForm.ts, settingsForm.test.ts, SegmentedControl.tsx, SettingsSwitch.tsx, SettingsSection.tsx, NotificationPrefsTable.tsx, SettingsFooter.tsx, SettingsSkeleton.tsx, index.ts}`.
