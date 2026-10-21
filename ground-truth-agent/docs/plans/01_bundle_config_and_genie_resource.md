# Session 01: Bundle config + Genie Agent resource (Wave 0)

## Scope
Configure `databricks.yml` with variables, dev/prod targets, and the `genie_spaces` resource for the Ground Truth Operations agent. Create the `.geniespace.json` definition file with data sources, instructions, and sample questions.

## Context
* **Bundle root:** `ground-truth-agent/` in the `semanticGroundTruth` monorepo.
* **databricks.yml** exists with skeleton dev/prod targets and `engine: direct` (required for genie_spaces). No variables, no resources, no include paths beyond `resources/*.yml`.
* **DAB genie_spaces schema:** Requires `warehouse_id`, `title`, `description`, and either `serialized_space` or `file_path` pointing to a `.geniespace.json`. Use `file_path` for maintainability.
* **Metric views (4 business):** `mv_review_activity`, `mv_coverage_metrics`, `mv_user_leaderboard`, `mv_feedback_pipeline` — deployed to `${var.catalog}.${var.schema_name}`. Source CDF tables: `lb_votes_history`, `lb_assets_history`, `lb_user_activity_history`, `lb_feedback_batches_history`.
* **OTel tables (2 sets):** `semantic_ground_truth_otel_{logs,metrics,spans,annotations}` and `ground_truth_app_otel_{logs,metrics,spans,annotations}` already exist.
* **Infra SQL warehouse:** Use infra bundle's warehouse. Pass as `var.warehouse_id`.
* **Infra catalog/schema:** `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth` (dev).

## Tasks
1. Update `databricks.yml`:
   a. Add variables: `catalog` (description + dev default), `schema_name` (description + dev default), `warehouse_id` (description + dev default from infra), `app_display_name` (default: `Ground Truth Operations`).
   b. Dev target: set variable defaults for `hls_fde_dev` / `dev_matthew_giglia_semantic_ground_truth` / infra warehouse ID.
   c. Prod target: set variable defaults for `hls_fde` / `semantic_ground_truth` / prod warehouse ID (placeholder).
   d. Add `resources:` block with `genie_spaces.ground_truth_ops` using `file_path: ./ground_truth_ops.geniespace.json`, `warehouse_id: ${var.warehouse_id}`, `title: ${var.app_display_name}`, `description`, and `permissions` (CAN_RUN for users).
2. Create `ground_truth_ops.geniespace.json`:
   a. Version 2 format.
   b. `data_sources.tables`: 4 entries for the metric views + 2 OTel metric view entries (operational). Each with `identifier` = fully qualified name and `column_configs` listing key columns.
   c. `config.instructions`: curated agent instructions from L200-C9 (coverage %, certification %, Wilson score, freshness, approval rate, ROI framing). Include metric view-specific guidance for MEASURE() syntax.
   d. `config.sample_questions`: 6–8 example questions from L200-C9 and L300-14.
3. Run `bundle validate --strict --target dev`.

## Acceptance Criteria
- [ ] `databricks.yml` has 4 variables with dev defaults.
- [ ] `genie_spaces.ground_truth_ops` resource references `ground_truth_ops.geniespace.json`.
- [ ] `.geniespace.json` has version 2 format with 6 data sources (4 business + 2 OTel), instructions, and sample questions.
- [ ] `bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `databricks.yml`
- `ground_truth_ops.geniespace.json`

## Dependencies
- None (first session).
