# Screen inventory — Semantic Ground Truth app (UI review from scratch)

**Build 4 · wave `4-0` · session 32 · docs only.** Input to [`figma_make_brief.md`](figma_make_brief.md), [`ui_test_strategy.md`](ui_test_strategy.md) and [`build5_outline.md`](build5_outline.md).

**Read from (2026-10-24, branch `mg-genie-build-4`):** `ground-truth-app/client/src/**` (`App.tsx`, `pages/**`, `components/**`, `lib/api/{endpoints,hooks,roles}.ts`), `shared/contracts/{values,entities,api,review,config}.ts`, plans 25 and 33 (contract and route additions that land in this build), `docs/design/L200-C3_card_ui.md`, `docs/plans/ui_brand_plan.md`, the eight `databricks-brand-*` skills and `/Workspace/Shared/brandfolder/assets.csv`.

**Contract caveat.** Session 25 (same wave) adds `ReviewSkip`, `SkipRequest`/`SkipResponse`, `UserSettings`, `FeedbackQueueItem`, `ConflictGroup`/`EditProposal`, `FeedbackBranch` and the skip counters. The fields below were checked against the session-25 working copy of `shared/contracts/{values,entities,api,review,schemas}.ts` on 2026-10-24 and match it. `resurfacedFromSkip` is not in the contracts yet (plan 33 adds it with the server change). If the merged contracts differ, the contract wins.

## 1. Conventions used below

* **Audience** = minimum app role (`reviewer` < `steward` < `admin`, `client/src/lib/api/roles.ts`). Every authenticated user is a reviewer.
* **States.** Every screen is designed in the same state set. A state that does not apply is marked n/a with the reason.
  * `loading`: first load, skeletons that match the final layout (no spinners for whole pages).
  * `populated`: realistic data (see the brief for sample values).
  * `empty`: the query succeeded and returned nothing.
  * `error`: the request failed (`ApiError` envelope `{error:{code,message}}`; codes `VALIDATION`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `UPSTREAM_ERROR`). Show the message and a Retry button.
  * `forbidden`: the caller lacks the role. Today this is a client-side check on `GET /api/me`; the server also returns 403 `FORBIDDEN`.
  * `offline`: `navigator.onLine === false` or `fetch` threw a `TypeError`. L200-C3 resolved question 2 says V1 has no offline support, so this state only explains the problem, keeps what is on screen read-only, and disables every write action. Nothing is queued.
* **Route slug** (used for Figma frame names and export folders): drop the leading `/`, replace `/` with `-`; `/` itself is `review`. Example: `/steward/feedback-queue` → `steward-feedback-queue`. `data-testid` prefixes use the slug too, except the three new steward screens, which use the shorter `steward-queue`, `steward-conflicts`, `steward-branches` ([`ui_test_strategy.md`](ui_test_strategy.md) §3).

## 2. Route map

| # | Route | Slug | Audience | Exists today | Page component |
|---|---|---|---|---|---|
| S0 | (shell on every route) | `shell` | reviewer | yes | `components/layout/AppLayout.tsx`, `NavLinks.tsx`, `NotificationBell.tsx` |
| S1 | `/` | `review` | reviewer | yes | `pages/review/ReviewPage.tsx` |
| S2 | `/leaderboard` | `leaderboard` | reviewer | yes | `pages/leaderboard/LeaderboardPage.tsx` |
| S3 | `/assistant` | `assistant` | reviewer | yes | `pages/agents/AgentChat.tsx` |
| S4 | `/steward` | `steward` | steward | yes | `pages/steward/StewardPage.tsx` |
| S5 | `/executive` | `executive` | steward | yes | `pages/executive/ExecutivePage.tsx` |
| S6 | `/admin` | `admin` | admin | yes | `pages/admin/AdminPage.tsx` |
| S7 | `/settings` | `settings` | reviewer | **new** | (build 5) |
| S8 | `/steward/feedback-queue` | `steward-feedback-queue` | steward | **new** | (build 5) |
| S9 | `/steward/conflicts` | `steward-conflicts` | steward | **new** | (build 5) |
| S10 | `/steward/feedback-branches` | `steward-feedback-branches` | steward | **new** | (build 5) |
| S11 | `*` | `not-found` | reviewer | yes | `NotFound` in `App.tsx` |

The three new steward screens are their own routes (deep-linkable from notifications such as `feedback.branch_ready`) and also appear as items in a steward sub-navigation shown on every `/steward*` route. `/steward` keeps Campaigns / Assets / Metric views.

## 3. Cross-cutting findings (today's client)

| # | Finding | Evidence | Fix in build 5 |
|---|---|---|---|
| F1 | No `data-testid` anywhere in the client. | `grep -rn data-testid client/src` → 0 | Add per [`ui_test_strategy.md`](ui_test_strategy.md) §3 |
| F2 | The header product name is the page's only `<h1>`; every page title is an `<h2>`. ui_brand_plan §7.2 requires one `<h1>` per page that names the page. | `AppLayout.tsx` L63, every `pages/**` | Product name becomes a link (not a heading); page title = `<h1>` |
| F3 | Review shows the empty state when `GET /api/review/next` fails (only `isLoading` and `!card` are checked). | `ReviewPage.tsx` L80-86 | Separate `error` state |
| F4 | Steward / Executive / Admin show "Access Required" when `GET /api/me` fails (error and forbidden are not distinguished). | `StewardPage.tsx` L33-61 and the same pattern in `ExecutivePage.tsx`, `AdminPage.tsx` | Separate `error` and `forbidden` states |
| F5 | Skip is sent as a vote and fails the DB CHECK (500). Fixed server- and client-side in session 33. No skip reason, no skipped counter in the UI. | plan 25 §Context, `CardStack.tsx` L84, `SwipeActions.tsx` L49 | Skip interaction, S1 below |
| F6 | Icons are `lucide-react` everywhere (nav, votes, empty states, theme toggle); `EmptyState.tsx` uses `PartyPopper`. | `NavLinks.tsx` L5-12, `SwipeActions.tsx` L5, `EmptyState.tsx` L4 | Databricks icon set, brief §1.6 |
| F7 | Desktop nav has no icons, mobile bottom nav has icons, and the mobile drawer uses a filled `bg-primary` pill (ui_brand_plan §6 says underline, not filled pill). | `NavLinks.tsx`, `AppLayout.tsx` L42-47 | One nav item component, underline active state |
| F8 | Notification preferences (per-user, `GET/PUT /api/notifications/preferences`) live on the admin-only page, so reviewers and stewards cannot change their own. | `AdminPage.tsx` L18, L59 | Move to Settings (S7) |
| F9 | Theme is a header toggle stored in `localStorage` (`next-themes`, key `sgt-theme`) only; it does not follow the user across devices. | `AppLayout.tsx` L23-55 | Settings `theme` from `GET /api/me/settings` seeds `next-themes`; the header toggle stays as a shortcut and writes through `PUT /api/me/settings` |
| F10 | The Assistant page copy is developer documentation (file paths of agent definitions). | `AgentChat.tsx` L139-149 | Reviewer-facing copy |
| F11 | No tests render components; only static tests (`theme/contrast.test.ts`, `theme/a11y-static.test.ts`). Manual Lighthouse and keyboard-only checks never done. | `client/src/theme/` | [`ui_test_strategy.md`](ui_test_strategy.md) |

## 4. Screens

Each entry lists: audience, data (contract types), actions (method + path), states, keyboard, and what is missing today.

### S0 Shell (header, navigation, notifications)

* **Audience:** reviewer (items filtered by role: Steward and Executive need `steward`, Admin needs `admin`).
* **Data:** `MeResponse {userId, email, displayName, roles}` (`GET /api/me`); `UnreadCountResponse` (`GET /api/notifications/unread-count`); `Notification[]` (`GET /api/notifications`); `UserSettings.theme` (`GET /api/me/settings`, new).
* **Actions:** `POST /api/notifications/read` (`MarkReadBody`); `PUT /api/me/settings` (theme shortcut, new).
* **Layout today:** 24 px Databricks symbol + "Semantic Ground Truth" (DM Sans Bold), text nav links, bell, theme toggle (light → dark → system), hamburger + bottom nav on mobile.
* **States:** loading (nav items render once `me` resolves; skeleton for the role-gated items), populated, empty (no notifications: "You're all caught up" in the popover), error (bell shows a muted dot with tooltip "Notifications unavailable"), forbidden n/a, offline (a top banner, `role="status"`, under the header: "You're offline. Votes and edits are paused until the connection is back.").
* **Keyboard:** `Tab` order = skip-to-content link → product link → nav → bell → theme → user menu. `Esc` closes the popover/drawer and returns focus.
* **Missing today:** skip-to-content link, user menu (name, email, roles, Settings link), steward sub-nav, icons on desktop nav, offline banner (F2, F6, F7, F9).

### S1 Review `/` (signature screen)

* **Audience:** reviewer.
* **Data:** `ReviewCard {asset: Asset, synonyms: AssetSynonym[], examples: ExampleQuestion[], confidence: ConfidenceScore | null, campaign?: {campaignId, name}, reason: SurfacingReason, progress: {reviewed, total}}` from `GET /api/review/next?campaignId&assetType` (`GetNextQuery`), plus `resurfacedFromSkip: true` when every eligible asset is in skip cooldown (plan 33). `Campaign[]` for the selector (`GET /api/campaigns`). `UserStats` + `skippedCount`, `skippedToday` (`GET /api/review/stats/me`). `QueryResult {columns, rows, truncated}` for the query preview. `UserSettings.defaultCampaignId`, `defaultAssetType`, `cardsPerSession`, `showKeyboardHints`.
* **Actions:** `POST /api/review/vote` (`VoteBody {assetId, voteType: approve|reject|edit, feedback?, edits?{description, plainEnglishLogic, displayName}}` → `VoteResult {vote, confidence, assetStatus, next?}`); `POST /api/review/skip` (`SkipRequest {assetId, campaignId?, reason?: not_sure|not_my_area|need_context|other}` → `SkipResponse {skip, stats:{skippedCount, skippedToday}}`, new); `POST /api/review/synonym` (`SynonymBody {assetId, action: add|remove|approve|reject, synonym}`); `POST /api/review/example` (`ExampleBody`); `POST /api/review/run-query` (`RunQueryBody`).
* **Sub-surfaces:** card (type badge, status badge, domain / subdomain, display name, campaign chip, description, confidence meter, progress bar, synonym chips, example questions, Logic view disclosure with plain-English logic + YAML/SQL, query preview), vote bar (Reject, Edit, Approve, Skip), Edit sheet (display name, description, plain-English logic), Reject sheet (optional feedback, 4000 chars), **Skip reason picker (new)**, streak badge, skipped-today counter (new), session-complete panel (new, after `cardsPerSession` cards).
* **Skip interaction (new):** Skip is visually secondary (ghost button, `--vote-skip`), never styled as a vote. `S` or the Skip button skips immediately with no reason (plan 33 sends no reason in build 4). `Shift+S` or the chevron on the Skip button opens a 4-option popover (`SKIP_REASONS`: Not sure / Not my area / Need more context / Other) with `1`-`4` shortcuts; choosing one sends `reason`. A toast confirms "Skipped. You'll see it again in 24 h" (from `skipCooldownHours`). The header of the card area shows "Skipped today: 3" from `SkipResponse.stats.skippedToday`. A card that comes back with `resurfacedFromSkip` shows an info badge "You skipped this earlier".
* **States:** loading (card skeleton 384 px + vote bar skeleton); populated; empty ("All caught up", Databricks icon, CTA "Switch campaign" when a campaign filter is set, else "View leaderboard"); session-complete (after `cardsPerSession`: count reviewed / skipped, CTA "Keep going" and "Done for now"); resurfaced (badge above); error (F3: message + Retry; vote/skip errors keep the card and show an inline error toast); forbidden n/a (every user is a reviewer); offline (card read-only, vote bar disabled with reason). Sheets: open, submitting (buttons disabled, spinner in the primary button), validation error.
* **Keyboard:** `A` or `→` approve, `R` or `←` reject (opens Reject sheet), `E` or `↑` edit (opens Edit sheet), `S` skip, `Shift+S` skip with reason, `1`-`4` choose reason in the picker, `L` toggle Logic view, `?` shortcut help dialog, `Esc` close sheet/popover. Today only arrows and `S` exist (`CardStack.tsx` L75-88); `A/R/E` are the plan-32 additions. Shortcuts are ignored while focus is in an input/textarea/select (existing rule). Shortcut hints are shown when `showKeyboardHints` is true and on `md+` screens.
* **Missing today:** F3, F5, A/R/E aliases, `?` help, reason picker, skipped counter, session-complete state, resurfaced badge, Databricks icons on votes and empty state.

### S2 Leaderboard `/leaderboard`

* **Audience:** reviewer.
* **Data:** `LeaderboardEntry[] {userId, email, displayName, totalVotes, approvals, rejections, edits, currentStreakDays, rank}` + `skippedCount` (plan 25: shown, never ranked) from `GET /api/leaderboard?period=7d|30d|all&limit=25`; `UserStats` (`GET /api/review/stats/me`) for My Stats; `MeResponse.userId` to highlight the current row.
* **Actions:** period tabs (7 days / 30 days / All time). Read-only.
* **States:** loading (5 row skeletons + stats skeleton), populated (rank 1-3 medal icons with `aria-label`, current user row `--accent`), empty ("No reviews in this period yet" + CTA "Start reviewing"), error (inline message + Retry; today message only), forbidden n/a, offline (cached data with "last updated" note).
* **Keyboard:** tabs are a `tablist` (arrow keys move between tabs). Table rows are not focusable.
* **Missing today:** empty state, skipped column in My Stats, Retry.

### S3 Assistant `/assistant`

* **Audience:** reviewer.
* **Data:** AppKit agents plugin client config (`usePluginClientConfig('agents')`: `agents`, `defaultAgent`, `skills`); streamed `AgentChatEvent`s (`useAgentChat`). These are AppKit plugin routes, not part of `ROUTE_CONTRACTS`.
* **Actions:** send message; optional skill picker (`/skill` sugar); tool-call rows render inline (`agent-review-worker`).
* **States:** loading n/a (config is inlined at boot); populated (conversation); empty (starter prompts as buttons: "Explain the confidence score for Readmission Rate (30-day)", "Show me this week's leaderboard", "What's our coverage summary?"); streaming (assistant bubble with typing indicator, input disabled, Stop is not supported by the hook so no Stop button); error (`error` from the hook, inline banner + "Try again"); no-agent (`defaultAgent` null: "The assistant isn't configured for this app"); forbidden n/a; offline (input disabled).
* **Keyboard:** `Enter` sends, `Shift+Enter` newline, focus returns to the input after send.
* **Missing today:** reviewer-facing copy (F10), starter prompts, tool rows that read as "Looked up leaderboard" instead of raw JSON arguments.

### S4 Steward console `/steward`

* **Audience:** steward.
* **Data:** Campaigns tab: `Campaign[]` (`GET /api/campaigns`, `CampaignListQuery`). Assets tab: `Paged<Asset>` (`GET /api/assets`, `ReviewableQuery`), detail `Asset` + `AssetVersion[]` (`GET /api/assets/:assetId`, `/versions`). Metric views tab: `MetricViewSummary[]` (`GET /api/metric-views`), `MetricViewDetail` (`GET /api/metric-views/:fullName`). Import wizard: `CatalogsResponse`, `SchemasResponse`, `CatalogMetricViewsResponse`, `SourcesResponse`, `ScanSourceResponse`, `ImportAssetsResponse`.
* **Actions:** `POST /api/campaigns` (`CreateCampaignBody`), `PATCH /api/campaigns/:campaignId/status` (`UpdateCampaignStatusBody`: active / paused / completed / archived), `POST /api/metric-views/:fullName/validate` → `ValidateResult`, `POST /api/sources`, `POST /api/sources/:sourceId/scan`, `POST /api/assets/import`, `POST /api/assets/register`.
* **Sub-surfaces:** steward sub-nav (Overview · Feedback queue · Conflicts · Feedback branches), Campaign list with progress (`reviewedAssets / totalAssets`) and status badge, Create campaign sheet, Import wizard (source: UC catalog browse or Git folder → pick metric views → review → import → optional campaign), Asset browser table (Name, Type, Status, Domain) with filter + paging, Asset detail sheet (versions timeline), Metric view panel (measures / dimensions, DM Mono expressions, Validate).
* **States:** loading (table skeletons), populated, empty per tab ("No campaigns yet" + New campaign; "No assets registered" + Import assets; "No metric views found in this catalog"), error per tab, forbidden (F4: "Steward access required" + who to contact), offline (writes disabled). Wizard: per-step validation error, scan in progress, import partial failure (`ImportAssetsResponse` per-item errors).
* **Keyboard:** tabs `tablist`; table rows focusable with `Enter` opening the detail sheet; sheets trap focus.
* **Missing today:** sub-nav to the new screens, F4, per-tab empty states.

### S5 Executive `/executive`

* **Audience:** steward.
* **Data:** `ExecutiveSummary {totalAssets, reviewedAssets, certifiedAssets, coveragePct, certificationPct, activeReviewers7d, votes7d, activeCampaigns}` (`GET /api/admin/summary`); `AppRuntimeConfig {executive_dashboard_url}` (`GET /api/config`). Skip metrics live in the AI/BI dashboard (session 28 adds `skips`, `skip_rate` to `mv_review_activity`), not in this summary.
* **Actions:** open the embedded/linked AI/BI dashboard (new tab).
* **States:** loading (6 KPI skeletons), populated (KPI cards: 32 px Bold value, 12 px muted label, optional delta badge with arrow icon), empty (`totalAssets = 0`: "No assets yet" + link to Steward → Import), dashboard-unconfigured (`executive_dashboard_url` null: muted note, no broken link), error, forbidden (F4), offline.
* **Keyboard:** dashboard link is a normal link with "opens in a new tab" in its accessible name.
* **Missing today:** F4, empty and unconfigured states.

### S6 Admin `/admin`

* **Audience:** admin.
* **Data:** `AppSettingsDto` (`GET /api/admin/config`: `wilsonZ`, `industryPrior`, `priorWeight`, `priorDecayThreshold`, `certificationThreshold`, `minVotesForCertification`, `stalenessDays`, `freshnessIntervalDays`, `adminEmails`, `stewardEmails`) + `skipCooldownHours` (0-720, default 24, plan 25); `AdminGroupsResponse` (`GET /api/admin/groups`: `AppGroup {name, role, description, members: AppGroupMember[]}`).
* **Actions:** `PUT /api/admin/config` (`UpdateConfigBody`); `POST /api/admin/groups/:groupName/members` (`AddGroupMemberBody`); `DELETE /api/admin/groups/:groupName/members/:memberId` (409 `CONFLICT` when removing the last admin); `POST /api/admin/recompute/:assetId` → `ConfidenceScore`; `POST /api/campaigns/freshness-check` → `FreshnessCheckResult`.
* **Sections:** Members (three app groups), Scoring configuration (incl. skip cooldown), Role lists (legacy read-only fallback emails), Maintenance (destructive variant + confirm dialog). Notification preferences move to Settings (F8).
* **States:** loading, populated, empty (group with no members: "No members. Add an email or service principal id."), error (load and save separately; save errors inline per form), last-admin conflict (409 inline message), forbidden (F4), offline (forms disabled).
* **Keyboard:** standard form order; confirm dialogs focus the safe button first.
* **Missing today:** F4, F8, `skipCooldownHours` field (session 33 adds it to the API, not the form).

### S7 Settings `/settings` (new)

* **Audience:** reviewer (every user, own settings only).
* **Data:** `UserSettings {theme: system|light|dark, density: comfortable|compact, motion: system|reduce|full, defaultCampaignId | null, defaultAssetType | null, showKeyboardHints, cardsPerSession (5-100, default 20), updatedAt}` (`GET /api/me/settings`, defaults when no row); `Campaign[]` for the default-campaign select; `ASSET_TYPES` for the default type; `NotificationPreference[] {eventType, channels, digest}` (`GET /api/notifications/preferences`, moved from Admin).
* **Actions:** `PUT /api/me/settings` (`UpdateUserSettingsRequest`, partial); `PUT /api/notifications/preferences` (`UpdatePreferencesBody`).
* **Sections:** Appearance (theme segmented control Light / Dark / System with live preview; density Comfortable / Compact), Motion (System / Reduce / Full; "System follows your OS reduced-motion setting"), Review (default campaign, default asset type, cards per session 5-100 number input + slider, show keyboard hints switch), Notifications (per event type: in-app switch; Slack / Teams / webhook channels shown disabled with "Coming later" because G5 is deferred), About (signed in as, roles).
* **Behaviour:** Appearance changes apply immediately (optimistic, `next-themes` + `MotionConfig`), then save; other fields save on "Save changes" with a sticky footer; unsaved-changes guard on navigation. `motion: reduce` forces reduced motion even if the OS does not; `full` does not override an OS reduce preference (WCAG 2.3.3: the OS preference wins).
* **States:** loading (form skeleton), populated, defaults (no stored row: a muted "Using defaults" note), saving, saved (toast "Settings saved"), validation error (`cardsPerSession` out of range, inline), error (load / save), forbidden n/a, offline (form disabled, theme still changes locally).
* **Keyboard:** segmented controls are `radiogroup`s (arrow keys); `Ctrl/Cmd+S` saves.

### S8 Steward → Feedback queue `/steward/feedback-queue` (new)

* **Audience:** steward.
* **Data:** `FeedbackQueueItem {assetId, displayName, assetType, campaignId | null, votes: {approve, reject, edit}, skips, pendingEdits, lastActivityAt}` from `GET /api/steward/feedback-queue?campaignId&assetType&status=pending|all&limit&offset` (paged).
* **Actions:** filter by campaign, asset type, status; open Asset detail sheet (S4); jump to Conflicts (S9) for an asset with `pendingEdits ≥ 2`. Read-only otherwise.
* **Layout:** filter bar + table (Asset, Type, Approve / Reject / Edit counts as a stacked bar with numbers, Skips, Pending edits, Last activity relative time) + pager. High-skip rows (skips ≥ votes total) get an info badge "Often skipped" (signal that the definition is unclear).
* **States:** loading, populated, empty ("Nothing waiting for triage" + link to campaigns), filtered-empty ("No assets match these filters" + Clear filters), error, forbidden, offline.
* **Keyboard:** `J`/`K` move row focus, `Enter` opens detail, `C` opens conflicts for the focused row when available, `/` focuses the filter bar.

### S9 Steward → Conflicts `/steward/conflicts` (new)

* **Audience:** steward.
* **Data:** `ConflictGroup {assetId, displayName, edits: EditProposal[], rejectCount, approveCount}`, `EditProposal {voteId, userId, field: description|plain_english_logic|display_name, value, createdAt}` from `GET /api/steward/conflicts`. Current asset values from `GET /api/assets/:assetId`.
* **Actions:** `POST /api/steward/conflicts/:assetId/resolve` with `ResolveConflictRequest {resolution: accept_edit|keep_current|reject_all, voteId?, note?}` (`voteId` required for `accept_edit`). The server notifies edit authors.
* **Layout:** two-pane on `lg+` (list of conflict groups left; detail right), single column with back link on mobile. Detail shows the current value and each proposal side by side per field, with a word-level diff (insertions underlined + `--vote-approve` tint, deletions struck + `--vote-reject` tint, never color alone), author, time, and vote tallies. Resolution bar: Accept selected edit (primary), Keep current (secondary), Reject all (destructive, confirm dialog), optional note (4000 chars, `ResolveConflictRequest.note`).
* **States:** loading, populated, empty ("No conflicts. Reviewers agree."), resolving (buttons disabled), resolved (group leaves the list, toast with Undo is **not** offered because the API has no undo), conflict-stale (409 / 404 because another steward resolved it: inline message + refresh), error, forbidden, offline.
* **Keyboard:** `J`/`K` previous / next group, `1`-`9` select proposal, `Enter` or `A` accept selected edit, `C` keep current, `X` reject all (opens confirm), `N` focus note, `Esc` back to list on mobile.

### S10 Steward → Feedback branches `/steward/feedback-branches` (new)

* **Audience:** steward (status changes); the list is read by stewards. `POST /api/steward/feedback-branches` (upsert) is admin / M2M only (the feedback job), not a UI action.
* **Data:** `FeedbackBranch {batchId, branchName, status: pending|proposed|in_review|merged|rejected|failed, assetCount, files: string[], summary | null, createdAt, completedAt | null, reviewedBy | null}` from `GET /api/steward/feedback-branches`. Branch names follow `mg-genie-feedback-<yyyymmdd>` (owner decision).
* **Actions:** `POST /api/steward/feedback-branches/:batchId/status` with `UpdateFeedbackBranchStatusRequest {status: in_review|merged|rejected, note?}`; copy branch name; open the Git provider (needs a repo URL: **gap**, `FeedbackBranch` has no URL field, so build 5 shows copy-to-clipboard only unless plan 25's contract adds one).
* **Layout:** list of cards (branch name in DM Mono, status badge, asset count, created / completed, reviewed by), expandable to the file list (DM Mono paths) and markdown `summary`. Status actions: Mark in review, Mark merged, Mark rejected (confirm + note). Status badge colors: pending = default, proposed = info, in_review = warning, merged = success, rejected = destructive, failed = destructive with icon.
* **States:** loading, populated, empty ("No feedback branches yet. The feedback pipeline opens one when approved edits are ready."), failed-branch (status `failed`: error badge + summary as the failure reason), updating, error, forbidden, offline.
* **Keyboard:** `J`/`K` move between branches, `Enter` expand, `Y` copy branch name.

### S11 Not found `*` and app error

* 404 (route unknown): Databricks icon, "Page not found", link back to Review.
* `ErrorBoundary.tsx` (render crash): today shows the stack trace to every user. Build 5 shows a friendly message, a Reload button, and the stack trace only behind a "Technical details" disclosure.

## 5. Coverage check (acceptance criterion 1)

| Screen | loading | populated | empty | error | forbidden | offline | Extra states |
|---|---|---|---|---|---|---|---|
| S0 Shell | ✓ | ✓ | ✓ (no notifications) | ✓ | n/a | ✓ | — |
| S1 Review | ✓ | ✓ | ✓ | ✓ | n/a | ✓ | session-complete, resurfaced, skip-reason picker, edit/reject sheet |
| S2 Leaderboard | ✓ | ✓ | ✓ | ✓ | n/a | ✓ | — |
| S3 Assistant | n/a (boot config) | ✓ | ✓ | ✓ | n/a | ✓ | streaming, no-agent |
| S4 Steward | ✓ | ✓ | ✓ (per tab) | ✓ | ✓ | ✓ | import wizard steps, partial import |
| S5 Executive | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | dashboard-unconfigured |
| S6 Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | last-admin conflict |
| S7 Settings | ✓ | ✓ | defaults | ✓ | n/a | ✓ | saving, saved, validation |
| S8 Feedback queue | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | filtered-empty |
| S9 Conflicts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | resolving, conflict-stale |
| S10 Feedback branches | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | failed-branch, updating |
| S11 Not found / error | n/a | ✓ | n/a | ✓ | n/a | n/a | — |

Six current routes (S1-S6) and four new screens (S7-S10) are covered, plus the shell and fallbacks.
