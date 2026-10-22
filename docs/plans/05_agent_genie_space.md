# 05 — Agent bundle: config + Genie space resource

**Wave 0 · edit · owns `ground-truth-agent/databricks.yml`, `ground-truth-agent/ground_truth_ops.geniespace.json`, `ground-truth-agent/resources/ground_truth_ops.genie_space.yml`**

## Context
* Supersedes `ground-truth-agent/docs/plans/01_bundle_config_and_genie_resource.md` (read it for the original intent). Differences: data sources are the 7 metric views from plan 04 plus `semantic_ground_truth_otel_logs` / `_spans`; no `lb_*_history` tables.
* Design: `docs/design/L200-C9_operational_genie_agent.md`, `docs/design/L300-14_genie_agent_creation.md`.
* Verify the bundle `genie_spaces` resource schema with `databricks bundle schema` before writing YAML (fields for warehouse, title, description, file/serialized space, permissions).

## Steps
1. `databricks.yml`: variables `catalog`, `schema_name`, `warehouse_id`, `space_title` with dev defaults `hls_fde_dev`, `dev_matthew_giglia_semantic_ground_truth`, `0ea84986a23a47c3`, `Ground Truth Operations`; prod placeholders; dev `root_path` like the other bundles.
2. `resources/ground_truth_ops.genie_space.yml`: key `ground_truth_ops`, title `${var.space_title}`, warehouse `${var.warehouse_id}`, file path to the geniespace JSON, `CAN_RUN` for `users`.
3. `ground_truth_ops.geniespace.json`: tables = the 7 metric views + 2 OTel tables (fully qualified via the dev catalog/schema); text instructions (what each view answers, Wilson confidence meaning, statuses PENDING/REVIEWED/CERTIFIED); 6–8 sample questions; example SQL only against metric views using `MEASURE()` and real field names from plan 04 fixtures; no `column_configs` for columns that do not exist.
4. Resolve the deployed title: run `bundle validate --output json --target dev` and record whether dev mode prefixes the title. The root manifest expects the deployed title `[dev matthew_giglia] Ground Truth Operations`; if dev mode does not prefix, set the dev `space_title` to that exact string.

## Done when
* `bundle validate --strict --target dev` passes in `ground-truth-agent`.
* Every table in the geniespace JSON is one of the 9 allowed objects; every example SQL references only fields defined in plan 04 fixtures.
