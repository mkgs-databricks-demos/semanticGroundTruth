# Session 37: Converge infra: skips through CDF, bronze and metric views; G10 cleanup deployed

**Build 4 · wave `4-5` · converge (alone) · target `infra_metric_view_deploy`; the wave gate also checks `lb_review_skips_history`, `bronze_lakebase_cdf`, `executive_dashboard`**

## Steps

1. Session 36 has deployed the app, so migration 009 has run and `app.review_skips` / `app.user_settings` exist in Lakebase. If `lb_review_skips_history` is empty, create one skip through the app as the M2M SPN (`POST /api/review/skip` on a demo-campaign asset) so CDF has a row; do not insert into Lakebase directly.
2. From `ground-truth-infra`: `bundle validate --strict --target dev`; `bundle deploy --target dev --var=run_setup=false` (deploys G10 deletions, dashboard and metric-view fixtures). If session 28 changed `setup_cdf_config.py`, run `bundle run setup_lakebase_cdf --target dev` once; then `bundle run cdf_bronze --target dev` so bronze picks up the new tables; then `bundle run metric_view_deploy --target dev`.
3. Verify with SQL on warehouse `0ea84986a23a47c3`: `lb_review_skips_history` and `lb_user_settings_history` exist; `bronze_lakebase_cdf` has rows with `_source_table` for `review_skips`; `SELECT MEASURE(skips), MEASURE(skip_rate) FROM mv_review_activity` and `MEASURE(total_skips)` on `mv_user_leaderboard` execute; every existing measure still executes (compare the measure list before and after).
4. The executive dashboard redeploys with the infra bundle; its runtime target executes every dataset.
5. `post_deploy_setup` must still validate without the removed tasks; do not run it with `run_setup=true` in this session.

## Stable when

`infra_metric_view_deploy` run succeeds in this build, and the wave runtime gate passes for `lb_review_skips_history`, `bronze_lakebase_cdf` and `executive_dashboard`.

## Owned Paths

- `ground-truth-infra/**` (excluding `ground-truth-infra/.databricks/**`, `ground-truth-infra/docs/plans/**`)

## Dependencies

- 28, 36
