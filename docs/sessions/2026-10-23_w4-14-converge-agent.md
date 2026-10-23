# Session 14 (wave 4, converge): Genie agent + verification

* Run: `713417549836954` (job `1079028753739581`, task `w4_session`), branch `mg-genie-agent-build`
* Runtime targets: `agent_space`, `agent_verification`
* Result: **pass**. Space deployed, 9/9 example SQLs pass EXPLAIN, verification job 11/11 checks, 2/2 probe questions return SQL.

## Problems, root causes, fixes

1. **Geniespace JSON `instructions` inside `config`**. The Genie space API (version 2 serialized_space) expects `instructions` as a top-level key, not nested inside `config`. Fix: moved `instructions` (text_instructions + example_question_sqls) to the top level.

2. **`question` and `sql` fields were bare strings**. The API expects arrays for both `question` and `sql` in `example_question_sqls`, and `content` in `text_instructions`. Fix: wrapped all three field types in arrays.

3. **`data_sources.tables` not sorted by identifier**. The API requires tables sorted alphabetically. Fix: separated metric views into `data_sources.metric_views` and sorted both sections alphabetically.

4. **Verification notebook measure discovery**. `_find_first_measure()` searched for a top-level `measures` array, but metric view measures appear as columns with `is_measure: true`. Fix: iterate `spec.columns` and check `col.is_measure`.

5. **Verification notebook space title matching**. Dev mode adds `[dev matthew_giglia]` prefix to the space title, but the notebook used exact match. Fix: changed to `endswith(space_title)` matching.

6. **Verification notebook Genie API field names**. The raw `GET /api/2.0/genie/spaces` response uses `space_id` (not `id`), and `GenieAttachment` uses `attachment_id` (not `id`). Fix: updated both field accesses.

## Attempts

| n | target | result | errors | fix | files_changed |
| --- | --- | --- | --- | --- | --- |
| 1 | agent_space | deploy_failed | Unknown field 'instructions'; Expected array for question/sql; tables not sorted | Restructured geniespace.json: instructions to top level, arrays for question/sql/content, sorted tables + metric_views | ground_truth_ops.geniespace.json |
| 2 | agent_verification | unhealthy | 9/11 failed: measure discovery, title mismatch, space_id KeyError | Fixed notebook: columns.is_measure, endswith title, space_id fallback | agent_verification.ipynb |
| 3 | agent_verification | unhealthy | 1/11 failed: attachment_id attribute | Fixed notebook: att.attachment_id | agent_verification.ipynb |
| 4 | agent_verification | stable | All 11 checks passed | n/a | n/a |

## Verification (final state)

| Check | Result |
| --- | --- |
| `bundle validate --strict --target dev` | pass |
| Space title = `[dev matthew_giglia] Ground Truth Operations` | pass |
| Space warehouse = `0ea84986a23a47c3` | pass |
| Space update_time (`2026-10-23T07:11:35.931Z`) in this run | pass |
| All 9 data sources resolve (7 MVs + 2 OTel tables) | pass |
| 9/9 example SQLs pass EXPLAIN | pass |
| Verification job run `629986461742729` | SUCCESS (11/11) |
| Probe: "How many votes were cast in total?" | SQL returned (warn mode) |
| Probe: "How many assets are in each status?" | SQL returned (warn mode) |

## Files modified (relative to semanticGroundTruth)

* `ground-truth-agent/ground_truth_ops.geniespace.json` — restructured for v2 API: instructions at top level, all string fields wrapped in arrays, tables sorted, metric views in dedicated section
* `ground-truth-agent/src/notebooks/agent_verification.ipynb` — fixed measure discovery (columns.is_measure), title matching (endswith), space_id and attachment_id field names

## Decisions

* Separated metric views into `data_sources.metric_views` rather than keeping them under `tables`. The API merges them back into `tables` on read, but the separation makes the source JSON clearer.
* Used `endswith` for space title matching rather than exact match, so the verification works in both dev mode (with prefix) and prod mode (without prefix).
* Kept probe questions in warn mode per the manifest — both probes return SQL queries successfully.

## Requests

None.
