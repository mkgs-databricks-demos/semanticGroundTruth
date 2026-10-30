# AppKit upgrade plan: Dependabot follow-ups 6 and 8 (2026-10-30)

**Covers:** [follow-up 6](2026-10-29_dependabot-follow-ups.md) (`instrumentation-pg` GHSA-qqmp, GitHub alert #23, the only open alert on `main`) and follow-up 8 (retire the security overrides in `ground-truth-app/pnpm-workspace.yaml`).

**Status:** waiting on upstream. On 2026-10-30 the npm registry has `@databricks/appkit` and `@databricks/appkit-ui` **0.89.0** as `latest` (published 2026-10-19), and `@mlflow/core` **0.4.0**. No newer release exists, so nothing in this plan can be applied yet except the optional trial in §3 option B.

## 1. What blocks what

**Follow-up 6 (`instrumentation-pg`).** The fix chain, from the registry:

| Package | AppKit 0.89.0 has | First fixed | That version needs |
| --- | --- | --- | --- |
| `@opentelemetry/instrumentation-pg` | 0.71.0 | 0.73.0 (2026-07-23) | `@opentelemetry/core` ^2.9.0, `@opentelemetry/instrumentation` ^0.221.0 |
| `@opentelemetry/auto-instrumentations-node` | 0.77.0 (exact pin) | 0.79.0 (carries pg ^0.73.0) | `sdk-node` ^0.221.0, `instrumentation` ^0.221.0 |

AppKit 0.89.0 pins the OTel SDK exactly (`resources`, `sdk-trace-*`, `sdk-metrics` 2.8.0; `instrumentation`, `sdk-logs`, exporters 0.219.0), and our `@opentelemetry/core: 2.8.0` override keeps one `core` copy (the lockfile has only `core@2.8.0`). So the fix needs the OTel SDK to move from 2.8 / 0.219 to at least 2.9 / 0.221, and that is AppKit's call.

**Heads-up: OTel 3.0.** `@opentelemetry/core` 3.0.0, `sdk-node` / `instrumentation` 0.300.0 and `auto-instrumentations-node` 0.82.0 all shipped on 2026-10-20 (`instrumentation-pg` 0.77.0 needs core ^3 and Node >= 22.15). The next AppKit may jump straight to 3.x. If it does, also check:

* the `@opentelemetry/api` peer range (2.x accepts `>=1.3.0 <1.10.0`; auto-instrumentations 0.82 wants ^1.10);
* `@mlflow/core` compatibility (it brings `sdk-node` 0.205.0 and is pinned as an AppKit peer);
* the app's own OTel code (`server/lib/tracing/**`, `server/lib/otelEnvCheck.ts`);
* the Node engine: the app pins 22.16.0, and 3.x needs >= 22.15, so it is fine.

**Follow-up 8 (the overrides).** Each one stays until upstream resolves to the patched version without it:

| Override | Pinned upstream by (0.89.0) | Upstream today | Remove when |
| --- | --- | --- | --- |
| `dompurify: 3.4.17` | `appkit-ui` `dompurify` 3.4.11 (exact) | latest 3.4.17 | `appkit-ui` depends on >= 3.4.17 |
| `echarts: 6.1.0` | `appkit-ui` `echarts` 6.0.0 (exact) | latest 6.1.0 | `appkit-ui` depends on >= 6.1.0 |
| `'js-yaml@4.3.1': 4.3.2` | `appkit` and `appkit-ui` `js-yaml` 4.3.1 (exact) | latest 5.5.0 | both depend on >= 4.3.2 |
| `yaml: 2.8.3` | `appkit` and `appkit-ui` `yaml` 2.8.2 (exact); also `@opentelemetry/configuration` 0.219.0 and `rolldown-vite` | latest 2.9.1 | both depend on >= 2.8.3, and no other consumer resolves lower |
| `zod: 4.6.7` | `appkit` and `appkit-ui` `zod` 4.3.6 (exact) | latest 4.6.7 | both depend on >= 4.6.7. **Keep `zodEnglishOnlyLocales`** in `server/mcp/views/app/build.ts` either way: the locale bundling is zod's ([colinhacks/zod#6050](https://github.com/colinhacks/zod/issues/6050)), not AppKit's |
| `qs: 6.16.1` | `express` 4.22.2 and 5.3.0, `body-parser` 1.20.9 and 2.4.0 (lockfile) | latest 6.17.1 | every resolved `qs` is >= 6.16.1 without it |
| `fast-uri: 3.1.9` | `ajv` 8.20.0 (lockfile) | latest 4.2.3 (major; consumers want ^3) | every resolved `fast-uri` is >= 3.1.9 without it |
| `systeminformation: 5.33.18` | `@opentelemetry/instrumentation-host-metrics` 0.2.0 (lockfile) | latest 5.33.19 | every resolved copy is >= 5.33.18 without it |

The other overrides (`vite: npm:rolldown-vite@7.1.14`, `@opentelemetry/core: 2.8.0`, `socks`, `bare-path`, `bare-url`) are not security overrides and are out of scope. The upgrade must still re-check `@opentelemetry/core`, because it has to match the SDK version that the new AppKit pins (§2 step 5).

## 2. Procedure when AppKit ships a release

This follows [`../runbooks/node_toolchain_genie_code.md`](../runbooks/node_toolchain_genie_code.md) (Node 22.16.0, pnpm 11.0.8; overrides live only in `pnpm-workspace.yaml`; start every candidate from `main`'s lockfile; use a new `--store-dir` for each fresh `/tmp` copy).

1. **Read the release.** Check the registry for `appkit` and `appkit-ui` `<ver>`: the exact deps for every row in §1, `auto-instrumentations-node`, the OTel SDK versions, and the peers (`@mlflow/core`, `vitest`, `react`). Read the changelog for breaking changes and note anything new in `bundledDependencies`.
2. **Branch** `mg-genie-appkit-<ver>` from `main`.
3. **Bump in a `/tmp` rsync copy.** Set `appkit` and `appkit-ui` to the exact `<ver>` together, plus `@mlflow/core` if the peer moved. Regenerate the lockfile, starting from `main`'s.
4. **Retire the overrides one at a time.** For each §1 row, remove it from `pnpm-workspace.yaml` (and its inert `package.json` copy), reinstall, then run `pnpm why <pkg>`. If every resolved copy is at or above the patched version, leave it removed; otherwise put it back. Keep a short table of the results for the PR.
5. **Re-check `@opentelemetry/core`.** Set it to whatever the new AppKit SDK pins (for example 2.9.x or 3.0.x), or drop it if there is only one copy without it. Confirm one `core` copy, and that `instrumentation-pg` is >= 0.73.0 (`pnpm why @opentelemetry/instrumentation-pg`).
6. **zod.** If the override is removed, confirm there is still a single zod copy. On any zod version change, regenerate the card (`pnpm exec tsx server/mcp/views/app/build.ts`) and `shared/contracts/generated/contracts.schema.json`.
7. **Checks** on an exact rsync:
   * frozen install passes, and lockfile-only reproduces an identical lockfile;
   * AppKit's bundled `@databricks/sdk-*` are present;
   * both `tsc -b` give 0 errors;
   * `vitest run` matches today's baseline: 62 files, 1891 pass / 2 skipped;
   * `pnpm run build` passes, and the generated files are unchanged or the diff is explained;
   * `check:bundle`: card < 100 KB gzip (today 75,467 B), and the entry chunk is reported (today 242.90 kB);
   * `pnpm audit` has no `instrumentation-pg` row and no new rows.
8. **Deploy to dev** with `bundle run app --target dev` from the Git folder, then check:
   * probes 12/12 (`docs/plans/build-5/waves.json`);
   * `deploy_verification` job `359858966042356`;
   * `api_contract_tests` job `443124502254957`;
   * a 15-minute soak in the OTel tables: 0 error lines and 0 error spans, with pg spans still present;
   * the `otel_env` startup line;
   * the live card is byte-identical to the committed card;
   * a Genie One card check.
9. **PR and merge.** After the merge, confirm GitHub shows 0 open alerts on `main` (or explain any that remain), and update follow-ups 6 and 8.

## 3. Follow-up 6 options until AppKit moves

| Option | What | Effort / risk | Decision |
| --- | --- | --- | --- |
| **A. Wait (recommended)** | Apply §2 when AppKit carries `auto-instrumentations-node` >= 0.79.0 | None now | default |
| **B. Override trial** | In `/tmp` only, try `@opentelemetry/auto-instrumentations-node: 0.79.0` (or `instrumentation-pg: 0.73.0`) with `@opentelemetry/core` raised to 2.9.x. Run all of §2 step 7, then a dev deploy to prove AppKit's 2.8.0 / 0.219.0 SDK still starts and exports spans. | Medium. It mixes SDK 2.8 with core 2.9 and two `instrumentation` copies (0.219 and 0.221), which AppKit has not tested. | owner, optional |
| **C. Strip `db.user`** | Drop the `db.user` attribute from pg spans (span processor or instrumentation config), if AppKit exposes a hook | Unverified: AppKit owns the OTel setup. Needs a code read first. | owner, optional |
| **D. Accept the risk** | Dismiss #23 as "Risk is tolerable to this project". The exposed value is the app service principal's Lakebase role name, and it lands only in the project's own UC OTel tables (`hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic_ground_truth_otel_spans`), which are behind schema ACLs. | None | owner |

## 4. Done when

* **Follow-up 6:** `pnpm audit` has no `instrumentation-pg` row and GitHub #23 is closed (fixed, or dismissed under option D).
* **Follow-up 8:** `pnpm-workspace.yaml` lists only overrides that are still needed, each with a one-line reason.

## 5. Evidence (registry, 2026-10-30)

* `@databricks/appkit` / `appkit-ui`: `latest` 0.89.0 (2026-10-19), no newer version.
* `@opentelemetry/instrumentation-pg`:
  * 0.71.0 needs instrumentation ^0.219.
  * 0.73.0, 0.74.0, 0.75.0 and 0.76.0 need core ^2.9.0 and instrumentation ^0.221 to ^0.223.
  * 0.77.0 needs core ^3.0.0, instrumentation ^0.300.0 and Node >= 22.15.0.
* `auto-instrumentations-node`:
  * 0.77.0 carries pg ^0.71.0, 0.78.0 ^0.72.0, 0.79.0 ^0.73.0, 0.80.0 ^0.74.0;
  * 0.81.x carries ^0.75.0 / ^0.76.0, and 0.82.0 ^0.77.0, which brings the core ^3 peer.
* Latest versions: `dompurify` 3.4.17, `echarts` 6.1.0, `js-yaml` 5.5.0, `yaml` 2.9.1, `qs` 6.17.1, `fast-uri` 4.2.3, `systeminformation` 5.33.19, `zod` 4.6.7, `@mlflow/core` 0.4.0.
