# Session 31 — MCP App design for the review card

**Build 4 · Wave 4-0 · Run 110489694161084 · 2026-10-24**

## What was done

Created `docs/design/L300-17_mcp_app_review_card.md` — a comprehensive design document for converting the static MCP review card into an interactive MCP App using `@modelcontextprotocol/ext-apps` 1.7.5.

## Deliverable

The design doc covers all 7 required sections:

1. **Host compatibility matrix** — Genie One (unverified, text fallback available), Genie Code (text fallback), Claude (first-class), basic-host (reference), VS Code, others. Progressive enhancement with mandatory text fallback.
2. **Resource** — URI `ui://ground-truth/review-card`, MIME type `text/html;profile=mcp-app`, single-file HTML built by Vite + vite-plugin-singlefile, < 100 KB budget, no external origins (strictest CSP), `prefersBorder: true`, auto-resize.
3. **Tool wiring** — 4 UI-enabled tools (`review_get_next`, `review_submit_vote`, `review_skip_card`, `review_get_stats`) with `_meta.ui.resourceUri`, 2 app-only helper tools (`review_get_card_by_id`, `review_get_queue_position`) with `visibility: ["app"]`. All tools return `structuredContent` + `content[].text`.
4. **View behaviour** — Vanilla TypeScript (no React), `App` lifecycle with `PostMessageTransport`, `ontoolresult` for data, `callServerTool` for actions (approve/reject/edit/skip), keyboard shortcuts (A/R/E/S), optimistic UI, host theme via `applyHostStyleVariables`, light/dark with Databricks brand fallbacks, reduced motion.
5. **Auth** — Through Databricks Apps proxy (OBO + M2M). No tokens in HTML, no fetch from iframe, no OAuth flow in view.
6. **Testing plan** — Vitest unit tests (MIME type, `_meta.ui`, `structuredContent`, CSP), mock-transport lifecycle test, basic-host manual check, contract job checks (session 35).
7. **Acceptance list for session 34** — 19 numbered, testable criteria.

## Version decision

Confirmed **ext-apps 1.7.5**. No limitation found that blocks Genie One, Claude, or basic-host. 2.x requires SDK v2 split packages — not justified.

## Key design decisions

- **Vanilla TypeScript** for the view (not React) — keeps bundle under 100 KB, card is simple enough for DOM manipulation.
- **Build-time asset** via Vite rather than inline template literal — enables TypeScript, SDK imports, and keeps server code clean.
- **Host theme variables** (`var(--color-*)`, `var(--font-*)`) with Databricks brand fallbacks — visually native in any host, Databricks-branded standalone.
- **No external origins** — card is fully self-contained; all server interaction through `app.callServerTool()`.

## Open questions

4 questions for the owner documented in the design doc (Genie One MCP Apps status, edit flow scope, app-only tool filtering, basic-host runbook).

## Files changed

| File | Action |
|---|---|
| `docs/design/L300-17_mcp_app_review_card.md` | Created |

## Dependencies satisfied

None (wave 4-0, no depends_on).

## Next

Session 34 (wave 4-2) implements the design.
