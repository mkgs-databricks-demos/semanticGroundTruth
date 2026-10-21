# Session 16: App README and First-Deploy Runbook

**Wave:** 5 · **Run:** 425081720670565 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Rewrote the scaffold `README.md` into a comprehensive app README for the built Semantic Ground Truth App. Created `docs/runbooks/first-deploy-verification.md` with a 12-step numbered checklist for the interactive controller session to follow after the build completes. Documentation only — no code files changed.

## Files Modified

| File | Changes |
|---|---|
| `README.md` | Full rewrite: replaced AppKit scaffold boilerplate with app-specific overview, architecture mermaid diagram, directory map (from conventions §6), full REST route table (30 routes from plan 09), MCP tool list (12 tools across 3 domains), roles and how to grant them, environment variables (platform-injected and application), bundle variables/targets table, prerequisites (including infra dependency), local dev instructions, deploy instructions (with link to runbook), code quality commands, tech stack table, observability/OTel tables, and design document pointers. |

## Files Created

| File | Purpose |
|---|---|
| `docs/runbooks/first-deploy-verification.md` | 12-step numbered runbook: (1) lockfile regeneration, (2) typecheck/test, (3) deploy + fix-forward loop, (4) migration verification, (5) health check via authenticated notebook request, (6) seed sample assets + confirm review card, (7) vote round-trip from UI + Lakebase verification, (8) MCP tools/list and tool call via Unity Gateway, (9) OBO metric view access from UI vs MCP, (10) agent verification on /assistant, (11) OTel telemetry verification, (12) follow-ups list (8 items). Each step includes exact commands/code snippets and an expected result. |

## Decisions

* **Runbook step 5 (health check):** Uses `WorkspaceClient().config.authenticate()` pattern per platform facts — plain curl/Bearer fails due to the Apps auth sidecar. This is the canonical pattern for authenticated app requests from notebooks.
* **Runbook step 8 (MCP):** Uses the Unity Gateway `serving_endpoints.query()` pattern for MCP tool invocation rather than raw HTTP to the app's `/mcp` endpoint, since the MCP service is registered in Unity Gateway.
* **Follow-ups section:** Consolidated 8 known issues from INDEX.md, build_conventions.md, and session summaries (11-14) into a single actionable list.
* **Preserved bundle info:** README includes targets table and bundle variables summary carried forward from PROJECT_MEMORY.md.

## Checks

| Check | Result | Detail |
|---|---|---|
| `databricks bundle validate --strict --target dev` | **pass** | "Validation OK!" |
| README.md links to runbook | **pass** | Line 193: `[First Deploy Verification Runbook](docs/runbooks/first-deploy-verification.md)` |
| Runbook has 12 numbered steps | **pass** | grep confirmed 12 `## N.` headings |
| Each step has an expected result | **pass** | grep confirmed 12 "Expected result:" occurrences |
| No code files changed | **pass** | Only README.md and docs/runbooks/first-deploy-verification.md |
| All files within owned_paths | **pass** | README.md ✓, docs/runbooks/** ✓ |
| TypeScript compilation | **skipped** | No Node toolchain in session |

## Assumptions

* The MCP service fully-qualified name is `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp` (from PROJECT_MEMORY.md). If the dev target uses different catalog/schema, the runbook MCP commands need updating.
* `w.serving_endpoints.query()` is the correct SDK method for Unity Gateway MCP calls. The exact API shape may differ by SDK version.
* OTel table names use underscores (e.g., `semantic_ground_truth_otel_logs`) per the `telemetry_export_destinations` naming in `databricks.yml`.

## Requests

None.
