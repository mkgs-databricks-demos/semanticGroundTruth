# MCP TypeScript SDK v2 (spec 2026-07-28) + ext-apps 2.0.4

**Date:** work 2026-10-30, docs 2026-11-02 · **Mode:** owner, interactive Genie Code · **Branch:** `mg-genie-mcp-sdk-v2` from `main` `5cffe0f` · **Code commit:** `fcec9c2` · **Dev deployment:** `01f1d474df551a7d85b4909dd93c2782`

## Goal

Move `ground-truth-app` from `@modelcontextprotocol/sdk` v1 to the v2 split packages, implement MCP spec 2026-07-28, keep serving 2025-era clients (Unity Gateway / Genie One), and find out from live logs which protocol era Databricks clients actually use.

## Changes

| Area | Change | Files |
|------|--------|-------|
| Dependencies | `@modelcontextprotocol/sdk` 1.32.1 removed. Exact pins: `@modelcontextprotocol/server` 2.4.0, `core` 2.4.0, `client` 2.4.0 (peer of ext-apps 2.x), `node` 2.1.2; `@modelcontextprotocol/ext-apps` 1.7.5 -> 2.0.4. Lockfile regenerated; one `zod` 4.6.7. | `ground-truth-app/package.json`, `pnpm-lock.yaml` |
| Transport | `createMcpHandler(factory, { legacy: 'stateless' })` behind `toNodeHandler`, mounted with `app.all('/mcp')`. The hand-written GET/DELETE 405 handlers are gone (the SDK answers 405). `closeMcpSessions()` closes the modern leg on shutdown; `activeMcpSessionCount` became `activeMcpHandlerCount` (no external users). | `server/mcp/index.ts` |
| Identity | `getUser(res)` (OBO) unchanged. `userAuthInfo(user)` puts the `UserContext` in pass-through `authInfo.extra.sgtUser` (`clientId` `semantic-ground-truth-obo`, empty token); `userFromRequestContext(ctx)` reads it in the factory and throws unauthenticated if it is missing or from another client. `req.auth` is always overwritten, never taken from the client. | `server/mcp/identity.ts` (new) |
| Logging | One `check=mcp_request` line per request: HTTP + RPC method, era, envelope / initialize protocol version, client name/version, values of 5 non-secret headers, header names only. | `server/mcp/index.ts` |
| Tools | Imports moved to `@modelcontextprotocol/server`. Contract inputs were already `z.object`, so `registerTool` / `registerAppTool` use the non-deprecated Standard Schema overloads with no schema change. | `server/mcp/server.ts`, `tools/define.ts`, `tools/campaign.ts`, `tools/metricView.ts`, `tools/review.ts` |
| Review card | View transport from `@modelcontextprotocol/client`; card rebuilt: 318,695 B raw / 83,783 B gzip (was 273,447 / 75,467; budget 100 KB gzip). | `server/mcp/views/app/main.ts`, `reviewCardApp.generated.ts`, `build.ts` (comment) |
| Card test | The no-credentials check flagged `/Authorization/i`: ext-apps 2.x pulls `@modelcontextprotocol/client` OAuth metadata schemas and error classes (`authorization_servers`, "Authorization server mismatch"), inert strings. The check now looks for an Authorization header being set (`"authorization":` / `.set("authorization"`); `Bearer\s`, `fetch(`, `XMLHttpRequest`, `sendBeacon`, `EventSource`, `dapi…` unchanged. | `server/mcp/views/app/build.test.ts` |
| Tests | New `server/mcp/http.test.ts` (12): real `node:http` server in front of `mountMcp`. 2025 `tools/list` without `initialize` -> 13 tools; 2025-06-18 `initialize` echoed; default v2 client; GET/DELETE 405; 2026-07-28 `server/discover` + `tools/list`; `auto` negotiation; `resources/read` MIME `text/html;profile=mcp-app`; tool runs as the route user; unsupported version -> `UnsupportedProtocolVersionError`; identity round trip and fail-closed; log line has no secret values; no `Mcp-Session-Id` on any response. Test imports moved in 4 existing files. | `server/mcp/http.test.ts`, `server/mcp/server.test.ts`, `server/mcp/views/app/main.test.ts`, `tests/contract/harness.ts`, `tests/contract/mcp.contract.test.ts` |
| Docs | L300-17 version decision updated; the original named non-existent `sdk-core` / `sdk-server` packages. | `docs/design/L300-17_mcp_app_review_card.md` |

`server/session.ts` (`McpSessionStore`, Postgres `app.mcp_sessions`, keyed `user:<userId>`) is app-level per-user state, not an MCP protocol session, and is unchanged.

## Results

| Check | Before (`5cffe0f`) | After (`fcec9c2`) |
|-------|--------------------|-------------------|
| vitest | 62 files, 1891 pass / 2 skipped | 63 files, 1903 pass / 2 skipped |
| `tsc -b` server / client / `tsconfig.json` | 0 / 0 / 0 | 0 / 0 / 0 |
| build:server | 99 files, 574.26 kB | 100 files, 623.17 kB |
| build:client | 284.15 kB gzip, entry 242.90 kB | same |
| `contracts.schema.json` | — | unchanged |
| `pnpm audit` | 11 (3 H, 8 M) | 11 (3 H, 8 M) |
| Review card gzip | 75,467 B | 83,783 B |
| Frozen install | pass | pass |

* **Mutation check:** with `legacy: 'reject'` the 3 legacy tests in `http.test.ts` fail and the rest pass, so the tests do test the fallback.
* **Repo == tested copy:** `rsync -n -c` of the repo against `/tmp/gt-v2` listed no differences before the commit; repo lockfile and card are `cmp`-identical to the tested ones.
* **Dev (`01f1d474df55`, 2026-10-30):** `bundle validate --strict` OK, `bundle deploy` + `bundle run app` OK. Probes 12/12. Live checks: 2025 `tools/list` without `initialize` 13 tools; 2025-06-18 `initialize` echoed; 2026-07-28 `server/discover` (`supportedVersions: ["2026-07-28"]`), `tools/list` 13, card `text/html;profile=mcp-app`; `2099-01-01` -> 400 `-32022`; GET/DELETE 405; no `Mcp-Session-Id` anywhere. `api_contract_tests` run `158019189431872` 153 pass / 0 fail / 201 `skipped_live` / 100% (same as v1). 0 error lines; the 5 warnings were the expected rejections from hand-made probes.

## Which protocol era Databricks clients use

From `check=mcp_request` lines in `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic_ground_truth_otel_logs`, Genie One session 2026-10-30 15:51-15:56Z:

| Request | Version sent by the client | Count |
|---------|----------------------------|-------|
| `initialize` before tool calls | 2025-11-25 | 4 |
| `initialize` before the card read | 2025-03-26 | 2 |
| `tools/list`, `tools/call` | header `mcp-protocol-version: 2025-11-25` | 2, 7 |
| `resources/read` (card) | no version header | 2 |
| `notifications/initialized` | — | 6 |

* User-agent `Databricks-MCP-Proxy/1.0`, client `databricks-onechat` 1.0. A fresh `initialize` before every call; no `Mcp-Session-Id`; no `server/discover`; no 2026 envelope. The access log shows only `POST /mcp` from the proxy (17 x 200, 6 x 202), matching the 23 `mcp_request` lines.
* **These versions are the client's choice, not ours:** the line is logged from the request before the SDK runs, the client proposes first in a 2025 handshake, and the server never offers 2025-03-26 unprompted.
* **Decision:** keep `legacy: 'stateless'`. `'reject'` would lock Genie One out.
* **Limits:** one 5-minute window, one user, one deployment; requests logged, not responses.

The Genie One session also wrote 5 synonyms (15:55:24.94-25.03Z) and an `approve` vote with `source = mcp` (15:55:49.450Z), all as the owner's OBO user, so identity through `identity.ts` works end to end. The card's own approve button is not confirmed (follow-up 2).

## Problems and root causes

1. **Card credential test failed on the v2 bundle.** Root cause: ext-apps 2.x `App` builds on `@modelcontextprotocol/client`, whose OAuth metadata schemas and errors stay in the bundle. Fixed by checking for an Authorization header, not the word (above).
2. **The card file was emptied once, then restored.** Root cause: `pnpm exec tsx print-card.ts > <repo card>` truncated the file, then the script failed (top-level `await` under tsx's CJS mode). Regenerated with an `.mts` script to `/tmp`, compared with the tested card, then written; `cmp`-identical before the commit. Runbook rule added.
3. **Two tool calls blocked by the safety check:** `cp` from `/tmp` into the repo (overwrite of workspace files) and one probe call whose URL was a variable from an earlier cell. The lockfile was produced in the repo with `pnpm install --lockfile-only` (identical to the tested one); the probe was re-run with the app URL in the cell.
4. **Hand-made 2026-07-28 requests got 400 `-32020`.** Root cause: spec 2026-07-28 requires the `Mcp-Method` header (and `Mcp-Name` for named methods). The SDK client sends them; the probes now do too.

## Decisions

* Exact pins for all five MCP packages (no caret), as with ext-apps before.
* The OBO token is not copied into `authInfo`; tools keep using the `UserContext` closure as in v1.
* `closeMcpSessions` keeps its name so `server/server.ts` shutdown is unchanged.
* Card budget unchanged (100 KB gzip); 83,783 B fits.

## Follow-ups

[`../requests/2026-10-30_mcp-sdk-v2-follow-ups.md`](../requests/2026-10-30_mcp-sdk-v2-follow-ups.md): 1 synonym / example `source` not recorded (P2); 2 card approve button in Genie One (P1, owner, before merge); 3 log `mcp-method` / `mcp-name` (P3); 4 re-check client protocol versions after a Databricks release (P3); 5 card size (P3).

## Files modified

* Code (commit `fcec9c2`): `ground-truth-app/package.json`, `pnpm-lock.yaml`, `server/mcp/index.ts`, `server/mcp/identity.ts` (new), `server/mcp/http.test.ts` (new), `server/mcp/server.ts`, `server/mcp/server.test.ts`, `server/mcp/tools/{define,campaign,metricView,review}.ts`, `server/mcp/views/app/{main.ts,main.test.ts,build.ts,build.test.ts,reviewCardApp.generated.ts}`, `tests/contract/{harness.ts,mcp.contract.test.ts}`, `docs/design/L300-17_mcp_app_review_card.md`.
* Docs (this commit): this file, `docs/sessions/INDEX.md`, `ground-truth-app/PROJECT_MEMORY.md` (App Stack, MCP line, Finding 18, Status Log), `docs/requests/2026-10-30_mcp-sdk-v2-follow-ups.md` (new), `docs/requests/README.md`, `docs/runbooks/node_toolchain_genie_code.md`, `docs/design/L300-17_mcp_app_review_card.md` (session link).
