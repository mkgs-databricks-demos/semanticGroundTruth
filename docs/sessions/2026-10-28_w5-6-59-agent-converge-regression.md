# Session 59 (build 5, wave 5-6, converge): agent ops dashboard UUID ids + regression

* **Run:** `229891579528310` (job `884230801831394`), branch `mg-genie-build-5`, mode `converge`, runtime target `agent_ops_dashboard` (the wave gate also checks `agent_verification` and `agent_space`).
* **Plan:** `docs/plans/build-5/59_agent_converge_regression.md`.
* **Status:** **pass**. Attempt 1 was stable. No code changes were needed.

## What was done (attempt 1)

1. Branch check: Git folder on `mg-genie-build-5` (HEAD `16673bf`), tree clean.
2. From `ground-truth-agent`: `bundle validate --strict --target dev` passed. `bundle deploy --target dev`: 0 created, 0 changed, 5 unchanged (nothing in the agent bundle changed since build 4).
3. Because the deploy changed nothing, the published revision was still from 2026-10-26 20:29 UTC. I republished the operations dashboard (`01f1d17bf9531f5ba79f838a0da0df35`) on warehouse `0ea84986a23a47c3` with `embed_credentials: false` (the bundle's settings). New published revision: **2026-10-28T16:20:29.877Z**.
4. All 17 datasets: `EXPLAIN` plus execution (`SELECT * FROM (<q>) LIMIT 1000`), with the `date_range` default (last 30 days) inlined. **17/17 pass**.
5. `bundle run agent_verification --target dev` → run `562019912984705` (task run `802534982709235`): **SUCCESS, all 29 checks passed** (metric views 7/7, Genie space PASS, Genie conversation PASS, ops dashboard published 16:20:29Z, datasets 17/17).
6. Genie space `01f1ceb0506f1c5d9f2024bfc5f95943`: 9 tables resolve, no stale `column_configs`, 9/9 example SQL pass `EXPLAIN`. Both probe questions returned a query attachment with `SUCCEEDED` results (`MEASURE(Total Votes)` on `mv_review_activity`; `MEASURE(Total Assets)` by `status` on `mv_coverage_metrics`).
7. Self-soak, about 3 minutes: published revision unchanged at 16:25:48 UTC, dashboard `ACTIVE`.

## Follow-up 4 datasets (UUID strings)

Session 47's metric view change (deployed by session 57) is live. The three datasets now return string ids with no dashboard edits:

| Dataset | Id column type | Rows (30 d) | Sample |
|---|---|---|---|
| `ds_votes_skips_daily` | `campaign_id STRING` | 3 | `d6afc432-a9b7-4e29-be4b-c8420af1327a` |
| `ds_skips_by_campaign` | `campaign_id STRING` | 2 | `3b22404e-d91a-4e17-8f43-9ad2028d2238` |
| `ds_top_skipped_assets` | `asset_id STRING` | 10 | `30f6918a-19a9-4929-9597-c194816e806e` |

**`ds_top_skipped_assets` is still nondeterministic.** In the last 30 days, 1 asset has 1 skip and 13 assets have 0 skips, so 9 of the 10 slots are picked from 13 tied rows (`ORDER BY skip_count DESC` only). See the request below.

## Decisions

* **Republish without a deploy change.** The plan asks for a republish, and the gate needs a published revision newer than the deploy. Publishing the runtime target is what `bundle deploy` would do. No definition change was made.
* **No dashboard JSON edits.** `operations.lvdash.json` is a workspace dashboard object (plan step 2), so the tie-break goes to the owner as a request.

## Requests

* **`ground-truth-agent/src/dashboards/operations.lvdash.json`, dataset `ds_top_skipped_assets`:** add a tie-break: `ORDER BY skip_count DESC, asset_id LIMIT 10`. **Do not** copy the `regexp_replace(lower(hex(asset_id)), ...)` wrapper from follow-up 4 (`docs/requests/2026-10-27_build-4-follow-ups.md` §4). The metric view dimension already returns the UUID string, so applying `hex()` again would double-encode the id. Apply it with the Workspace import API (or the dashboard UI), then `bundle deploy` and `agent_verification`. Why: 13 assets tie at 0 skips.

## Files changed

None (the status file and this summary are excluded).

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` (ground-truth-agent) | pass |
| `bundle deploy --target dev` | pass (no changes) |
| Ops dashboard published after deploy | pass (16:20:29.877Z) |
| Ops dashboard datasets `EXPLAIN` + execute | pass, 17/17 |
| Follow-up 4 ids are UUID strings | pass, 3/3 datasets |
| `agent_verification` run `562019912984705` | pass, 29/29 |
| Genie space tables / column configs / example SQL | pass (9 / 0 stale / 9 of 9) |
| Genie probe questions (warn mode) | pass, 2/2 |
| Self-soak (~3 min) | pass |
