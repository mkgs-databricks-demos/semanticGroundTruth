# Session 63: Docs, build summary, manual-check worksheet

**Build 5 · wave `5-10` · edit (alone)**

## Steps

1. **Build summary** `docs/sessions/<today>_build-5-summary.md` (date from `datetime.now()`): waves, sessions, commits, repairs, gate results, the visual-checks table from session 62, decisions D-B5-1..3, open requests from every status file. Update `docs/sessions/INDEX.md` (newest first).
2. **Manual-check worksheet** `docs/sessions/build-5_manual_checks.md` (fixed name, read by wave `5-11`): one table per check from `docs/design/ui/ui_test_strategy.md` §9, each row `check | route | theme | result (blank) | notes (blank)`: Lighthouse accessibility ≥ 95 on `/`, `/leaderboard`, `/steward`, `/settings` light and dark; screen reader (K1, K2); keyboard walk-through of all screens; forced colors; Figma side-by-side (start with session 62's 5 lowest-similarity cells); 390 px touch swipe; MCP App card in Genie One / Genie Code (follow-up 11); Share to Slack in **Send** mode to a test channel once. Leave every result blank: the owner fills it.
3. **Project memory:** `PROJECT_MEMORY.md`, `ground-truth-app/PROJECT_MEMORY.md`, `ground-truth-infra/PROJECT_MEMORY.md`, `ground-truth-agent/PROJECT_MEMORY.md`: status log entries for build 5.
4. **Runbooks:** `docs/runbooks/deploy_order_and_permissions.md` (Slack `ai-gateway` user scope consent from session 50; infra deploy always runs post-deploy setup); `docs/runbooks/cdf_bronze_operations.md` (monitor dashboard URL from session 58).
5. **Requests:** in `docs/requests/2026-10-27_build-4-follow-ups.md` move items closed by build 5 (1, 2, 4, 5, 6, 7, 8, 9, 10 if fixed, 11 except the manual checks, 12 partially) to the "Closed" line with commits; add a new `docs/requests/<today>_build-5-follow-ups.md` for what is left; update `docs/requests/README.md`.
6. **Plans:** `docs/plans/build-5/INDEX.md` status column; `docs/plans/gap_analysis_2026-10.md` §7 (build 5: G5 Option A done, G6 screens done, G7/G8 manual pending wave 5-11, G11 done).

## Owned paths

* `docs/sessions/**`, `docs/requests/**`, `docs/runbooks/**`
* `PROJECT_MEMORY.md`, `ground-truth-app/PROJECT_MEMORY.md`, `ground-truth-infra/PROJECT_MEMORY.md`, `ground-truth-agent/PROJECT_MEMORY.md`
* `docs/plans/build-5/INDEX.md`, `docs/plans/gap_analysis_2026-10.md`

## Dependencies

57, 58, 59, 60, 61, 62
