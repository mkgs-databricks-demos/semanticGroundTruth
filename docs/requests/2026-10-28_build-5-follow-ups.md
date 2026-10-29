# Build 5 follow-ups

**Source:** build 5 (job `884230801831394`, run `229891579528310`, waves 5-0..5-10), session status files under `.build-status/229891579528310/` (42-62), the [build 5 summary](../sessions/2026-10-28_build-5-summary.md) and the items left open in [`2026-10-27_build-4-follow-ups.md`](2026-10-27_build-4-follow-ups.md).

**Closed:** none yet.

Priority: **P1** = fix before the next build, **P2** = next build, **P3** = when convenient.

| # | P | Bundle | Item |
|---|---|--------|------|
| 1 | P2 | infra / owner | G11: no dev quality monitor, because the metastore is at its 1000-monitor limit (D-B5-4) |
| 2 | P2 | infra | G11: the first prod monitor refresh is unproven |
| 3 | P2 | app / owner | Unattended `bundle deploy` still fails at `apps update` (build-4 follow-up 10); state `source_code_path` is stale |
| 4 | P1 | build tooling | Waves: a blocked session's successful `for_each` iteration cannot be repaired (build-4 follow-up 3, not addressed) |
| 5 | P2 | app | Confirm an MLflow agent chat trace with `gt.*` attributes on AppKit 0.89.0 |
| 6 | P3 | infra | First real (non-dry) `collect_feedback` run records vote `3e792f67...` as `no_proposed_value` |
| 7 | P3 | agent | Ops dashboard `ds_top_skipped_assets`: deterministic tie-break |
| 8 | P2 | app | Settings: apply motion / density at the root; unsaved-changes navigation guard |
| 9 | P3 | app | Expose `skip_cooldown_hours` in `GET /api/config` |
| 10 | P3 | app | Test harness and hook polish (`resetOnline`, optional `enabled`) |
| 11 | P3 | app | Notify-once live invariant is `skipped_live` in dev |
| 12 | P3 | app (upstream) | AppKit AGENT span records full chat messages as inputs |
| 13 | P1 | root / owner | Manual checks (wave 5-11, prerequisite `M5`) |
| 14 | P3 | infra | `post_deploy_setup` leftover: optional `app_sp_client_id` cleanup (build-4 follow-up 8) |

## 1. G11: no dev quality monitor (P2, infra / owner)

* **Evidence:** creating the monitor on `bronze_lakebase_cdf` in dev returns `429 RESOURCE_EXHAUSTED: Cannot create Monitor because it exceeds the number of limit 1000`; the CLI retries, so `bundle deploy --target dev` hangs (session 57). The project owns no monitor on the shared `fevm-hls-fde` metastore, so none can be freed by the project. Owner decision D-B5-4 (`9ec1219`): the monitor is under `targets.prod` only.
* **Change:** a metastore admin frees capacity or raises the limit; then follow `docs/runbooks/cdf_bronze_operations.md` §6 "Re-enable in dev".
* **Done when:** `./deploy.sh --target dev --infra` completes with the monitor and a refresh writes the two metric tables in dev.

## 2. G11: first prod monitor refresh unproven (P2, infra)

* **Evidence:** session 58 proved `bundle validate --strict --target prod` passes and `bundle summary --target prod` lists the monitor. Prod has not been deployed in build 5, so no monitor exists and no refresh has run.
* **Done when:** after the first prod infra deploy, a refresh (manual or the 06:00 UTC schedule) writes `bronze_lakebase_cdf_profile_metrics` and `bronze_lakebase_cdf_drift_metrics` in the prod schema.

## 3. Unattended app `bundle deploy` (P2, app / owner; build-4 follow-up 10)

* **Evidence:** sessions 60, 61 and 62: `bundle deploy --target dev` fails only at `POST /api/2.0/apps/.../update` with `Invalid delegation claim present in Ctx`. Session 60's one investigation: `GET apps` redacts `config.env` values and the bundle state `source_code_path` is stale (`semanticGroundTruth-deploy`), so an update is always planned; Genie Code credentials cannot call `apps/update`. Fallback `bundle run app --target dev` works.
* **Change:** owner runs `bundle deploy --target dev` of `ground-truth-app` once from a terminal to refresh the state; then check whether a build task still plans an update.
* **Done when:** a `bundle deploy` from a Genie Code task plans no `apps update` (or the platform accepts it).

## 4. Build waves: repairing a blocked session (P1, build tooling: `mbp/genie-build-waves`)

* **Evidence:** unchanged from build-4 follow-up 3. In build 5 every blocked session (42, 50, 52, 56, 57, 58, 60) was recovered by the owner finishing the step, editing `<id>.json` and repairing from `w<w>_integrate`. Sessions 44, 54 and 55 also hit the Genie Code step limit (gate warnings), and `build_verdict.json` stays at the first failure until a later verdict runs.
* **Change (upstream):** the runner fails its iteration when its final status is `blocked`/`fail`, or the README documents the recovery; consider refreshing `build_verdict.json` after a repaired gate passes.

## 5. MLflow agent trace on AppKit 0.89.0 (P2, app; session 45 request)

* **Evidence:** session 45 asked the deploy session to confirm the logs `MLflow agent tracing enabled (experiment 1698842789305538)` and `MLflow trace enrichment on`, plus an agent chat trace with `gt.*` attributes. Session 60 attempt 3 (AppKit 0.89.0) is stable with no `Cannot find module` line, but its summary does not record an agent chat trace in the experiment.
* **Done when:** one Assistant chat on the deployed app produces an MLflow trace with `gt.*` attributes in experiment `1698842789305538`.

## 6. First real `collect_feedback` run for no-value edit votes (P3, infra)

* **Evidence:** the app now rejects edit votes with no proposed value (session 44), and `collect_feedback` records old ones processed with reason `no_proposed_value` (session 46). Only a `dry_run=true` run (`987733913612827`, session 57) has shown it; session 46's request for an app "mark processed" route is superseded.
* **Done when:** a scheduled or manual `feedback_pipeline` run marks `3e792f67-71f2-4c3b-81ec-85e3f84452a5` processed and steward "unprocessed" counts drop by one.

## 7. Ops dashboard tie-break (P3, agent; sessions 47 and 59)

* **Change:** in `ground-truth-agent/src/dashboards/operations.lvdash.json`, `ds_top_skipped_assets` ends `ORDER BY skip_count DESC, asset_id LIMIT 10`. Do **not** add the `hex()` wrapper from build-4 follow-up 4: the metric view already returns UUID strings (session 47), and it would double-encode. The file is a workspace dashboard object (edit in the dashboard editor or approve an import), then `bundle deploy` the agent and run `agent_verification`.

## 8. Settings: motion, density, unsaved-changes guard (P2, app; session 52)

* Apply `settings.motion` to `MotionConfig` (`reduce` -> `'always'`, `system`/`full` -> `'user'`) and `settings.density` as a root class in `client/src/main.tsx` or `App.tsx`.
* Add an in-app navigation guard (`useBlocker`) for `/settings` when the form is dirty.

## 9. `skip_cooldown_hours` in `GET /api/config` (P3, app; session 51, optional)

* Expose the server setting so the S1 skip toast / picker copy follows it (contract change).

## 10. Test harness and hook polish (P3, app; sessions 49, 54)

* `client/src/test/online.ts`: `resetOnline()` dispatches an `online` event when it restores `navigator.onLine` (React Query's `onlineManager` otherwise stays offline for later tests in the file).
* `client/src/lib/api/hooks.ts`: optional `enabled` for `useCatalogs` / `useSources`.

## 11. Notify-once live invariant (P3, app; session 61, optional)

* The live `api_contract_tests` invariant is `skipped_live` because dev has no `proposed` or `failed` feedback batch. It becomes a real pass once one exists.

## 12. AppKit AGENT span inputs (P3, upstream; session 45, optional)

* AppKit's AGENT span records the full chat messages as inputs. Raise with AppKit if trace payload size or content is a concern.

## 13. Manual checks (P1, root / owner; D-B5-2)

* Fill [`../sessions/build-5_manual_checks.md`](../sessions/build-5_manual_checks.md) (Lighthouse, screen reader K1/K2, keyboard, forced colors, Figma side-by-side, 390 px touch, MCP App card in Genie One / Genie Code, Share to Slack **Send** once). Reconnect `system.ai.slack` first. Then start a new build run with `only` = `w5-11_*`. Session 64 fixes small client issues or adds them here.

## 14. `post_deploy_setup` leftover (P3, infra; build-4 follow-up 8)

* `app_sp_client_id` cleanup was deferred by plan in session 46 (the `setup_cdf_config` widget fix and the `bundle_target` parameter are done).
