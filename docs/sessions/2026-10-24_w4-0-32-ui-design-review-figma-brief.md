# 2026-10-24 · Wave 4-0 · Session 32 — UI design review + Figma Make brief + UI test strategy

Job run `110489694161084` · branch `mg-genie-build-4` · mode `edit` · docs only (owned `docs/design/ui/**`).

## Problem

Build 5 will redesign the client from a Figma Make export. The owner needs a brief to paste into Figma Make, and build 5 needs a screen inventory, a test strategy that makes the new UI testable by construction, and a session outline. Today's client has no `data-testid`s, no component tests, lucide icons, and several state-handling defects.

## Findings (root causes recorded in `screen_inventory.md` §3)

* F1 no `data-testid`; F11 no rendered-component tests (only static token/a11y tests).
* F2 header product name is the only `<h1>`; page titles are `<h2>`.
* F3 Review shows "All caught up" when `GET /api/review/next` fails.
* F4 Steward / Executive / Admin show "Access required" when `GET /api/me` fails.
* F5 skip-as-vote (already fixed by sessions 25/33); no skip reason or counter in the UI.
* F6/F7 lucide icons (incl. `PartyPopper`); desktop nav has no icons; mobile drawer uses a filled pill.
* F8 per-user notification preferences live on the admin-only page.
* F9 theme only in `localStorage`; F10 Assistant copy is developer documentation.

## Changes

* `docs/design/ui/screen_inventory.md`: route map (6 current routes + Settings, Feedback queue, Conflicts, Feedback branches + shell + fallbacks), per screen: audience, contract types, actions, states (loading / populated / empty / error / forbidden / offline + extras), keyboard, gaps; coverage table.
* `docs/design/ui/figma_make_brief.md`: global prompt (palette, semantic tokens light/dark, contrast rules, DM Sans/DM Mono scale, Databricks icons, motion tokens, focus, density, shell, naming), shared sample data from the contracts, 12 per-screen prompts with states, `data-testid`s, aria names and keyboard maps, export instructions to `docs/design/ui/figma/`, brand asset table with attachment ids.
* `docs/design/ui/ui_test_strategy.md`: tooling, query priority, `data-testid` naming, `mockApi` validated by `ROUTE_CONTRACTS` zod schemas, 6 keyboard flows, light/dark checks in jsdom's limits, screen × state matrix, manual checks, gate.
* `docs/design/ui/build5_outline.md`: 9 proposed sessions (42-50) in 5 waves with owned paths, dependencies, acceptance, open questions.

## Decisions

* ui_brand_plan.md values are used verbatim; differences from the generic brand skills (primary Lava 700/500, Oat Light page, Navy 500 input border) are explained in the brief rather than changed.
* Bold brand within existing tokens: 4 px `--brand-accent` top bar, underline active nav, 32 px Bold H1. A Navy 800 light-mode header is offered as optional variant B (D2, owner's call).
* New steward screens are separate routes with a steward sub-nav (deep-linkable from notifications).
* Skip: `S` skips without reason (build-4 behaviour), `Shift+S` opens the reason picker; Skip is a ghost button, never styled as a vote. `A/R/E` added as aliases for the arrows.
* Notification preferences move from Admin to Settings.
* lucide allowed only for Sun, Moon, Monitor, Trophy (no Databricks equivalent).
* Correction to ui_brand_plan §5: Genie and AI/BI are product icons, not in the primary-icons collection.

## Checks

| Check | Result |
|---|---|
| Every brief icon filename + attachment id exists in `/Workspace/Shared/brandfolder/assets.csv` | pass (0 mismatches) |
| Every `*Icon` name in the brief exists in the catalog | pass |
| Every hex in the brief is in ui_brand_plan.md or the `databricks-brand-colors` skill with the same name | pass (7 extra palette hex all match the skill) |
| Inventory, brief and test matrix each cover S0-S11 | pass |
| 140 `data-testid`s in the brief match `^[a-z]+(-[a-z0-9]+)+$` | pass |
| Inventory field names vs session-25 contracts (`UserSettings`, `FeedbackQueueItem`, `ConflictGroup`, `EditProposal`, `FeedbackBranch`, `SkipRequest`, enums, cooldown range) | pass; note limit corrected to 4000 |
| No lorem ipsum in the brief | pass (only the "no lorem ipsum" rule text) |
| No client code changed (`git status`: only `docs/design/ui/` from this session) | pass |
| Figma Make render of the prompts | skipped (owner runs Figma Make) |

## Requests

* `ground-truth-app/shared/contracts/review.ts` (plan 33 / session 33): add `resurfacedFromSkip?: boolean` to `ReviewCard` if the server sets it; the UI design depends on it.
* `ground-truth-app/shared/contracts/entities.ts` (future contract session): `FeedbackBranch` has no repo/branch URL; build 5 shows copy-only until one is added.
* `docs/plans/ui_brand_plan.md` (planner): §5 lists Genie / AI/BI as primary icons; they are product icons (`genie-icon-full-color-container.svg`, `ai-bi-icon-full-color.svg`).

## Files

* Created: `docs/design/ui/screen_inventory.md`, `docs/design/ui/figma_make_brief.md`, `docs/design/ui/ui_test_strategy.md`, `docs/design/ui/build5_outline.md`.
