# L300-17: MCP App Interactive Review Card

**Build 4 · Session 31 (design, docs only) · 2026-10-24**

## Version decision

**Current (2026-10-30, branch `mg-genie-mcp-sdk-v2`):** `@modelcontextprotocol/ext-apps` **2.0.4** on the MCP TypeScript SDK **v2** split packages, all pinned exactly: `@modelcontextprotocol/server` 2.4.0, `@modelcontextprotocol/core` 2.4.0, `@modelcontextprotocol/client` 2.4.0 (a required peer of ext-apps 2.x; the view's `App` is built on its `Protocol`), and `@modelcontextprotocol/node` 2.1.2 (`toNodeHandler` for Express). `@modelcontextprotocol/sdk` (v1) is removed. The server speaks MCP spec **2026-07-28** and keeps serving 2025-era clients through `createMcpHandler(factory, { legacy: 'stateless' })`. One `zod` copy (4.6.7) in the tree. Card: 318,695 bytes raw / **83,783 gzip** (budget 100 KB gzip; v1 card was 75,467). Details and live results: [`../sessions/2026-10-30_mcp-sdk-v2-upgrade.md`](../sessions/2026-10-30_mcp-sdk-v2-upgrade.md).

**Correction:** the original decision below named the v2 packages `@modelcontextprotocol/sdk-core` / `@modelcontextprotocol/sdk-server`. Those packages do not exist on npm. The real v2 package names are `@modelcontextprotocol/core`, `@modelcontextprotocol/server` and `@modelcontextprotocol/client` (plus the framework adapters `@modelcontextprotocol/node`, `express`, `fastify`, `hono`).

**Original decision (session 31, 2026-10-24, superseded):** pin `@modelcontextprotocol/ext-apps` 1.7.5, paired with `@modelcontextprotocol/sdk` 1.32.1 (SDK v1), because the 2.x line requires the SDK v2 split packages, which would be a non-trivial migration. No 1.7.5 limitation was found that blocks any supported host — Genie One, Claude, or the reference `basic-host`.

---

## 1. Host compatibility matrix

| Host | Renders `ui://` resources | `_meta.ui` fields read | CSP behaviour | Degradation (no MCP Apps support) |
|---|---|---|---|---|
| **Genie One** (Databricks) | **Yes — verified 2026-10-30 (G9, owner).** `review_get_next` rendered the interactive card in Genie One on `fevm-hls-fde` (dev deployment `01f1d3f6e512`, host dark theme applied), and an approve from the card reached the server (`votes.source = mcp`). MCP Apps preview is enabled on the workspace (owner, 2026-10-24). The app's MCP server is registered as a Unity Gateway connection; Genie One connects over StreamableHTTP, reads `_meta.ui.resourceUri` from `tools/list`, fetches the `ui://` resource and renders the iframe. | `resourceUri` (confirmed); host theme reaches the card. Other fields not yet checked. | Host-managed CSP on the sandbox iframe; the app declares no external origins so the default restrictive policy is sufficient. | **Text fallback** — every tool returns `content[].text` (markdown from `views/markdown.ts`). The review workflow is fully functional via tool calls; the interactive card is a progressive enhancement. |
| **Genie Code** | Likely **no** MCP Apps iframe rendering (agent context, not chat UI). | N/A | N/A | **Text fallback** works. Genie Code calls tools and reads `content[].text`. |
| **Claude** (claude.ai / Desktop) | **Yes** — first-class MCP Apps support ([README.md L86-87](../../mcp-ext-apps/README.md#L86-87), [docs/testing-mcp-apps.md L63-64](../../mcp-ext-apps/docs/testing-mcp-apps.md#L63-64)). | `resourceUri`, `visibility`, `csp`, `permissions`, `prefersBorder`, `domain`, `containerDimensions` (from `McpUiToolMeta` and `McpUiResourceMeta` in [src/spec.types.ts L769-796](../../mcp-ext-apps/src/spec.types.ts#L769-796) and [L694-731](../../mcp-ext-apps/src/spec.types.ts#L694-731)). | Host enforces a strict sandbox CSP built from the resource's `_meta.ui.csp` declarations ([docs/csp-cors.md L9-13](../../mcp-ext-apps/docs/csp-cors.md#L9-13)). No external origins declared → no network connections from the iframe, which is the secure default. | N/A — Claude supports MCP Apps. |
| **basic-host** (reference) | **Yes** — renders the iframe, passes tool input/result, proxies `tools/call` ([docs/testing-mcp-apps.md L13-46](../../mcp-ext-apps/docs/testing-mcp-apps.md#L13-46)). | Same as Claude (reference implementation). | CSP applied from resource metadata. | N/A — the basic-host exists to test MCP Apps. |
| **VS Code** | **Yes** — VS Code Insiders supports MCP Apps ([README.md L88](../../mcp-ext-apps/README.md#L88)). | `resourceUri` at minimum. | Host-managed. | Text fallback. |
| **Other hosts** (ChatGPT, Goose, Postman) | Varies — see [README.md supported clients table](../../mcp-ext-apps/README.md#L83-94). | Varies. | Varies. | **Text fallback always works.** |

**Key design principle:** The text fallback (`content[].text` in markdown) is mandatory for every tool call. UI is a progressive enhancement per [docs/overview.md L24-28](../../mcp-ext-apps/docs/overview.md#L24-28). Hosts that don't support MCP Apps see the same markdown output the server produces today.

---

## 2. Resource

### URI and MIME type

| Property | Value | Reference |
|---|---|---|
| **URI** | `ui://ground-truth/review-card` | Matches the existing resource registered in [server/mcp/server.ts L31](../../ground-truth-app/server/mcp/server.ts#L31). |
| **MIME type** | `text/html;profile=mcp-app` | `RESOURCE_MIME_TYPE` constant from [src/app.ts L158](../../mcp-ext-apps/src/app.ts#L158). The current server uses `text/html`; session 34 changes this to `RESOURCE_MIME_TYPE`. |

### HTML bundle production

**Single-file inline HTML.** The review card HTML is already produced as a self-contained string by `renderCardHtml()` in [server/mcp/views/cardHtml.ts](../../ground-truth-app/server/mcp/views/cardHtml.ts). Session 34 will convert this from a static template into an **interactive** single-file HTML string that includes:

1. The `<style>` block (brand tokens, light/dark, layout).
2. A `<script>` block that imports `App` and `PostMessageTransport` from `@modelcontextprotocol/ext-apps` (bundled inline via the existing Vite + `vite-plugin-singlefile` build that session 26 sets up).
3. The card markup generated at resource-read time with a placeholder data attribute; the `App` lifecycle populates it from `ontoolresult`.

Alternatively, the HTML can be a **build-time asset**: a `.html` file in `ground-truth-app/client/src/mcp-app/` compiled by Vite into `dist/review-card.html`, read by the resource callback at runtime:

```ts
// server-side resource read (like quickstart pattern)
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import fs from 'node:fs/promises';

const RESOURCE_URI = 'ui://ground-truth/review-card';

registerAppResource(
  server,
  'Review Card',
  RESOURCE_URI,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => ({
    contents: [{
      uri: RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: await fs.readFile('dist/review-card.html', 'utf-8'),
    }],
  }),
);
```

Ref: [docs/quickstart.md L175-236](../../mcp-ext-apps/docs/quickstart.md#L175-236) (two-part registration pattern), [src/server/index.ts L217-255](../../mcp-ext-apps/src/server/index.ts#L217-255) (`registerAppTool` signature).

**Recommended approach:** Build-time asset (Vite + `vite-plugin-singlefile`). This lets the view code use TypeScript, import the ext-apps SDK, and produce a single self-contained HTML file. The server reads it at startup and caches it. This avoids embedding large script strings in a template literal.

### Size budget

Target **< 100 KB** for the single-file HTML (CSS + JS + markup). The current static card is ~3 KB. The ext-apps client SDK is ~30 KB minified. Interactive logic (actions, keyboard handling, state management) adds ~15-20 KB. Fonts are NOT inlined in the MCP App view — the view uses `var(--font-sans)` and `var(--font-mono)` from the host's theme variables (see §4 Theming), falling back to system fonts. This keeps the bundle small and visually consistent with the host.

### CSP declarations

No external origins. The card is fully self-contained:

```ts
// On the resource content item's _meta.ui:
_meta: {
  ui: {
    // No connectDomains, no resourceDomains → strictest default CSP
    // No domain → host uses default sandbox origin
    prefersBorder: true,  // card looks better with a host-provided border
  }
}
```

Ref: `McpUiResourceMeta` in [src/spec.types.ts L694-731](../../mcp-ext-apps/src/spec.types.ts#L694-731), `McpUiResourceCsp` in [src/spec.types.ts L605-655](../../mcp-ext-apps/src/spec.types.ts#L605-655).

### Sizing and auto-resize

The `App` class has `autoResize: true` by default ([src/app.ts L177](../../mcp-ext-apps/src/app.ts#L177)), which uses `ResizeObserver` on `document.body` to send `ui/notifications/size-changed` to the host. The card's natural height varies with content (description length, synonyms, examples). Let the host constrain width; the card resizes vertically.

No `containerDimensions` are declared on the tool `_meta` (the host decides the iframe width). The view reads `hostContext.containerDimensions` from the initialization result and adapts layout if width is very narrow (< 320px).

---

## 3. Tool wiring

### Tools with `_meta.ui.resourceUri`

Four tools reference the review card resource, making them "UI-enabled": when the host calls them, it also renders the iframe.

| Tool | Visibility | `_meta.ui` | `structuredContent` schema | `content[].text` (fallback) |
|---|---|---|---|---|
| `review_get_next` | `["model", "app"]` (default) | `{ resourceUri: RESOURCE_URI }` | `ReviewCardSchema` (from session 25 zod contracts) | `renderCardMarkdown(card)` |
| `review_submit_vote` | `["model", "app"]` | `{ resourceUri: RESOURCE_URI }` | `{ submitted: VoteResultSchema, next: ReviewCardSchema \| null }` | "Vote recorded. Next card: ..." or "Queue empty." |
| `review_skip_card` | `["model", "app"]` | `{ resourceUri: RESOURCE_URI }` | `{ skipped: SkipResultSchema, next: ReviewCardSchema \| null }` | "Skipped. Next card: ..." or "Queue empty." |
| `review_get_stats` | `["model", "app"]` | `{ resourceUri: RESOURCE_URI }` | `UserStatsSchema` | `renderStatsMarkdown(stats)` |

Ref: `registerAppTool` in [src/server/index.ts L217-255](../../mcp-ext-apps/src/server/index.ts#L217-255), tool metadata type `McpUiToolMeta` in [src/spec.types.ts L769-796](../../mcp-ext-apps/src/spec.types.ts#L769-796).

**ext-apps 2.x (2026-10-30):** `registerContractTool` (`server/mcp/tools/define.ts`) calls the non-deprecated Standard Schema overload of `registerAppTool` (the contract `inputSchema` is a `z.object`, not a raw shape) and passes only `_meta.ui.resourceUri`. ext-apps 2.0.4 still adds the deprecated flat `ui/resourceUri` key to the listed tool for older hosts; `server/mcp/server.test.ts` asserts both. The resource is registered with `registerAppResource` and MIME `RESOURCE_MIME_TYPE` (`text/html;profile=mcp-app`).

### App-only helper tools (hidden from model)

These tools exist for the interactive view to call, but the model never sees them in `tools/list`:

| Tool | Visibility | Purpose |
|---|---|---|
| `review_get_card_by_id` | `["app"]` | Fetch a specific card (for undo/refresh after error). |
| `review_get_queue_position` | `["app"]` | Show progress (e.g. "3 of 47") without model chatter. |

Ref: app-only visibility pattern in [docs/patterns.md L11-35](../../mcp-ext-apps/docs/patterns.md#L11-35).

### `structuredContent` shape

Every UI-enabled tool returns both `content` (text for non-UI hosts / model context) and `structuredContent` (typed data for the view). The view reads `structuredContent` from `ontoolresult`; the model reads `content[].text`.

```ts
return {
  content: [{ type: 'text', text: renderCardMarkdown(card) }],
  structuredContent: ReviewCardSchema.parse(card),  // typed for the view
};
```

Ref: structured content delivery in [docs/overview.md L97](../../mcp-ext-apps/docs/overview.md#L97) ("Results include both `content` (text for the model's context) and optionally `structuredContent` (data optimized for UI rendering).").

---

## 4. View behaviour

### App client lifecycle

The view is a vanilla TypeScript single-file HTML (no React in the MCP App — the card is simple enough to be DOM-driven, and React would triple the bundle size).

```
1. Host renders iframe with the review-card HTML
2. View creates App, connects via PostMessageTransport
3. View receives ui/initialize result → hostContext (theme, dimensions, capabilities)
4. View receives ui/notifications/tool-input → tool arguments (ignored for display tools)
5. View receives ui/notifications/tool-result → { structuredContent: ReviewCard }
6. View renders the card from structuredContent
7. User interacts → View calls app.callServerTool(...) → re-renders from response
```

Ref: `App` class in [src/app.ts](../../mcp-ext-apps/src/app.ts), lifecycle in [docs/overview.md L63-101](../../mcp-ext-apps/docs/overview.md#L63-101), `PostMessageTransport` in [src/message-transport.ts](../../mcp-ext-apps/src/message-transport.ts).

### Initialization

```ts
import { App, PostMessageTransport, applyHostStyleVariables, applyDocumentTheme } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'ground-truth-review-card', version: '1.0.0' }, { autoResize: true });
const transport = new PostMessageTransport();

app.ontoolresult = async (notification) => {
  const data = notification.params?.structuredContent;
  if (data) renderCard(data);
};

app.onhostcontextchanged = async (notification) => {
  applyHostStyleVariables(notification.params);
  applyDocumentTheme(notification.params);
};

app.onteardown = async () => {
  // Save any pending state if needed
  return {};
};

const { hostContext } = await app.connect(transport);
applyHostStyleVariables(hostContext);
applyDocumentTheme(hostContext);
```

Ref: `App.connect` in [src/app.ts](../../mcp-ext-apps/src/app.ts), `applyHostStyleVariables` and `applyDocumentTheme` in [src/styles.ts](../../mcp-ext-apps/src/styles.ts), `ontoolresult` callback triggered by `McpUiToolResultNotification` in [src/spec.types.ts L300-304](../../mcp-ext-apps/src/spec.types.ts#L300-304).

### Actions via `callServerTool`

| User action | Keyboard | Tool call | On success |
|---|---|---|---|
| **Approve** | `A` | `app.callServerTool({ name: 'review_submit_vote', arguments: { voteType: 'approve' } })` | Render `response.structuredContent.next` or show "Queue empty" |
| **Reject** | `R` | `app.callServerTool({ name: 'review_submit_vote', arguments: { voteType: 'reject' } })` | Same |
| **Edit** | `E` | Opens inline edit fields; on save: `app.callServerTool({ name: 'review_submit_vote', arguments: { voteType: 'edit', editedFields: {...} } })` | Same |
| **Skip** | `S` | `app.callServerTool({ name: 'review_skip_card', arguments: { assetId, reason: selectedReason } })` | Same |
| **Refresh** | `Ctrl+R` | `app.callServerTool({ name: 'review_get_card_by_id', arguments: { assetId } })` | Re-render current card |

Ref: `App.callServerTool` in [src/app.ts](../../mcp-ext-apps/src/app.ts) (the method is defined on the App class and proxies through the host to the server).

### Optimistic UI and error states

1. **Optimistic transition:** On vote/skip, immediately show a brief animation (card slides out, "Submitting..." state) before the `callServerTool` response arrives. If the response has `isError: true`, revert to the previous card with an error banner.
2. **Network timeout:** If `callServerTool` does not return within 10 seconds, show a "Connection lost — Retry?" state with a retry button.
3. **Empty queue:** If the response's `next` is `null`, show an empty state: "All caught up! No more cards to review."
4. **Error reporting to model:** On persistent errors, use `app.updateModelContext()` to inform the model: ref [docs/patterns.md L234-251](../../mcp-ext-apps/docs/patterns.md#L234-251).

### Keyboard shortcuts and focus order

- Tab order: Approve → Reject → Edit → Skip → card content (scrollable) → footer links.
- Shortcuts `A`, `R`, `E`, `S` active only when the card body or an action button has focus (not when an input field is focused, to avoid conflicts with typing).
- `Escape` closes any open edit fields and returns focus to the action bar.
- All interactive elements have `role`, `aria-label`, and visible focus rings (`outline: 2px solid var(--color-ring-primary)`).

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

The card-out animation on vote/skip is CSS-only and respects this query.

### Light/dark theming from host

The view uses the host's CSS custom properties with Databricks brand fallbacks:

```css
:root {
  /* Host theme variables (from MCP Apps spec) with Databricks brand fallbacks */
  --bg: var(--color-background-primary, #F9F7F4);
  --text: var(--color-text-primary, #1B3139);
  --text-secondary: var(--color-text-secondary, #5A6F77);
  --surface: var(--color-background-secondary, #FFFFFF);
  --border: var(--color-border-primary, #DCE0E2);
  --ring: var(--color-ring-primary, #2272B4);
  --accent: #FF3621;  /* Databricks brand — no host variable for accent */
  --font-sans: var(--font-sans, "DM Sans", system-ui, sans-serif);
  --font-mono: var(--font-mono, "DM Mono", ui-monospace, monospace);
}
```

Ref: style variable keys `McpUiStyleVariableKey` in [src/spec.types.ts L44-133](../../mcp-ext-apps/src/spec.types.ts#L44-133), theme in `McpUiHostContext.theme` [src/spec.types.ts L351](../../mcp-ext-apps/src/spec.types.ts#L351), `applyHostStyleVariables` in [src/styles.ts](../../mcp-ext-apps/src/styles.ts).

The `applyHostStyleVariables(hostContext)` call sets all `--color-*`, `--font-*`, `--border-*`, `--shadow-*` variables on `:root`. The view also calls `applyDocumentTheme(hostContext)` which sets `data-theme` on `<html>` for explicit light/dark selection. The dark fallbacks mirror the existing `cardHtml.ts` dark tokens:

```css
[data-theme="dark"], @media (prefers-color-scheme: dark) {
  :root {
    --bg: var(--color-background-primary, #0B2026);
    --text: var(--color-text-primary, #FFFFFF);
    --text-secondary: var(--color-text-secondary, #90A5B1);
    --surface: var(--color-background-secondary, #1B3139);
    --border: var(--color-border-primary, #1B5162);
    --accent: #FF5F46;
  }
}
```

If the host provides fonts via `hostContext.styles.css.fonts`, the view applies them with `applyHostFonts(hostContext)`. Otherwise the `var(--font-sans)` / `var(--font-mono)` fallback to the Databricks DM Sans / DM Mono stack.

---

## 5. Auth

### Identity flow

The app runs as a Databricks App behind the Apps proxy. All MCP requests arrive at `POST /mcp` and carry the caller's identity:

- **Model-initiated tool calls** (from Genie One or Claude): The host connects to the app's MCP server via the Unity Gateway connection (StreamableHTTP). The Apps proxy authenticates the caller (OBO for user reads, M2M service principal for writes). Each tool call runs as the calling user.
- **View-initiated tool calls** (`app.callServerTool(...)` from the iframe): These go through the host's `AppBridge`, which proxies them to the server over the same MCP transport. The host handles authentication transparently — the view never sees or handles tokens.

### What the view must never do

1. **No tokens in HTML.** The resource HTML is fetched by the host and injected into a sandboxed iframe. Secret material must never appear in the HTML source.
2. **No fetch to the app origin.** The view's CSP declares no `connectDomains`, so `fetch()` / `XMLHttpRequest` to any origin (including the app's own HTTP server) will be blocked by the browser. All server interaction goes through `app.callServerTool()` / `app.readResource()`, which use `postMessage` to the host.
3. **No OAuth flow in the view.** The Databricks Apps proxy handles authentication. The view does not need `lazy-auth-server` or per-tool authorization patterns.

Ref: authorization patterns in [docs/authorization.md](../../mcp-ext-apps/docs/authorization.md) — our case is simpler because the Apps proxy provides auth at the transport level, not per-tool.

---

## 6. Testing plan

### Unit tests (vitest)

| Test | What it verifies |
|---|---|
| **Resource MIME type** | The `review-card` resource returns `mimeType: 'text/html;profile=mcp-app'` and non-empty HTML containing `<script>`. |
| **Tool `_meta.ui`** | Each of the 4 UI-enabled tools has `_meta.ui.resourceUri === 'ui://ground-truth/review-card'`. |
| **Tool `_meta.ui.visibility`** | App-only tools have `visibility: ["app"]`; model+app tools have `visibility: undefined` (default) or `["model", "app"]`. |
| **`structuredContent` presence** | `review_get_next` returns both `content[].text` (non-empty string) and `structuredContent` (object with `asset`, `progress` keys). |
| **Text fallback** | Every UI-enabled tool's `content[].text` is meaningful markdown (not empty, not just "ok"). |
| **CSP** | Resource `_meta.ui` has no `connectDomains`, no `resourceDomains` (secure default). `prefersBorder` is `true`. |

### Headless test with ext-apps test utilities

The ext-apps repo at 1.7.5 does not ship a dedicated headless test harness in `tests/` that is exported for external use. The `tests/` directory contains internal unit tests for the SDK. Session 34 should write a **vitest test that mocks `PostMessageTransport`** to simulate the host side:

1. Create a `PostMessageTransport` instance and connect it to the `App`.
2. Send `ui/initialize` → verify the app responds with `ui/notifications/initialized`.
3. Send `ui/notifications/tool-result` with a sample `ReviewCard` → verify the DOM renders the card content.
4. Simulate a button click → verify `tools/call` is sent with the expected tool name and arguments.

This uses the SDK's own transport layer as the contract surface, which is more reliable than Playwright for a sandboxed iframe.

### basic-host manual check

After session 34 implementation:

1. Start the app locally: `cd ground-truth-app && npm start`
2. Start basic-host: `cd /Workspace/Users/matthew.giglia@databricks.com/mcp-ext-apps/examples/basic-host && SERVERS='["http://localhost:3001/mcp"]' npm start`
3. Open `http://localhost:8080`, select the `semantic-ground-truth` server.
4. Call `review_get_next` → verify the interactive card renders with action buttons.
5. Click Approve → verify the next card loads.
6. Check keyboard shortcuts (A, R, E, S).
7. Toggle host theme to dark → verify the card adapts.

Ref: [docs/testing-mcp-apps.md L13-58](../../mcp-ext-apps/docs/testing-mcp-apps.md#L13-58).

### Contract job checks (session 35)

The API contract test job (session 35) should add these MCP-specific checks:

| Check ID | Method | Assertion |
|---|---|---|
| `mcp-resource-mime` | `resources/read` on `ui://ground-truth/review-card` | `mimeType === 'text/html;profile=mcp-app'` and `text` is non-empty HTML |
| `mcp-tools-ui-meta` | `tools/list` | At least 4 tools have `_meta.ui.resourceUri === 'ui://ground-truth/review-card'` |
| `mcp-tool-structured` | `tools/call` `review_get_next` | Response has `structuredContent` with `asset.id` (string) and `progress.total` (number) |
| `mcp-app-only-hidden` | `tools/list` | Tools with `visibility: ["app"]` are NOT in the default `tools/list` response (model perspective); they appear when the app calls `tools/list` with its own capabilities |

---

## 7. Acceptance list for session 34

1. **MIME type**: The `review-card` resource returns `mimeType: 'text/html;profile=mcp-app'` (import `RESOURCE_MIME_TYPE` from `@modelcontextprotocol/ext-apps/server`).
2. **Registration**: Tools are registered with `registerAppTool()` from `@modelcontextprotocol/ext-apps/server` instead of bare `server.tool()`; the resource is registered with `registerAppResource()`.
3. **UI-enabled tools**: `review_get_next`, `review_submit_vote`, `review_skip_card`, and `review_get_stats` each have `_meta: { ui: { resourceUri: 'ui://ground-truth/review-card' } }`.
4. **App-only tools**: `review_get_card_by_id` and `review_get_queue_position` have `_meta: { ui: { visibility: ['app'] } }`.
5. **`structuredContent`**: All 4 UI-enabled tools return `structuredContent` (typed from session 25 zod schemas) alongside `content[].text` (markdown fallback).
6. **Review card HTML**: `dist/review-card.html` is a self-contained single-file HTML (< 100 KB) built by Vite + `vite-plugin-singlefile`. It contains an inline `<script>` that imports `App` and `PostMessageTransport` from `@modelcontextprotocol/ext-apps`.
7. **App lifecycle**: The view creates an `App({ name: 'ground-truth-review-card', version: '1.0.0' }, { autoResize: true })`, connects via `PostMessageTransport`, and renders the card from `ontoolresult.params.structuredContent`.
8. **Actions**: Approve (A), Reject (R), Edit (E), Skip (S) buttons call `app.callServerTool(...)` with the correct tool name and arguments, and re-render the card from the response's `structuredContent.next`.
9. **Optimistic UI**: Vote/skip shows a transition animation, reverts on error.
10. **Keyboard shortcuts**: A/R/E/S work when the card or action bar has focus; Escape closes edit mode.
11. **Theming**: View calls `applyHostStyleVariables(hostContext)` and `applyDocumentTheme(hostContext)` on init and on `onhostcontextchanged`. All colors use `var(--color-*)` with Databricks brand fallbacks. Dark mode works.
12. **Reduced motion**: All animations respect `prefers-reduced-motion: reduce`.
13. **No external origins**: Resource `_meta.ui` has no `connectDomains`, no `resourceDomains`. `prefersBorder: true`.
14. **No tokens in HTML**: The HTML source contains no secrets, no `Authorization` headers, no fetch calls.
15. **Text fallback**: Every tool call still returns `content[].text` with meaningful markdown. Non-UI hosts see the same output as today.
16. **13 tools + 1 new**: `review_skip_card` is registered (tool #13), plus at least 2 app-only tools (hidden from model `tools/list`).
17. **Input/output validation**: All 13+ tools validate input against zod schemas (from `ROUTE_CONTRACTS` / `MCP_TOOL_CONTRACTS`); output is validated before returning.
18. **Vitest coverage**: Unit tests for resource MIME type, tool `_meta.ui`, `structuredContent` shape, text fallback, CSP, and the mock-transport App lifecycle test.
19. **`bundle validate --strict --target dev`** passes for the app bundle.

---

## Open questions for the owner

1. **Genie One MCP Apps rendering**: Is the MCP Apps iframe rendering live in Genie One (fevm-hls-fde workspace)? If not, when is it expected? This determines whether the interactive card is visible in the primary host today or only through the text fallback.
2. **Edit flow UX**: Should the inline edit fields in the MCP App card support editing `plainEnglishLogic` and `description` only, or also `synonyms` and `examples`? The current `review_submit_vote` with `voteType: 'edit'` accepts `editedFields` — confirming the scope of editable fields affects the view layout.
3. **App-only tool access**: Does the Databricks MCP Apps host (Genie One) support `visibility: ["app"]` filtering, or does it pass all tools through `tools/list` regardless? If it doesn't filter, app-only tools would be visible to the model — harmless but noisy.
4. **basic-host deployment**: Should the local manual check (§6) be documented as a runbook, or is the contract job (session 35) sufficient for CI?
