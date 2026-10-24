# Figma Make brief — Semantic Ground Truth app redesign

**Build 4 · wave `4-0` · session 32.** For the owner to paste into Figma Make, one block at a time. Screens, data and states come from [`screen_inventory.md`](screen_inventory.md) (S0-S11); test hooks come from [`ui_test_strategy.md`](ui_test_strategy.md). Build 5 implements the export ([`build5_outline.md`](build5_outline.md)).

**Source of truth for values.** Every hex value, ratio, size and duration below is copied from `docs/plans/ui_brand_plan.md` (§3-§8, contrast recomputed 2026-10-23), which build conventions §0b make final for this app. Where the generic `databricks-brand-dark-light-mode` / `databricks-brand-components` skills suggest something else, the app plan wins, and the difference is deliberate:

| Topic | Generic brand skill | This app (ui_brand_plan) | Why |
|---|---|---|---|
| Primary button fill | Lava 600 `#FF3621` + white | Light: Lava 700 `#BD2B26` + white (5.94). Dark: Lava 500 `#FF5F46` + Navy 900 `#0B2026` (5.59). Lava 600 only as `--brand-accent` and on `size="lg"` bold CTAs | White on Lava 600 is 3.62, fails 1.4.3 at 14 px (decision D1, default kept) |
| Light page / card | White page, Oat Medium cards | Oat Light `#F9F7F4` page, White cards | Cards sit above the page |
| Dark page / card | Navy 800 page, Navy 700 cards | Navy 900 `#0B2026` page, Navy 800 `#1B3139` cards | Same layering in both modes |
| Input border | Gray Lines `#DCE0E2` | Navy 500 `#618794` (3.90 light / 3.50 dark) | Gray Lines is 1.33, fails 1.4.11 |

## How to use this brief

1. Start a new Figma Make file named **Semantic Ground Truth — build 5**.
2. Paste **§1 Global prompt** first and let Make build the design system page (tokens, type, icons, components). Check it against the token table before going on.
3. Paste one **§2 screen block** per prompt, in order S0 → S11. Each block asks for every state in light **and** dark.
4. Export per **§3**.

---

## 1. Global prompt

Paste everything inside the fence.

```text
Design a responsive web app called "Semantic Ground Truth", built on React + Tailwind v4 + shadcn/ui primitives as re-skinned by @databricks/appkit-ui (Button, Card, Badge, Tabs, Table, Sheet, Dialog, Popover, Select, Input, Textarea, Switch, Slider, Skeleton, Tooltip, Toast). Keep shadcn component names and props so the code maps 1:1. Use CSS variables for every color (no hard-coded hex in components, no Tailwind palette classes like bg-red-500).

PRODUCT
A crowdsourced validation tool for Unity Catalog semantic assets (metric view measures and dimensions, glossary pages, domains, subdomains). Business users swipe through cards and approve, reject, edit or skip each definition. Stewards triage the feedback, resolve conflicting edits and review the Git branches the feedback pipeline opens. Admins configure scoring and membership. Executives see coverage and certification.

USERS AND ROLES
reviewer (everyone), steward (triage, campaigns, executive view), admin (config, members). Navigation items are hidden when the role is missing; pages a user cannot use show a "forbidden" state.

TONE
Distilled (clean, nothing decorative), Bold (confident Lava accents, big DM Sans Bold headings, one strong focal point per screen), Fresh (modern spacing, motion that explains state). Plain, friendly microcopy; no exclamation marks except the empty-state hero; no lorem ipsum anywhere.

BRAND COLORS (Databricks extended palette; only these hex values)
Lava 800 #801C17, Lava 700 #BD2B26, Lava 600 #FF3621 (brand primary), Lava 500 #FF5F46, Lava 400 #FF9E94, Lava 300 #FABFBA.
Navy 900 #0B2026, Navy 800 #1B3139 (brand primary), Navy 700 #143D4A, Navy 600 #1B5162, Navy 500 #618794, Navy 400 #90A5B1, Navy 300 #C4CCD6.
Oat Light #F9F7F4, Oat Medium #EEEDE9, White #FFFFFF. Gray Navigation #303F47, Gray Text #5A6F77, Gray Lines #DCE0E2.
Green 700 #00875C, Green 600 #00A972, Green 500 #42BA91. Yellow 800 #7D5319, Yellow 600 #FFAB00, Yellow 500 #FCBA33. Blue 600 #2272B4, Blue 400 #8ACAFF. Maroon 500 #AB4057, Maroon 300 #D69EA8.
One accent family only: Lava. Never use Lava as a large background.

SEMANTIC TOKENS (light / dark). Build a light and a dark variable mode with exactly these values:
--background: Oat Light #F9F7F4 / Navy 900 #0B2026
--foreground: Navy 800 #1B3139 / White #FFFFFF
--card, --popover: White #FFFFFF / Navy 800 #1B3139
--card-foreground: Navy 800 / White
--muted: Oat Medium #EEEDE9 / Navy 700 #143D4A
--muted-foreground: Gray Text #5A6F77 / Navy 400 #90A5B1
--primary: Lava 700 #BD2B26 / Lava 500 #FF5F46
--primary-foreground: White / Navy 900 #0B2026
--brand-accent: Lava 600 #FF3621 / Lava 600 #FF3621 (logo area, active-nav bar, progress fill, large display text and size=lg bold CTAs only)
--secondary, --accent: Oat Medium / Navy 700; their foregrounds Navy 800 / White
--destructive: Lava 700 / Lava 500 (always with an icon and explicit text)
--success: Green 700 #00875C with White text / Green 500 #42BA91 with Navy 900 text
--warning: Yellow 600 #FFAB00 with Navy 900 text in both modes; warning TEXT on light surfaces uses Yellow 800 #7D5319
--info and links: Blue 600 #2272B4 / Blue 400 #8ACAFF
--border (decorative dividers and card edges only): Gray Lines #DCE0E2 / Navy 600 #1B5162
--input (every control boundary): Navy 500 #618794 / Navy 500 #618794
--ring (focus): Blue 600 / Blue 400
--sidebar / nav surface: Oat Light with Navy 800 text / Gray Navigation #303F47 with White text
Review votes: --vote-approve Green 700 / Green 500; --vote-reject Lava 700 / Lava 500; --vote-edit Blue 600 / Blue 400; --vote-skip Gray Text #5A6F77 / Navy 400 #90A5B1.
Confidence bands: --confidence-low Lava 700 / Lava 500; --confidence-mid Yellow 800 / Yellow 600; --confidence-high Green 700 / Green 500.
Charts: --chart-1..5 = Lava 600, Blue 600, Green 600, Yellow 600, Maroon 500 (light) and Lava 500, Blue 400, Green 500, Yellow 500, Maroon 300 (dark). Yellow 600 on white only with a Navy 800 outline or as the last series. Every series also has a label or legend.

CONTRAST RULES (WCAG 2.1 AA, both modes)
Body text >= 4.5:1, large text (>= 24px regular or >= 18.66px bold) >= 3:1, UI boundaries, icons and focus rings >= 3:1. Do not lighten --muted-foreground (it is 4.51 on --muted). White text on Lava 600 is only allowed at large bold sizes. Never use Green 600 as text on Navy 800, Gray Lines as a control border, or Yellow 600 as text on light surfaces. Color is never the only signal: every vote, status and delta also has an icon and a text label.

TYPOGRAPHY
DM Sans for all UI (400 regular, 400 italic, 500 medium, 700 bold; no 900). DM Mono (400, 500) only for SQL, YAML, metric-view names, branch names, file paths and API paths. Scale on an 8px rhythm: 12 caption/badge, 14 dense body/table, 16 body, 20 card title, 24 page H2, 32 page H1 and KPI values. Line height 1.5 body, 1.2 headings. Headings Bold 700, labels and nav Medium 500. Left-aligned everywhere except the empty-state hero. One H1 per page that names the page.

SPACING, SHAPE, ELEVATION
8px grid. Page padding 24px desktop / 16px mobile. Section gap 24px, card gap 16px, inner gap 12px. Radius 8px for buttons and inputs, 12px for cards and sheets. Cards: 1px --border plus shadow-sm (keep a real border so cards survive Windows High Contrast). Max content width 1280px; the review card column is 512px.

ICONS
Use the Databricks icon set, not lucide, wherever an equivalent exists:
- 16px functional icons: Databricks UI system icons (checkIcon, closeIcon, pencilIcon, chevronDoubleRightIcon, checklistIcon, BarsDescendingVerticalIcon, ShieldCheckIcon, dashboardIcon, gearOutlinedIcon, SparkleIcon, SlidersIcon, queryListViewIcon, forkIcon, BranchIcon, GitCommitIcon, notificationIcon, searchIcon, filterIcon, keyboardIcon, refreshIcon, userGroupIcon, cloudOffIcon, lockOutlinedIcon, warningOutlinedIcon, DangerIcon, InfoBookIcon, MeasureIcon, TagIcon, catalogIcon, historyIcon, newWindowIcon, menuIcon, copyIcon, trashIcon, plusIcon, questionMarkOutlinedIcon). Render them in currentColor so they follow text tokens in both modes.
- 64px empty-state illustrations: Databricks primary icons (navy variant on light, white variant on dark) inside a 64px --muted tile with 16px radius: unity-catalog, data-quality-3, users, dashboards, chat, governance.
- Product marks where the screen is about that product: Genie (genie-icon-full-color-container) on Assistant, AI/BI (ai-bi-icon-full-color) on the executive dashboard link, Unity Catalog (unity-catalog-icon-full-color) in the import wizard source step.
- The Databricks symbol (databricks-symbol-color on light, databricks-symbol-light on dark), 24px, left of the product name. Never recolor, redraw or stretch it; never build a lockup with the product name.
- Only where the Databricks set has no equivalent, use lucide with the same 1.5px stroke look: Sun, Moon, Monitor (theme), Trophy (rank medals).

MOTION
Tokens: duration fast 100ms, normal 200ms, moderate 300ms; ease-out cubic-bezier(0.16,1,0.3,1) for entrances, ease-in cubic-bezier(0.7,0,0.84,0) for exits. Card exit after a vote: 200ms ease-in translate + fade in the vote direction; next card enters 200ms ease-out scale 0.98 -> 1. Drag follows the pointer with no easing. Swipe overlay: vote token at 12% opacity plus a large vote icon. Buttons and rows: 100ms color transitions. Spring easing only for the streak milestone badge, never for errors. No auto-playing decoration. Reduced motion (OS setting or the user's Settings): no translate/scale, instant state changes, opacity fades <= 100ms.

FOCUS AND KEYBOARD
Every interactive element has a visible :focus-visible ring: 2px --ring with a 2px offset in --background. Minimum target 44x44px for vote buttons and touch targets. Sheets and dialogs trap focus and return it on close. Each screen shows its keyboard shortcuts in a "?" help dialog.

DENSITY
Two densities from user Settings: comfortable (default: 44px rows, 16px body) and compact (36px rows, 14px body). Show compact in the Steward and Admin tables.

LAYOUT SHELL
Top header 64px: a 4px --brand-accent bar along the very top edge of the viewport (decorative, both modes), then symbol + "Semantic Ground Truth" (DM Sans Bold 18px, a link to Review, not a heading), primary nav (Review, Leaderboard, Assistant, Steward, Executive, Admin, each with its 16px icon and a text label; active item = 2px --brand-accent underline + Medium weight, never a filled pill), then notification bell, theme toggle and user menu on the right. Mobile (< 768px): header with hamburger drawer and a bottom nav with icon + label; content padding-bottom clears the bottom nav.

NAMING FOR CODE EXPORT
Keep every data-testid and aria name listed in each screen prompt exactly as written. data-testid format is <page>-<component>-<element> in kebab-case. Use semantic HTML (header, nav with aria-label, main, h1, button, table with th scope).

Deliver first: a design-system page with the two color modes, the type scale, the icon set, and every component in default, hover, focus-visible, active, disabled and loading states, in light and dark.
```

**Optional variant (D2, owner's call).** For a bolder header, add to the global prompt: "Also produce a variant B of the header with a Navy 800 #1B3139 band and White text in light mode (13.59:1), using databricks-symbol-light." Default (variant A) is the plan's Oat Light / Gray Navigation nav surface. Pick one before build 5; record it in the export README.

### 1.1 Sample data used across screens (from the contracts)

Use these values in every prompt so screens stay consistent and the export doubles as test fixtures. All are fictional; none are patient data.

| Item | Values |
|---|---|
| Current user (`MeResponse`) | `displayName` "Priya Raman", `email` "priya.raman@example.com", `roles` ["reviewer","steward"] |
| Asset A (`Asset`, measure) | `displayName` "Readmission Rate (30-day)", `name` "readmission_rate_30d", `domain` "Clinical Quality", `subdomain` "Outcomes", `status` PENDING, `description` "Share of inpatient discharges followed by an unplanned readmission within 30 days.", `plainEnglishLogic` "Count discharges with an unplanned inpatient admission within 30 days, divided by all eligible discharges. Excludes planned readmissions and transfers.", `targetCatalog` "hls_fde_dev", `targetSchema` "dev_matthew_giglia_semantic_ground_truth" |
| Asset B (dimension) | "Discharge Disposition", domain "Clinical Quality" |
| Asset C (page) | "Length of Stay", domain "Operations", subdomain "Throughput" |
| Synonyms (`AssetSynonym`) | "30-day readmits" (4 approvals, 0 rejections), "readmit rate" (2 / 1), "bounce-back rate" (0 / 3) |
| Example questions | "What was our 30-day readmission rate for heart failure patients last quarter?", "Which units have the highest readmission rate this year?" |
| Confidence (`ConfidenceScore`) | `totalVotes` 11, `approvals` 8, `rejections` 2, `edits` 1, `confidence` 0.71 (mid band), `wilsonLower` 0.43 |
| Campaign (`Campaign`) | "Q4 Clinical Quality certification", `campaignType` manual, `status` active, `reviewedAssets` 42 of `totalAssets` 120, `completionRule` certified |
| Card progress | `reviewed` 42, `total` 120; surfacing reason `campaign` |
| User stats | rank 3, totalVotes 186, approvals 131, rejections 29, edits 26, streak 6 days, coverage 35%, skippedCount 14, skippedToday 3 |
| Leaderboard | 1 Jordan Lee 412, 2 Ana Duarte 297, 3 Priya Raman 186, 4 Sam Okafor 140, 5 Wei Chen 88 (votes, 7 days) |
| Executive summary | totalAssets 120, reviewedAssets 42, certifiedAssets 18, coveragePct 35, certificationPct 15, activeReviewers7d 23, votes7d 611, activeCampaigns 3 |
| Feedback queue item | Readmission Rate (30-day): votes approve 8 / reject 2 / edit 3, skips 5, pendingEdits 3, last activity "2 hours ago" |
| Conflict (`ConflictGroup`) | Readmission Rate (30-day), field `description`: current text above vs proposal 1 (Ana Duarte) "Share of inpatient discharges followed by an unplanned inpatient readmission to any facility within 30 days." vs proposal 2 (Sam Okafor) "Percent of discharges with a readmission within 30 days, excluding planned admissions."; approveCount 8, rejectCount 2 |
| Feedback branch | `branchName` "mg-genie-feedback-20261024", status proposed, assetCount 4, files ["ground-truth-infra/fixtures/metric_views/mv_clinical_quality.yaml", "ground-truth-infra/fixtures/semantics/clinical_quality/readmission_rate_30d.md"], created "Oct 24, 2026 06:00" |
| Notifications | "Readmission Rate (30-day) was certified" (`asset.certified`), "Feedback branch mg-genie-feedback-20261024 is ready for review" (`feedback.branch_ready`) |
| Settings (`UserSettings`) | theme system, density comfortable, motion system, default campaign "Q4 Clinical Quality certification", default asset type none, showKeyboardHints true, cardsPerSession 20 |

---

## 2. Screen prompts

Every block ends with the same instruction, so it is written once here and referenced as **[STATES+THEMES]**: "Produce one frame per listed state, each in light and dark. Name frames `<slug>__<state>__<light|dark>` and also a 390px-wide mobile frame for the populated state in both themes (`<slug>__populated-mobile__<theme>`)."

### S0 Shell — slug `shell`

```text
Design the app shell used by every page (see LAYOUT SHELL in the system). Header with the 4px brand-accent top bar, Databricks symbol, product name link "Semantic Ground Truth", primary nav with icons (Review: checklistIcon, Leaderboard: BarsDescendingVerticalIcon, Assistant: SparkleIcon, Steward: ShieldCheckIcon, Executive: dashboardIcon, Admin: gearOutlinedIcon), notification bell (notificationIcon) with an unread count badge "2", theme toggle (Sun / Moon / Monitor cycling light -> dark -> system) and a user menu (avatar initials "PR", name Priya Raman, email, role badges reviewer + steward, link "Settings" with SlidersIcon, "Keyboard shortcuts" with keyboardIcon). A visually hidden "Skip to content" link appears on focus. Notification popover lists the two sample notifications with relative times and a "Mark all as read" button. Mobile: hamburger drawer (menuIcon) with the same items, plus a bottom nav (Review, Leaderboard, Assistant, Steward) with icon over 12px label.
States: populated; loading (nav items for Steward/Executive/Admin as skeleton pills); notifications-empty (popover says "You're all caught up"); notifications-error (bell with muted dot, tooltip "Notifications unavailable"); offline (status banner under the header with cloudOffIcon: "You're offline. Votes and edits are paused until the connection is back.").
Keep: data-testid shell-header-root, shell-nav-link-review, shell-nav-link-leaderboard, shell-nav-link-assistant, shell-nav-link-steward, shell-nav-link-executive, shell-nav-link-admin, shell-bell-button, shell-bell-count, shell-theme-toggle, shell-user-menu-button, shell-offline-banner. aria: <nav aria-label="Main navigation">, <nav aria-label="Mobile navigation">, bell button "Notifications (2 unread)", theme toggle "Switch to dark theme" (names the next state), user menu "Account menu", skip link "Skip to content".
Keyboard: Tab order skip link -> product link -> nav -> bell -> theme -> account; Esc closes popover and drawer and returns focus to the trigger.
[STATES+THEMES]
```

### S1 Review `/` — slug `review`

```text
Design the Review page, the product's signature screen. Centered 512px column. Top row: campaign select ("Q4 Clinical Quality certification"), asset-type select (All types / Measure / Dimension / Page / Domain / Subdomain), and on the right a streak badge (warning token fill, Navy 900 text, "6-day streak") and a muted counter "Skipped today: 3". Page H1 "Review" (32px Bold) above the row; on mobile the H1 is visually hidden but present.
The card (white / Navy 800, 12px radius, 1px border, shadow-sm): badges for asset type (MeasureIcon + "Measure") and status ("Pending"), domain path "Clinical Quality / Outcomes" muted 12px, display name "Readmission Rate (30-day)" 20px Bold, campaign chip, description 16px, confidence meter (mid band, "71% confidence · 11 votes" as text next to the bar), progress bar with brand-accent fill "42 of 120 reviewed", synonym chips (approve/reject mini buttons on each, "+ Add synonym"), "Use it in a sentence" example questions, a "Logic" disclosure that shows the plain-English logic and, behind a second disclosure, the YAML definition in DM Mono on --muted with a copy button, and a "Preview query" section with a Run button and a small result table.
Vote bar under the card, 44px minimum targets, icon + text label on every button: Reject (closeIcon, outline in --vote-reject), Edit (pencilIcon, outline --vote-edit), Approve (checkIcon, filled --vote-approve, largest), and Skip as a visually secondary ghost button (chevronDoubleRightIcon, --vote-skip) with a small chevron that opens the skip-reason popover. Under the bar, when keyboard hints are on: "A approve · R reject · E edit · S skip · ? shortcuts" in muted 12px.
Swipe: dragging right tints the card with --vote-approve at 12% and shows a large check; left tints --vote-reject with a large X. Show one mid-drag frame each way.
Skip reason popover: title "Why skip?", four options with number keys: 1 Not sure, 2 Not my area, 3 Need more context, 4 Other; footer note "Skipping doesn't count as a vote. You'll see this again in 24 hours."
Edit sheet (right side sheet on desktop, bottom sheet on mobile): fields Display name, Description, Plain-English logic, prefilled with the current values; buttons Cancel and "Submit edit". Reject sheet: optional "What's wrong?" textarea (4000 chars, counter), buttons Cancel and "Reject" (destructive with closeIcon).
Shortcut help dialog ("?"): table of keys.
States: populated; loading (card skeleton + vote bar skeleton); swipe-right; swipe-left; empty (primary icon data-quality-3 in a muted tile, "All caught up!", "There's nothing waiting for your review in this campaign.", buttons "Switch campaign" and "View leaderboard"); session-complete (after 20 cards: "Nice work, 20 cards reviewed", stats reviewed 17 / skipped 3, buttons "Keep going" and "Done for now"); resurfaced (info badge on the card "You skipped this earlier"); skip-reason-open; skipped-toast ("Skipped. You'll see it again in 24 h"); edit-sheet; reject-sheet; submitting (vote bar disabled, spinner in the pressed button); error (inline alert with DangerIcon "We couldn't load the next card. UPSTREAM_ERROR: SQL warehouse is starting." and a Retry button); vote-error (card stays, toast "Your vote wasn't saved. Try again."); offline (card read-only, vote bar disabled with a tooltip "You're offline"); shortcuts-dialog.
Keep: data-testid review-filters-campaign, review-filters-asset-type, review-streak-badge, review-skip-counter, review-card-root, review-card-title, review-card-type-badge, review-card-status-badge, review-card-confidence, review-card-progress, review-card-synonyms, review-card-examples, review-card-logic-toggle, review-card-query-run, review-actions-reject, review-actions-edit, review-actions-approve, review-actions-skip, review-actions-skip-reason, review-skip-reason-option (one per reason, with data-reason="not_sure|not_my_area|need_context|other"), review-edit-sheet-submit, review-reject-sheet-submit, review-empty-root, review-session-complete-root, review-error-retry, review-live-region. aria: buttons named "Approve (A)", "Reject (R)", "Edit (E)", "Skip (S)", "Choose a skip reason"; progressbar "Review progress 42 of 120"; meter "Confidence 71%"; a polite live region announcing "Approved Readmission Rate (30-day)" / "Skipped Readmission Rate (30-day)"; logic toggle "Show logic" / "Hide logic".
Keyboard: A or ArrowRight approve; R or ArrowLeft reject (opens sheet); E or ArrowUp edit (opens sheet); S skip; Shift+S skip with reason; 1-4 choose a reason; L toggle logic; ? help; Esc close. Shortcuts are ignored while typing in a field.
[STATES+THEMES]
```

### S2 Leaderboard `/leaderboard` — slug `leaderboard`

```text
Design the Leaderboard page. H1 "Leaderboard". A "My stats" card with 8 stats in a 4-column grid (2 on mobile): Rank #3, Total votes 186, Approvals 131, Rejections 29, Edits 26, Streak 6d, Coverage 35%, Skipped 14 (skipped is shown with chevronDoubleRightIcon and a footnote "Skips don't count toward rank"). Tabs "7 days" / "30 days" / "All time". Table: Rank (medal icons for 1-3 with aria-label "1st place" etc.), Name, Votes, Approvals, Edits, Streak; the current user's row uses the --accent fill and a "You" badge. Table header 12px Medium uppercase on --muted.
States: populated; loading (stats skeleton + 5 row skeletons); empty (primary icon users, "No reviews in this period yet", button "Start reviewing"); error (inline alert + Retry); offline (data shown with "Last updated 5 min ago").
Keep: data-testid leaderboard-stats-root, leaderboard-stats-rank, leaderboard-stats-skipped, leaderboard-period-tabs, leaderboard-table-root, leaderboard-table-row (data-user-id on each), leaderboard-table-current-user, leaderboard-empty-root, leaderboard-error-retry. aria: tablist "Leaderboard period"; table caption "Top reviewers, last 7 days" (visually hidden).
Keyboard: arrow keys move between tabs.
[STATES+THEMES]
```

### S3 Assistant `/assistant` — slug `assistant`

```text
Design the Assistant chat page. H1 "Assistant" with the Genie product icon (genie-icon-full-color-container, 32px) and a one-line intro: "Ask about any asset, its confidence score, campaigns or the leaderboard. Answers are read-only." A chat card (max 768px wide, 70vh tall) with message bubbles: user bubbles right-aligned on --accent, assistant bubbles left on --muted, and tool activity rows between them as a muted 12px line with SparkleIcon "Looked up: leaderboard (7 days)" (no raw JSON). Composer at the bottom: optional "+ Skill" select, multi-line input "Ask a question…", Send button (primary) with SendIcon.
States: empty (three starter prompt buttons: "Explain the confidence score for Readmission Rate (30-day)", "Show me this week's leaderboard", "What's our coverage summary?"); populated (a 4-message exchange explaining the 71% confidence); streaming (assistant bubble with a 3-dot typing indicator, input disabled); error (inline alert "The assistant couldn't answer. Try again." + Try again button); no-agent (primary icon chat, "The assistant isn't set up for this app yet."); offline (input disabled).
Keep: data-testid assistant-chat-root, assistant-chat-message (data-role="user|assistant|tool"), assistant-starter-prompt, assistant-composer-input, assistant-composer-send, assistant-error-retry. aria: log region (role="log", aria-live="polite") named "Conversation"; input labelled "Message the assistant".
Keyboard: Enter sends, Shift+Enter new line, focus returns to the input after send.
[STATES+THEMES]
```

### S4 Steward console `/steward` — slug `steward`

```text
Design the Steward console. H1 "Steward". Under the H1 a steward sub-navigation (underline tabs as links): Overview, Feedback queue (with count badge "12"), Conflicts (badge "3"), Feedback branches (badge "1"). Header actions: "Import assets" (outline, uploadIcon) and "New campaign" (primary, plusIcon). Overview has tabs Campaigns / Assets / Metric views.
Campaigns tab: campaign cards or rows with name, type badge, status badge (active = info, paused = warning, completed = success, archived = default), progress bar 42/120 with brand-accent fill, completion rule, created by, and a status menu (Pause, Complete, Archive with confirm).
Assets tab (compact density): search (searchIcon) + type filter (filterIcon), table Name / Type / Status / Domain / Confidence / Updated, pager "1-25 of 120"; row click opens the Asset detail sheet (title, all fields, DM Mono fixture path, version history timeline with historyIcon).
Metric views tab: list of metric views with full name in DM Mono ("hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.mv_review_activity"), measure and dimension counts; detail panel with measures and dimensions tables (expressions in DM Mono) and a "Validate" button showing a success or error result.
Import wizard (Sheet, 4 steps with a stepper): 1 Source (Unity Catalog with unity-catalog-icon-full-color, or Git folder with FolderBranchIcon) and pick catalog/schema; 2 Select metric views (checkbox table); 3 Review; 4 Result ("Imported 9 of 10" with one per-item error) and optional "Create campaign from these assets".
Create campaign sheet: name, type, scope (domain, subdomain, asset type), completion rule, groups, freshness interval.
States: populated (each tab); loading; empty per tab (Campaigns: primary icon governance, "No campaigns yet", New campaign; Assets: primary icon unity-catalog, "No assets registered", Import assets; Metric views: "No metric views found in this schema"); error per tab with Retry; forbidden (primary icon governance with lockOutlinedIcon, "Steward access required", "Ask an admin to add you to semantic-ground-truth-stewards."); offline; wizard steps 1-4; wizard-scan-in-progress; wizard-partial-failure; asset-detail-sheet; create-campaign-sheet.
Keep: data-testid steward-subnav-overview, steward-subnav-feedback-queue, steward-subnav-conflicts, steward-subnav-feedback-branches, steward-actions-import, steward-actions-new-campaign, steward-tabs-campaigns, steward-tabs-assets, steward-tabs-metric-views, steward-campaign-row, steward-campaign-status-menu, steward-assets-search, steward-assets-row, steward-asset-detail-root, steward-metric-view-validate, steward-import-next, steward-import-submit, steward-forbidden-root. aria: sub-nav <nav aria-label="Steward sections">; tablist "Steward views"; wizard stepper with aria-current="step".
Keyboard: arrow keys in tabs, Enter on a focused table row opens the detail sheet, Esc closes sheets.
[STATES+THEMES]
```

### S5 Executive `/executive` — slug `executive`

```text
Design the Executive summary page. H1 "Executive summary" with a muted subtitle "Semantic asset coverage and certification". A row of 6 KPI cards (3 columns on desktop, 2 on tablet, 1 on mobile): Coverage 35%, Certification 15%, Active reviewers (7d) 23, Votes (7d) 611, Active campaigns 3, Total assets 120. Values 32px Bold, labels 12px muted; Coverage and Certification also get a thin brand-accent progress ring or bar and a delta badge ("+4 pts vs last week" success with arrowUpIcon / "-2 pts" destructive with arrowDownIcon). Below, a card "Detailed dashboard" with the AI/BI icon (ai-bi-icon-full-color), one line of copy, and a link button "Open AI/BI dashboard" with newWindowIcon.
States: populated; loading (6 KPI skeletons); empty (totalAssets 0: primary icon dashboards, "No assets yet", link "Import assets" to the Steward page); dashboard-unconfigured (the dashboard card shows "The dashboard link isn't configured for this environment." and no button); error; forbidden (as Steward); offline.
Keep: data-testid executive-kpi-coverage, executive-kpi-certification, executive-kpi-active-reviewers, executive-kpi-votes, executive-kpi-active-campaigns, executive-kpi-total-assets, executive-dashboard-link, executive-empty-root, executive-forbidden-root. aria: dashboard link named "Open AI/BI dashboard (opens in a new tab)"; each KPI is a group labelled by its label.
[STATES+THEMES]
```

### S6 Admin `/admin` — slug `admin`

```text
Design the Admin page (compact density). H1 "Admin". Section cards in one column, each with a title, one-line description and its own Save button:
1 Members: three groups (semantic-ground-truth-admins -> admin, semantic-ground-truth-stewards -> steward, semantic-ground-truth-users -> reviewer) each listing members (email or service principal id in DM Mono, added by, added at) with a remove button (trashIcon, confirm), and an "Add member" input + button.
2 Scoring: Wilson z (1.96), industry prior (0.7), prior weight (5), prior decay threshold (20), certification threshold (0.8), minimum votes for certification (10), staleness days (90), freshness interval days (30), and new "Skip cooldown (hours)" (24, range 0-720, help text "How long a skipped card stays hidden from that reviewer"). Number inputs with units and helper text.
3 Role lists (legacy fallback, read-only chips of emails with a note "Kept for compatibility. Manage access in Members.").
4 Maintenance: "Recompute confidence for an asset" (asset id input + button) and "Run freshness check now"; both destructive-styled outline buttons with confirm dialogs that focus Cancel first.
States: populated; loading; empty-group ("No members. Add an email or service principal id."); saving; saved toast; validation-error (skip cooldown 900 -> "Enter 0 to 720 hours"); last-admin-conflict (inline alert: "You can't remove the last admin."); error; forbidden ("Admin access required"); offline.
Keep: data-testid admin-members-group (data-group name), admin-members-add-input, admin-members-add-submit, admin-members-remove, admin-scoring-skip-cooldown, admin-scoring-save, admin-maintenance-recompute, admin-maintenance-freshness, admin-forbidden-root. aria: every input has a visible label; confirm dialogs use role="alertdialog".
[STATES+THEMES]
```

### S7 Settings `/settings` (new) — slug `settings`

```text
Design a new Settings page for every user. H1 "Settings". Left section index on desktop (Appearance, Motion, Review, Notifications, About), single column on mobile. Sticky footer with "Save changes" (primary) and "Discard" that appears only when there are unsaved changes.
Appearance: Theme as a 3-option segmented control with icons (Light / Dark / System) and a small live preview card that shows a mini review card in the chosen theme; Density as a 2-option segmented control (Comfortable / Compact) with a preview row.
Motion: 3 options (System / Reduce / Full) with help text "System follows your device's reduced-motion setting. Full never overrides a device that asks for reduced motion."
Review: Default campaign (select, "Q4 Clinical Quality certification"), Default asset type (select, "All types"), Cards per session (number input 5-100 with a slider, value 20), Show keyboard hints (switch, on).
Notifications: a table of event types (Asset certified, Campaign created, Campaign completed, Vote milestone, Feedback branch ready, Feedback failed) with an In-app switch per row and Slack / Teams / Webhook columns shown disabled with a "Coming later" tooltip, plus a "Daily digest" switch per row.
About: signed in as Priya Raman (priya.raman@example.com), roles reviewer + steward as badges.
States: populated; loading (form skeleton); defaults (muted note "You're using the default settings"); dirty (footer visible); saving; saved (toast "Settings saved"); validation-error (cards per session 150 -> "Enter a number from 5 to 100"); error (load failed + Retry; save failed inline); offline (form disabled; theme still switches locally with a note).
Keep: data-testid settings-theme-light, settings-theme-dark, settings-theme-system, settings-density-comfortable, settings-density-compact, settings-motion-system, settings-motion-reduce, settings-motion-full, settings-review-default-campaign, settings-review-default-asset-type, settings-review-cards-per-session, settings-review-keyboard-hints, settings-notifications-row (data-event-type), settings-footer-save, settings-footer-discard. aria: each segmented control is a radiogroup with a visible legend ("Theme", "Density", "Motion"); switches have labels.
Keyboard: arrow keys inside radiogroups; Ctrl/Cmd+S saves.
[STATES+THEMES]
```

### S8 Feedback queue `/steward/feedback-queue` (new) — slug `steward-feedback-queue`

```text
Design the steward Feedback queue page (compact density), inside the steward sub-navigation (Feedback queue active). H1 "Feedback queue", subtitle "Assets with new votes, edits or skips that need a steward's look." Filter bar: campaign select, asset type select, status segmented control (Pending / All), search. Table columns: Asset (display name + type badge), Votes (a small stacked bar approve/reject/edit with numbers "8 · 2 · 3" and icons, never color alone), Skips (5, with an info badge "Often skipped" when skips >= half of votes), Pending edits (3, link "Resolve" to Conflicts when >= 2), Last activity ("2 hours ago", absolute time in a tooltip). Pager. Row click opens the Asset detail sheet.
States: populated (8 rows using the sample assets plus realistic others such as "Average Length of Stay", "ED Boarding Hours", "Discharge Disposition"); loading; empty (primary icon data-quality-3, "Nothing waiting for triage", link "View campaigns"); filtered-empty ("No assets match these filters" + Clear filters); error; forbidden; offline.
Keep: data-testid steward-queue-filter-campaign, steward-queue-filter-asset-type, steward-queue-filter-status, steward-queue-search, steward-queue-row (data-asset-id), steward-queue-resolve-link, steward-queue-empty-root, steward-queue-clear-filters. aria: table caption "Feedback queue" (visually hidden); vote bar has an accessible name "8 approvals, 2 rejections, 3 edits".
Keyboard: J/K move row focus, Enter opens detail, C opens Conflicts for the focused row, / focuses search.
[STATES+THEMES]
```

### S9 Conflicts `/steward/conflicts` (new) — slug `steward-conflicts`

```text
Design the steward Conflicts page, inside the steward sub-navigation (Conflicts active). H1 "Conflicts". Desktop: two panes. Left: list of conflict groups (asset name, field badge "Description", "2 proposals · 2 rejects", age). Right: detail for the selected asset: the current value in a muted card labelled "Current", then one card per proposal with author avatar initials, name, time, and a word-level diff against the current value (inserted words underlined on a --vote-approve 12% tint, removed words struck through on a --vote-reject 12% tint, plus a legend). Vote tally line "8 approvals · 2 rejections". A radio selection on each proposal card. Resolution bar sticky at the bottom: "Accept selected edit" (primary, checkIcon), "Keep current" (secondary), "Reject all" (destructive, closeIcon, confirm dialog), and an optional note field (4000 chars). Mobile: list first, detail as a full page with a back link.
States: populated; loading; empty (primary icon users, "No conflicts. Reviewers agree."); resolving (bar disabled, spinner); resolved-toast ("Conflict resolved. Ana Duarte and Sam Okafor were notified."); stale (inline alert "Another steward already resolved this." + Refresh); reject-all-confirm dialog; error; forbidden; offline.
Keep: data-testid steward-conflicts-list-item (data-asset-id), steward-conflicts-current, steward-conflicts-proposal (data-vote-id), steward-conflicts-proposal-select, steward-conflicts-accept, steward-conflicts-keep, steward-conflicts-reject-all, steward-conflicts-note, steward-conflicts-empty-root, steward-conflicts-stale-refresh. aria: proposals are a radiogroup named "Proposed descriptions"; diff insertions/deletions use <ins>/<del> so screen readers announce them.
Keyboard: J/K previous/next group, 1-9 select a proposal, Enter or A accept, C keep current, X reject all (opens confirm), N focus note, Esc back to list on mobile.
[STATES+THEMES]
```

### S10 Feedback branches `/steward/feedback-branches` (new) — slug `steward-feedback-branches`

```text
Design the steward Feedback branches page, inside the steward sub-navigation (Feedback branches active). H1 "Feedback branches", subtitle "Branches the feedback pipeline opened with approved edits. Review and merge them in Git, then record the outcome here." A list of branch cards: BranchIcon, branch name in DM Mono "mg-genie-feedback-20261024" with a copy button (copyIcon), status badge (pending default, proposed info, in review warning, merged success with checkIcon, rejected destructive with closeIcon, failed destructive with DangerIcon), "4 assets", created and completed times, reviewed by. Expand to show the changed files (DM Mono list with fileCodeIcon) and the summary rendered as markdown. Actions: "Mark in review", "Mark merged", "Mark rejected" (confirm with optional note). No "open in Git" button (no URL in the contract yet); the copy button is the hand-off.
States: populated (3 branches: proposed, in_review, merged); loading; empty (primary icon governance, "No feedback branches yet", "The feedback pipeline opens one when approved edits are ready."); failed-branch (a failed branch card whose summary is the failure reason); updating; copied-toast ("Branch name copied"); error; forbidden; offline.
Keep: data-testid steward-branches-card (data-batch-id), steward-branches-name, steward-branches-copy, steward-branches-status, steward-branches-expand, steward-branches-mark-in-review, steward-branches-mark-merged, steward-branches-mark-rejected, steward-branches-empty-root. aria: copy button "Copy branch name mg-genie-feedback-20261024"; expand button aria-expanded.
Keyboard: J/K move between branches, Enter expands, Y copies the branch name.
[STATES+THEMES]
```

### S11 Not found and app error — slugs `not-found`, `app-error`

```text
Design two fallback pages. 404: primary icon unity-catalog in a muted tile, H1 "Page not found", "The page you're looking for doesn't exist or moved.", button "Back to Review". App error (render crash): DangerIcon, H1 "Something went wrong", "Reload the page to try again. If it keeps happening, share the details below with your admin.", buttons "Reload" (primary) and "Copy details", and a collapsed "Technical details" disclosure with a DM Mono error message and stack.
States: populated only.
Keep: data-testid not-found-root, not-found-home-link, app-error-root, app-error-reload, app-error-details-toggle.
[STATES+THEMES]
```

---

## 3. Export instructions (owner)

1. **Frames.** Every frame is named `<slug>__<state>__<theme>` (`theme` = `light` | `dark`), for example `review__skip-reason-open__dark`, `steward-conflicts__stale__light`. Mobile frames add `-mobile` to the state: `review__populated-mobile__light`. Slugs: `shell`, `review`, `leaderboard`, `assistant`, `steward`, `executive`, `admin`, `settings`, `steward-feedback-queue`, `steward-conflicts`, `steward-feedback-branches`, `not-found`, `app-error`, plus `design-system` for the tokens/components page.
2. **Code.** From Figma Make, export the generated React code once for the whole file. Commit it unchanged to `docs/design/ui/figma/_code/` (reference only; build 5 ports it into `ground-truth-app/client/src/**` and never imports from `docs/`).
3. **Screenshots.** Export each frame as PNG at 2x into `docs/design/ui/figma/<slug>/<frame name>.png`, e.g. `docs/design/ui/figma/review/review__populated__light.png`. One folder per slug; light and dark side by side in the same folder.
4. **Tokens.** Export the variables (both modes) as JSON to `docs/design/ui/figma/design-system/variables.json`. Build 5 checks it against `client/src/theme/tokens.ts`; any hex that differs from §1 is a defect in the export, not a new token.
5. **README.** Add `docs/design/ui/figma/README.md` with: Figma file URL, export date, which header variant (A or B, D2) you picked, and any prompt you changed.
6. **Commit** on a feature branch (`mg-genie-figma-export` or similar), not `main`. Then plan build 5 from [`build5_outline.md`](build5_outline.md).

**Checklist before committing the export**

* [ ] Every screen in §2 has every listed state in light and dark, plus the mobile populated frame.
* [ ] No hex outside §1; no lucide icon except Sun, Moon, Monitor, Trophy.
* [ ] The Databricks symbol is unmodified and never forms a lockup with the product name.
* [ ] Every `data-testid` and aria name in the screen prompts is present in the exported code (`grep -c data-testid` per screen file).
* [ ] No lorem ipsum (`grep -ri lorem docs/design/ui/figma/_code` returns nothing).

## 4. Asset references (brand catalog)

Looked up in `/Workspace/Shared/brandfolder/assets.csv` on 2026-10-24. CDN pattern `https://cdn.bfldr.com/9AYANS2F/at/<attachment id>/<filename>` (strip any `?auto=` query). Build 5 downloads them once into `ground-truth-app/client/public/` (as the build-3 `src/notebooks/download_brand_assets` notebook does) and never calls the CDN at runtime (HIPAA workspace).

**Licence / usage.** The catalog's `License Model` column is empty for all 1,712 assets. Logo/favicon rows say "Please review the Brand Guidelines before using" (brand.databricks.com/databricks-logo). Rules applied here: do not alter the symbol's geometry or color; UI system icons are functional icons and may be rendered in `currentColor` (fill only, no geometry change); primary icons use the navy variant on light and the white variant on dark rather than recoloring. Correction to ui_brand_plan §5: `genie` and `ai-bi` are **not** in `databricks-primary-icons-collection.csv`; they are product icons (below).

| Use | Filename | Attachment id |
|---|---|---|
| Nav: Review | `checklistIcon.svg` | `s9bwn78c63qkbkvcsx8m6c9` |
| Nav: Leaderboard | `BarsDescendingVerticalIcon.svg` | `bv47hfrq3h8fg6j9rw5pxs` |
| Nav: Assistant | `SparkleIcon.svg` | `f4gz6956pq6cktxx85fx` |
| Nav: Steward | `ShieldCheckIcon.svg` | `pmsb85cz97gbv7gf7vqk5kz` |
| Nav: Executive | `dashboardIcon.svg` | `jwsqftnwqtn68ccvkbcrk54f` |
| Nav: Admin | `gearOutlinedIcon.svg` | `6mfrjqnbw5tqtrckqfx2rw7` |
| Nav: Settings | `SlidersIcon.svg` | `6sg94jxmx6pcnx37qp8nfgz` |
| Vote: Approve | `checkIcon.svg` | `twnwj3b2zgp7f76fn985pm7` |
| Vote: Reject | `closeIcon.svg` | `6jmnzsg4ct4s5kb2whfkbr` |
| Vote: Edit | `pencilIcon.svg` | `fwtxhm7bbmh5mh5vj5rfbqc` |
| Skip | `chevronDoubleRightIcon.svg` | `5j7g25sgjwvhb7fgshmprs7v` |
| Feedback queue | `queryListViewIcon.svg` | `xh649vvqs36sxgz3wbfvpcv` |
| Conflicts | `forkIcon.svg` | `6zb69hwq6v2ff6k6qqf9pvs` |
| Feedback branches | `BranchIcon.svg` | `7j8k2p9gb8jnjnrsn4rs7k` |
| Commit / merged | `GitCommitIcon.svg` | `s6gp7x2swhxc2mxbk7bz6hf` |
| Notifications | `notificationIcon.svg` | `r38s393xgf9bw6qmfjb7pgn` |
| Search / filter | `searchIcon.svg` / `filterIcon.svg` | `p6q8v8ts5q49htt7s6bbncm` / `bmqkt47zbv4hwtgcsh2mqf83` |
| Keyboard help | `keyboardIcon.svg` | `gqf7jq3vnbt997j77cxwcq7s` |
| Retry | `refreshIcon.svg` | `nm6g9m56jsh5spfmrsqkv7p` |
| Offline | `cloudOffIcon.svg` | `hwfjwvk9bknwxq3zv38v6tnr` |
| Forbidden | `lockOutlinedIcon.svg` | `t9nk8hgzb94fpf2qqg5vhw` |
| Warning / error | `warningOutlinedIcon.svg` / `DangerIcon.svg` | `rgnzg478szqk4nv65gbmnqxf` / `wg9fp4vrjpxkfb845nfv5hx` |
| Asset type: measure / page / tag | `MeasureIcon.svg` / `InfoBookIcon.svg` / `TagIcon.svg` | `cxs5f5m8mnnhc99mfs3qb68` / `bkvxwqvxnmsqwkqc4nwbrc6` / `htp7vjwktt6vp58ktfxtfmr` |
| Members | `userGroupIcon.svg` | `8s595xgbw6k64mg7gmrt5p8` |
| History | `historyIcon.svg` | `rz79jn6pf9k6fr7b87crxmr` |
| External link | `newWindowIcon.svg` | `qh8n6pvrmsms58gkrc8wfs` |
| Delete / add | `trashIcon.svg` / `plusIcon.svg` | `4qz2n29gxnkg76m84cb88t` / `s9gwmbkgv56tkrkx6p9bkkm7` |
| Empty: unity-catalog (navy / white) | `primary-icon-navy-unity-catalog.svg` / `primary-icon-white-unity-catalog.svg` | `gv7xfnnvrqxpc6rmwmbjk8c` / `2k582scp55m6sgcw47358j` |
| Empty: data-quality-3 | `primary-icon-navy-data-quality-3.svg` / `primary-icon-white-data-quality-3.svg` | `xmmrtc5gg9vctkpj3t6fxvj8` / `j84x5v7v3wfshw7t3ps5jfm` |
| Empty: users | `primary-icon-navy-users.svg` / `primary-icon-white-users.svg` | `w8fr7wk54vrxkrnr6ff6pq` / `w52wxrmg48k5vshk5gthv4s` |
| Empty: dashboards | `primary-icon-navy-dashboards.svg` / `primary-icon-white-dashboards.svg` | `5kxm2kxgnc6px9kmmcmxtbp` / `w6qtkn56br5qn87h4fsqvm84` |
| Empty: chat | `primary-icon-navy-chat.svg` / `primary-icon-white-chat.svg` | `7hfx7zgtqp7hx5vwkg6pcsfs` / `sgjkhww7cjzrkpx4th5hg7f` |
| Empty: governance | `primary-icon-navy-governance.svg` / `primary-icon-white-governance.svg` | `m475jx2fkjpc7f9z4mgntv4` / `kr4r9cc8wn8ww3s59bwhk6gj` |
| Product: Genie | `genie-icon-full-color-container.svg` | `4tk83ksb45s9wk8fcfh47` |
| Product: AI/BI | `ai-bi-icon-full-color.svg` | `9wvk7v29h5mhm97c5w6f55` |
| Product: Unity Catalog | `unity-catalog-icon-full-color.svg` | `8shgqnmk45sz8gkqsmxh3wfh` |
| Symbol (already committed) | `databricks-symbol-color.svg` / `databricks-symbol-light.svg` | in `client/public/brand/` |

`copyIcon`, `fileCodeIcon`, `arrowUpIcon`, `arrowDownIcon`, `SendIcon` and `FolderBranchIcon` are also in the catalog (UI system icons); look up their ids by filename when downloading.
