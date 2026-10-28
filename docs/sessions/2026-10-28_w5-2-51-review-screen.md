# Session 51 · Wave 5-2 · Review screen (S1)

* Date: 2026-10-28 · Run: 229891579528310 · Task: w5-2_session · Mode: edit (parallel) · Branch: `mg-genie-build-5`
* Owned paths: `ground-truth-app/client/src/pages/review/**`, `ground-truth-app/client/src/components/review/**`
* Depends on: session 49 (shell + build-5 API hooks), pass

## Problems

* S1 did not follow the Figma export layout or the figma_make_brief S1 "Keep:" test ids / accessible names.
* F3: when GET /api/review/next failed, the old ReviewPage showed the "All caught up" empty state instead of an error.
* F5: skip needed reasons (Shift+S or a chevron), a cooldown message, a "You skipped this earlier" badge, and a skips-today counter. Skip had to stay a POST to /api/review/skip and never become a vote.
* There was no session-complete state, no reduced-motion path for the swipe stack, and no full KB K1 keyboard flow.
* The review components imported lucide-react (F6) and did not have `// @a11y-strict`.

## Root causes

* The old ReviewPage checked `!card`, and that check also covered the query error case. It never read `isError`.
* The swipe, keyboard, vote and live-region logic were all inside CardStack/SwipeActions, so the page could not coordinate sheets, the skip popover and session state.

## Changes

* `pages/review/ReviewPage.tsx` (rewritten) has one `<h1>` ("Review") and a toolbar: campaign + asset-type native selects (URL params first, then the saved defaults), the streak badge, and `review-skip-counter` (SkipResponse.stats.skippedToday, falling back to UserStats). It covers these states:
  * loading: skeleton
  * populated
  * empty: EmptyPanel; "Switch campaign" moves focus to the campaign filter
  * error: InlineAlert with `CODE: message` and Retry (`review-error-retry`), kept separate from empty (F3)
  * vote error / skip error: the card stays and a toast shows
  * offline: every action is disabled and points to its reason via aria-describedby; shortcuts are ignored
  * session complete: after `UserSettings.cardsPerSession` reviewed + skipped (useReviewSessionStats); "Keep going" resets the count
* The polite live region `review-live-region` announces "Approved / Rejected / Edit sent for / Skipped <name>".
* Keyboard: A/→ approve, R/← reject sheet, E/↑ edit sheet, S skip, Shift+S skip-reason picker, 1-4 choose a reason, L logic, ? help. Shortcuts are ignored while typing or while a sheet/dialog is open. Focus goes back to the button that opened a sheet when it closes, because the AppKit sheet only restores focus to a Radix Trigger.
* `components/review/` was rebuilt. SwipeActions was deleted and replaced by VoteBar. New files: VoteBar, SkipReasonPicker (ShellPopover), ShortcutHelpDialog, ReviewCard (type, status and resurfaced badges, `<h2>` name), CardStack (swipe only; with reduced motion, OS or `UserSettings.motion='reduce'`, it renders a plain container), RejectSheet (optional feedback, 4000-char counter), EditSheet (prefilled; sends only changed fields; shows an inline error and sends no request if nothing changed, using hasProposedEdit), media.ts, plus the brand-icon versions of the badge/meter/progress/filter/chip/example/logic/query components.
* Every owned file starts with `// @a11y-strict`, and none imports lucide-react.
* `pages/review/ReviewPage.test.tsx` has 32 tests: loading, populated, approve/reject/edit, skip, skip-reason, resurfaced, empty (±campaign), session-complete, error (F3), vote-error, offline, 8 KB K1 flows, skip-never-a-vote, and reduced motion (OS, settings, OS overrides 'full', default). axe runs in every state, with populated checked in both light and dark.

## Decisions

* Reject feedback is optional, as in screen_inventory S1 and the `VoteBody.feedback?` contract, so the sheet does not block an empty submit.
* The skip cooldown copy uses `SKIP_COOLDOWN_HOURS_DEFAULT` (24) because GET /api/config does not expose `skip_cooldown_hours`. This is recorded as a status-file request.
* The vote result's `next` card is written straight into the nextCard cache when it is present. Otherwise the page invalidates `['review','next']`.

## Verification (in /tmp/gt-51 = HEAD 0bdf4f0 + owned files)

* `tsc -b tsconfig.client.json` and `tsconfig.server.json` both exit 0.
* `vitest run client/src/pages/review`: 32/32 pass.
* Mutation check: disabling the `isError` branch makes the F3 test fail, and the test passes again once the change is reverted.
* Full `vitest run`: 1473 pass, 1 fail. The failure is `server/routes/contracts.test.ts` (53 registered routes vs 50 contracted). It already fails at HEAD after session 50's Slack routes and is outside this session's paths.
* Gate greps: every owned file has `@a11y-strict`, there are no lucide imports, and ReviewPage has exactly one `<h1>`. The only `voteType: 'skip'` in client/src is the existing negative test in `test/harness.test.tsx`, which checks that mockApi rejects it.

## Files modified

* `ground-truth-app/client/src/pages/review/ReviewPage.tsx`, `ReviewPage.test.tsx`
* `ground-truth-app/client/src/components/review/*`: AssetTypeBadge, AssetTypeFilter, CampaignSelector, CardStack, ConfidenceMeter, EditSheet, EmptyState, ExampleQuestions, LogicView, media.ts, ProgressBar, QueryPreview, RejectSheet, ReviewCard, SessionComplete, ShortcutHelpDialog, SkipReasonPicker, StreakBadge, SynonymChips, VoteBar; SwipeActions deleted
