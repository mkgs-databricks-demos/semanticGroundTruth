# Session 39: Converge agent: operations dashboard + agent_verification

**Build 4 · wave `4-7` · converge · run `655172288447819` · branch `mg-genie-build-4` · 2026-10-26**

Plan: `docs/plans/39_agent_converge_operations_dashboard.md`. Status: **pass**. Attempt 1 was stable, and no code changes were needed.

## Attempt 1 (stable)

* `bundle validate --strict --target dev` (ground-truth-agent): Validation OK.
* `bundle deploy --target dev` (20:29Z): created `dashboards.ops_dashboard` and its permissions, updated `jobs.agent_verification`, and left 2 resources unchanged. The working tree was unchanged at HEAD `fe061da`.
* Dashboard `[dev matthew_giglia] Semantic Ground Truth — Operations`, id `01f1d17bf9531f5ba79f838a0da0df35`: published at revision `2026-10-26T20:29:42.391Z` (after the deploy), on warehouse `0ea84986a23a47c3`, with `embed_credentials=false`.
* All 17 datasets pass `EXPLAIN` (no `Error occurred during query planning`) and also run (`SELECT * FROM (<q>) LIMIT 5` returns SUCCEEDED). Each dataset used its own `catalog`/`schema` (`hls_fde_dev.dev_matthew_giglia_semantic_ground_truth`), and the RANGE defaults were inlined as dates. No measure from session 37 is missing.
* `bundle run agent_verification --target dev`: run `312880880434652` (job `930756362224750`) ended TERMINATED SUCCESS with "All 29 verification checks passed". This includes `ops_dashboard:exists_and_published`, `ops_dashboard:datasets` and the 17 `ops_dashboard:dataset:<name>` checks, plus the Genie conversation check.
* Genie space `01f1ceb0506f1c5d9f2024bfc5f95943` (`agent_space`, which has `require_fresh_deployment: false`):
  * All 9 tables resolve, and every `column_configs` entry is still a column of its table.
  * All 9 example SQLs pass `EXPLAIN`.
  * Both probe questions return a SUCCEEDED query attachment: 13 votes in total, and assets by status (PENDING 119, REVIEWED 13).

## Observations (not fixed, outside scope)

* Some datasets plot raw BINARY ids: `campaign_id` in `ds_votes_skips_daily` / `ds_skips_by_campaign` and the asset id in `ds_top_skipped_assets`. The dashboard renders them as unreadable bytes. A follow-up could select `hex(<id>)` (or join a name) in `ground-truth-agent/src/dashboards/operations.lvdash.json`. This is cosmetic; every dataset executes.
* Session 29 found that the metric views are missing some dimensions (asset_type on `mv_review_activity`, campaign name/due date, `branch_name`). These are still open.

## Files modified

None. Assets: the dashboard `ops_dashboard` was created and published, and the `agent_verification` job was updated by the deploy.

## Checks

| Check | Result |
|---|---|
| bundle validate --strict --target dev | pass |
| bundle deploy --target dev | pass |
| Dashboard published after the deploy | pass (20:29:42Z) |
| 17/17 datasets EXPLAIN + execute | pass |
| agent_verification run 312880880434652 | pass (29/29) |
| Genie space tables / column configs / example SQL | pass (9/9/9) |
| Genie probe questions (warn) | pass (2/2) |

## Requests

None blocking. Optional: show readable ids in the dashboard datasets (see Observations).
