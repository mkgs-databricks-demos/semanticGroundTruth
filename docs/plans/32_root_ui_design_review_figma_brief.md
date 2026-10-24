# Session 32: UI design review from scratch + Figma Make brief + UI test strategy

**Build 4 · wave `4-0` · edit (design, docs only) · root**

## Scope

The owner wants the app UI redone with a bold Databricks look (bold colors, Databricks icons, light and dark mode, user settings), designed in **Figma Make** first and then built in build 5. This session re-reads every design input from scratch, inventories what the app does today, and writes (a) a Figma Make brief the owner pastes into Figma Make screen by screen, and (b) a UI test strategy so build 5 ships a UI that is testable by construction. No client code.

## Inputs to read in full

* Design docs: `docs/design/L100_semantic_ground_truth_app.md`, `L200-C1`..`L200-C9`, `L300-09_app_init.md`, `L300-12_react_frontend.md`, `semantic-ground-truth-app-ideation.md`, `docs/plans/ui_brand_plan.md`, `docs/runbooks/ui_theming.md`.
* Brand skills (authoritative for brand rules): `/Workspace/Users/matthew.giglia@databricks.com/.assistant/skills/databricks-brand-{design-principles,colors,typography,assets,dark-light-mode,motion,components,accessibility}/SKILL.md`. Brand asset catalog: `/Workspace/Shared/brandfolder/assets.csv` (find the Databricks icon set; note asset IDs and licence/usage notes).
* Current client: `ground-truth-app/client/src/**` (routes in `App.tsx`: `/`, `/leaderboard`, `/assistant`, `/steward`, `/executive`, `/admin`; theme `client/src/theme/tokens.ts`, `index.css`; components under `components/`), shared contracts (plan 25 adds `UserSettings`, skip, steward triage types).
* Known UI gaps: G6 steward views FeedbackQueue / ConflictResolver / BranchReview not built (APIs arrive in session 33); `EmptyState.tsx` uses lucide icons instead of Databricks icons; manual Lighthouse + keyboard-only check never done.

## Deliverables (all under `docs/design/ui/`)

1. `screen_inventory.md`: every route, its audience (reviewer / steward / admin / executive), data it shows (contract types), actions (API calls), states (loading, empty, error, forbidden, offline), and what is missing today. Include the new screens: **Settings** (theme light/dark/system, density, motion, keyboard hints, default campaign, cards per session), **Steward → Feedback queue**, **Conflicts**, **Feedback branches**, and the skip interaction (skip reason picker, skipped count).
2. `figma_make_brief.md`:
   * A global prompt block (product, users, tone, brand rules: Lava 600 `#FF3621` primary, Navy 800 `#1B3139`, DM Sans/DM Mono, contrast ≥ 4.5:1 body / ≥ 3:1 large, light and dark palettes from `ui_brand_plan.md`, Databricks icon set, motion rules, components mapped to shadcn/`@databricks/appkit-ui` primitives).
   * One prompt block per screen (from the inventory), each with layout, components, realistic sample data drawn from the contracts (no lorem ipsum), all states, keyboard map, and a note on which `data-testid` / ARIA names the generated code must keep.
   * Export instructions for the owner: export code + screenshots per screen (light and dark) into `docs/design/ui/figma/<screen>/`; name frames `<route>__<state>__<theme>`.
3. `ui_test_strategy.md`: query priority (role/name → label → text → `data-testid` only for non-semantic hooks), `data-testid` naming `<page>-<component>-<element>`, one Testing Library + axe test per screen and state, `fetch` mocking from plan 25 schemas (MSW if session 26 added it), keyboard-only flows (review: A/R/E/S, steward resolve), visual-state checks for light/dark tokens, and which checks stay manual (Lighthouse, screen reader). Map each test to a screen in the inventory.
4. `build5_outline.md`: proposed build-5 sessions (shell + settings, review flow, steward views, admin/executive/leaderboard, Databricks icons in EmptyState and nav, MCP App visual match, a11y + Testing Library suite, converge app) with owned paths, so the planner can write build-5 plans once the Figma export lands.

## Acceptance Criteria

- [ ] Inventory covers all 6 current routes + the 4 new screens, each with states and contract types.
- [ ] Brief has one global block and one block per screen; every color/font value matches `ui_brand_plan.md` and the brand skills.
- [ ] Test strategy maps every screen/state to at least one automated test.
- [ ] No client code changed.

## Owned Paths

- `docs/design/ui/**`

## Dependencies

- None (wave `4-0`). Build 5 consumes it after the owner's Figma Make export.
