# Request to genie-build-waves (mbp): wave-level `"archived": true`

From: Semantic Ground Truth (`semanticGroundTruth/docs/plans/waves.json`, instance `-sgt-root`). Date: 2026-10-24.

## Prompt (paste into a Genie Code session in the mbp repo)

> In `genie-build-waves`, add support for a wave-level `"archived": true` flag in `waves.json`. Consumers now keep one manifest per project with every past build inline as history (example: `semanticGroundTruth/docs/plans/waves.json`, 32 waves, of which 22 are archived builds 1-3 and 10 are the active build 4). Requirements:
>
> 1. `validate_manifest` (in `src/notebooks/setup_build_waves_job.ipynb`) keeps validating archived waves (ids, duplicate session ids, runtime targets referenced by `runtime_gate`), skips the rule-7 single-writer warnings for them, and accepts an optional informational `"build"` string on a wave.
> 2. The setup job generates **no tasks** for archived waves (no gate, session, integrator or placeholder tasks). The first non-archived wave has no upstream dependency on archived waves.
> 3. Session `depends_on` entries that point at sessions in archived waves count as already satisfied (no task dependency, no status-file check).
> 4. The runner / integrator skills and the gate notebook never expect `.build-status` files for archived sessions.
> 5. Setup prints `Manifest OK: N waves (A archived, R runnable), S sessions, T runtime targets`.
> 6. Document the flag and the `<build>-<n>` wave id convention (task prefix `w<build>-<n>`) in the README; add a unit test with one archived and one runnable wave.
>
> Backwards compatible: manifests without `archived` behave exactly as today.

## Why

* One manifest per project is easier to audit than a folder of frozen manifests, and session ids stay globally unique across builds.
* Today the setup job generates tasks for every archived wave. The workaround is `run-now` with `only` = the active build's task keys, which is easy to get wrong.

## Current workaround (until the flag lands)

* `waves.json` marks builds 1-3 `"archived": true`. The current validator ignores the flag and passes the manifest (0 errors; 1 existing warning: `agent_space` has no id).
* Run setup job `818046072228128`, then start build job `1079028753739581` with `only` = the `w4-*` task keys.
* Frozen copies of the original manifests are in `docs/plans/manifests/`.
