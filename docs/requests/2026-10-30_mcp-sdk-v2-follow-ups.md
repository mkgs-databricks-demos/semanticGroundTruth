# MCP SDK v2 upgrade follow-ups

**Source:** the MCP TypeScript SDK v2 upgrade on branch `mg-genie-mcp-sdk-v2` (commit `fcec9c2`, dev deployment `01f1d474df551a7d85b4909dd93c2782`), and the Genie One check of 2026-10-30 15:51-15:56Z against that deployment. Session: [`../sessions/2026-11-02_mcp-sdk-v2-upgrade.md`](../sessions/2026-11-02_mcp-sdk-v2-upgrade.md); `ground-truth-app/PROJECT_MEMORY.md` Finding 18.

**Closed:** none.

Priority: **P1** = fix before the next build, **P2** = next build, **P3** = when convenient.

| # | P | Bundle | Item |
|---|---|--------|------|
| 1 | P2 | app | Record `source` on synonyms and example questions added by reviewers |
| 2 | P1 | owner | Confirm the review card's own approve button in Genie One on the v2 server |
| 3 | P3 | app | Log `mcp-method` / `mcp-name` in the `mcp_request` line |
| 4 | P3 | app / owner | Re-check which protocol version Databricks clients send after their next release |
| 5 | P3 | app | Watch the review card size (83,783 B gzip of the 100 KB budget) |

## 1. Record `source` on reviewer-added synonyms and example questions (P2, app)

* **Found:** during the Genie One check, the `approve` vote was stored with `source = mcp` (`lb_votes_history`, 15:55:49.450Z), but the 5 synonyms Genie One added to the same asset just before it (15:55:24.94-25.03Z, "budgeted MLR", "budget MLR", "MLR target", "planned MLR", "target medical loss ratio") have `source` null in `lb_asset_synonyms_history`. Not caused by the SDK upgrade: the write path has never set it.
* **Scope on dev (2026-10-30):** every row is null. `lb_asset_synonyms_history`: 26 inserts, all `source` null. `lb_example_questions_history`: 14 inserts, all `source` null. Votes and skips are not affected (`votes.source` and `review_skips.source` are `NOT NULL DEFAULT 'web'` with a CHECK on `VOTE_SOURCES`).
* **Root cause:** both tables have a nullable `source TEXT` column (`ground-truth-app/server/migrations/001_core_schema.ts` L50 for `app.asset_synonyms`, L84 for `app.example_questions`), but the reviewer write paths leave it out:
  * `AssetRegistry.addSynonym` (`ground-truth-app/server/services/asset/assetRegistry.ts` L292-304) inserts `(asset_id, synonym, proposed_by)` only.
  * `AssetRegistry.addExample` (same file, L337-346) inserts `(asset_id, question_text, proposed_by)` only.
  * Callers pass no source: the web route `ground-truth-app/server/routes/review.ts` L94 and L116, and the MCP tools `ground-truth-app/server/mcp/tools/review.ts` L128 and L154. Both callers already hold the `UserContext`, whose `source` is `web` or `mcp`.
  * Only registration sets it: `AssetRegistry.register` writes `source = 'registration'` (`assetRegistry.ts` L153-155 and L165-167). No dev rows carry that value, so the dev assets were registered by another path or before this code.
* **Proposed change:**
  1. Add a `source` parameter to `addSynonym` and `addExample` (type `VoteSource`, from `shared/contracts/values`), write it in the INSERT, and pass `user.source` from the two routes and the two MCP tools.
  2. New migration: a CHECK on both columns allowing `VOTE_SOURCES` plus `'registration'`. Existing null rows pass a CHECK (NULL is not a violation), so no `NOT VALID` or backfill step is needed. Keep the column nullable: null means "recorded before this follow-up". There is no reliable way to backfill these rows.
  3. Optional: `app.synonym_votes` has no `source` column at all (migration 001 L55-61). Add one, the same way, if synonym approve/reject votes should also record where they came from.
  4. Note on behavior: `addSynonym` uses `ON CONFLICT (asset_id, synonym) DO NOTHING`, so if a synonym is proposed again from another channel, the first source is kept. That is acceptable; say so in a comment.
* **Downstream check:** before changing the CHECK, search the pipelines bundle and the feedback author task for readers of `asset_synonyms.source` / `example_questions.source`, so a new value doesn't break any filters.
* **Tests:** unit tests on `AssetRegistry` that the INSERT carries the source; route and MCP tool tests that `web` and `mcp` reach it; migration test for the CHECK (as in the existing migration tests).
* **Done when:** on dev, a synonym and an example question added from the web app land with `source = 'web'`, and ones added from Genie One land with `source = 'mcp'`, checked in `lb_asset_synonyms_history` / `lb_example_questions_history`; `api_contract_tests` still 153 / 0.

## 2. Confirm the card's approve button in Genie One (P1, owner)

* **State:** on deployment `01f1d474df55` Genie One fetched the card (`resources/read` at 15:52:28Z and 15:56:16Z) and an `approve` vote with `source = mcp` was stored at 15:55:49.450Z. The typed feedback text and the 5 parallel synonym calls before it read like Genie One's model calling `review_submit_vote`, not the card button, and the data can't tell the two apart.
* **Done when:** the owner opens the card in Genie One, clicks Approve on the card itself, and a new `lb_votes_history` row with `source = mcp` and no typed feedback appears. Do this before merging the PR.

## 3. Log `mcp-method` / `mcp-name` (P3, app)

* `LOGGED_HEADERS` in `ground-truth-app/server/mcp/index.ts` records `mcp-protocol-version`, `mcp-session-id`, `accept`, `content-type`, `user-agent`, but not the 2026-07-28 routing headers `mcp-method` / `mcp-name`. 2026-era requests without `Mcp-Method` are rejected with `-32020` before any tool runs, so logging the value helps when the first real 2026 client shows up. Values are not secret. Add both to `LOGGED_HEADERS` and to the `describeMcpRequest` test in `server/mcp/http.test.ts`.

## 4. Re-check the protocol version Databricks clients send (P3, app / owner)

* **Baseline (2026-10-30):** `Databricks-MCP-Proxy/1.0`, client `databricks-onechat` 1.0, `initialize` with 2025-11-25 (tools) and 2025-03-26 (card read); no 2026-07-28 traffic. Query: `check = mcp_request` lines in `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic_ground_truth_otel_logs` grouped by `user-agent`, `clientName`, `era`, versions.
* **Done when:** re-run after a Genie One / Unity Gateway release; record whether any client reaches `era = modern`. `legacy: 'stateless'` stays until no Databricks client sends 2025-era requests.

## 5. Review card size (P3, app)

* The card grew from 75,467 to 83,783 B gzip with ext-apps 2.0.4 (its `App` now pulls `@modelcontextprotocol/client` protocol and schema code, including OAuth metadata schemas that don't tree-shake). Budget is 100 KB gzip / 400 KB raw (`server/mcp/views/app/build.ts`). Next ext-apps / client bump: compare the size, and check whether a leaner `App` entry exists before raising the budget.
