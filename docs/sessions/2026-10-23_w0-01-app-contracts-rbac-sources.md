# Session 01 — App shared contracts: RBAC groups, sources, import

**Wave:** 0 · **Mode:** edit · **Run:** 713417549836954 · **Date:** 2026-10-23
**Status:** pass (already completed)

## Summary

All deliverables for this session were already present in the codebase, completed by the prior app build (branch `mg-genie-app-build-waves`, merged to `main` via PR #4 as commit `6af87be`, then carried forward to `mg-genie-agent-build`). This session re-validated the existing work against the root build plan's requirements.

## Files verified (no changes needed)

| File | Findings |
|---|---|
| `ground-truth-app/shared/contracts/values.ts` | `APP_GROUP_NAMES` with exactly 3 names, `APP_GROUP_ROLE` mapping, `SOURCE_TYPES`, `DEFAULT_METRIC_VIEW_GLOB`, `DEFAULT_GLOSSARY_GLOB` — all present and correct |
| `ground-truth-app/shared/contracts/entities.ts` | `AppGroup`, `AppGroupMember`, `AssetSource` interfaces present; `Asset` has `sourceId` and `sourceMetadata` fields |
| `ground-truth-app/shared/contracts/api.ts` | All §4 route types present: catalog browse (catalogs, schemas, metric-views), sources (register, scan), import, admin groups (list, add member, remove member). FQN regex and glob traversal rejection in place |
| `ground-truth-app/shared/contracts/errors.ts` | `CONFLICT` and `SOURCE_ACCESS_DENIED` both present |
| `ground-truth-app/shared/contracts/index.ts` | Barrel re-exports all 6 modules (values, errors, entities, review, api, mcp) |

## Checks

| Check | Result | Detail |
|---|---|---|
| No `enum` / `namespace` under `shared/` | pass | grep found zero matches |
| Every §4 route has request/response types | pass | All 11 routes verified programmatically |
| APP_GROUP_NAMES exact membership | pass | admins, stewards, users — all three present |
| index.ts re-exports all modules | pass | 6/6 modules |
| `pnpm exec tsc -p tsconfig.shared.json --noEmit` | skipped | No Node toolchain in serverless |
| `bundle validate --strict` | skipped | No YAML files touched |

## Decisions

None — all decisions were made in the prior build and remain valid.

## Requests

None.
