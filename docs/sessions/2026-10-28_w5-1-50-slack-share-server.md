# Session 50 (wave 5-1): Share to Slack, server side (G5 Option A)

Run `229891579528310`, branch `mg-genie-build-5`, mode `edit`. Plan: `docs/plans/build-5/50_slack_share_server.md`. Spec: `docs/research/05_slack_mcp_notifications.md`.

**Status: blocked.** All scope inside the owned paths is done and tested. One change outside my paths is needed first: `tests/contract/**` still marks the 3 Slack routes as 501 stubs. With the real handlers in place, the 3 `stub: valid input answers 501` tests fail. The patch below fixes them. I proved it in `/tmp/gt-50`: full vitest passes with it applied. Nobody owns `tests/contract/**` in build 5 after session 44, so the integrator or owner must apply it.

## Changes (owned paths)

### MCP client: `server/services/notification/destinations/slackMcp.ts` (new)
* `SlackMcpClient`: a minimal Streamable-HTTP JSON-RPC client to `${DATABRICKS_HOST}/ai-gateway/mcp-services/system.ai.slack`. It always uses the caller's OBO token. Without a token it throws `UNAUTHENTICATED` and never falls back to the app SPN.
* Handshake (`initialize` + `notifications/initialized`) runs once per client. It keeps `Mcp-Session-Id`, sends `MCP-Protocol-Version`, and accepts JSON or `text/event-stream`. Responses are decoded as UTF-8 explicitly (build-4 latin-1 gotcha).
* Methods: `searchChannels(query)` -> `slack_search_channels {query}`, `send(channelId, text)` -> `slack_send_message {channel_id, message}`, `draft(channelId, text)` -> `slack_send_message_draft {channel_id, message}`.
* Error mapping:
  * JSON-RPC `-32042` (in any body) or HTTP 401 -> `SlackLoginRequiredError`, with `loginUrl` from `error.data.elicitations[].url` (or `.params.url`, https only).
  * 403 -> `FORBIDDEN` ("No EXECUTE privilege on system.ai.slack").
  * 429 -> `RATE_LIMITED` with `details.retryAfterSeconds` (Retry-After as seconds or a date).
  * Any other HTTP error, JSON-RPC error, tool `isError`, network failure or 10 s timeout -> `UPSTREAM_ERROR`.
* Logs carry only the call name and the status/code. The token and the message text are never logged.
* The permalink is the first `https://*.slack.com/archives/...` URL in the structured content or the text. Channels are parsed from structured content, a JSON text block, or text lines with an id (`C…`/`G…`) and a `#name` / `Name:`. Max 50 channels, de-duplicated.

### Share service: `server/services/notification/slackShare.ts` (new)
* `SlackShareService.shareNotification` / `shareAsset` / `searchChannels`. The OBO token is checked first, then the lookups:
  * Notification: `getVisible` must find it, addressed to the caller or to one of their roles. Otherwise 404.
  * Asset: `assets.get` returns 404 for an unknown asset.
  * Confidence: read from `app.confidence_scores`.
* Message (`buildShareMessage`, plain text): notification title/body, `Asset: <name> (<type>)`, `Status: <status> · Confidence: <n>%` (or "not scored yet"), the deep link, and `Note: <user message>`. Max 3,000 chars: the notification body is shortened first, then the note. The link is always kept.
* Deep links: `/steward?asset=<id>` for assets. For notifications: the asset link when `metadata.assetId` is set, `/steward/feedback-branches` when `metadata.batchId` is set, else `/`. The origin is `DATABRICKS_APP_URL` (https only), else a well-formed `x-forwarded-host` / `host`, else a relative link.
* Audit: each share writes one `app.notifications` row through `NotificationService.recordSlackShare`:
  * Columns: `channel='slack'`, `event_type='share.slack'`, recipient = the sharer, body = the message text.
  * Status `sent` for send and draft, with `metadata.shareStatus` = `sent`/`drafted`, plus `mode`, `channelId`, `source {type,id}` and `permalink`.
  * A Slack failure writes `status='failed'` with `metadata.errorCode`. `needs_slack_login` writes no row, because nothing reached Slack.
* `slackShareEnabled()`: reads `GT_SLACK_SHARE_ENABLED`, default true. `false`/`0`/`no`/`off` turn the feature off.

### `notificationService.ts`
* `getVisible(id, userId, roles)` returns an in-app row that the user or one of their roles can see.
* `recordSlackShare(audit)` inserts the audit row.
* New exports: `SLACK_SHARE_EVENT_TYPE` and `SlackShareAudit`. `index.ts` re-exports the new API.

### Routes: `server/routes/slack.ts`
* The 3 handlers are implemented. Chain: `requireSlackShareEnabled` (404 `NOT_FOUND` when the flag is off, before RBAC and validation) -> `requireRoleMiddleware('steward')` -> `validate` -> handler.
* `registerSlackRoutes(app, services, { clientFor? })`: tests inject a fake client factory. `routes/index.ts` is unchanged.
* `server/routes/config.ts`: `slackShareEnabled: slackShareEnabled()`.

### `resources/app.app.yml`
* Adds `ai-gateway` to `user_api_scopes`. **Every user consents again once, on their next open of the app.** Session 63 adds this note to the runbook; session 46 owns the runbook in another wave.

### Tests (new, owned)
* `destinations/slackMcp.test.ts` (16 tests, mocked fetch):
  * Success over SSE (handshake, Bearer user token, session id, tool args).
  * Draft, channel search, handshake runs once.
  * Errors: `-32042` + login URL, 401, 429 + retry-after, 403, 500 / tool error / JSON-RPC error, timeout, no token.
  * Parsers.
* `slackShare.test.ts` (18 tests, real route chain through `routeHarness.invoke` with a fake client):
  * A reviewer gets 403 on all 3 routes.
  * Steward draft -> `drafted`, plus one audit row and the message content.
  * Admin send of a role-addressed notification -> `sent` + permalink + audit row.
  * Login needed -> `needs_slack_login` + `loginUrl`, no audit row.
  * 429 -> `RATE_LIMITED` + a `failed` audit row. 403 FORBIDDEN.
  * Unknown or not-visible notification/asset -> 404. No token -> 401.
  * Channels list. Invalid body -> 400. A failed audit write does not fail a share that was sent.
  * Flag off -> 404 on all 3 routes and `/api/config` reports `slackShareEnabled: false`. The default is true.
  * Helpers.

## Checks (`/tmp/gt-50`, copy of the live tree, Node toolchain runbook)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | pass |
| `tsc -b tsconfig.server.json` | exit 0 |
| `tsc -b tsconfig.client.json` (live tree) | exit 1: 3 errors in `client/src/components/layout/AppLayout.tsx` (`NavLinks` props). These come from session 49, which was editing `NavLinks.tsx` in parallel. No client file is mine. |
| `tsc -b tsconfig.client.json` (HEAD client + my server changes) | exit 0 |
| vitest, live tree as is | 1264 pass, 2 skipped, **3 fail**: `tests/contract/routes.contract.test.ts` "stub: valid input answers 501" for the 3 Slack routes (expected, see request) |
| vitest, with the contract patch below applied in the copy | **45 files, 1277 pass, 2 skipped, 0 fail** (contract suite alone: 4 files, 358 pass) |
| `bundle validate --strict --target dev` (ground-truth-app) | Validation OK |

I did not deploy anything (`allow_deploy` is false). There was no live Slack call.

## Requests

1. **`ground-truth-app/tests/contract/**`** (blocking for the wave gate):
   * Replace the 3 Slack stub cases with real cases, plus a fake `system.ai.slack`. The patch is below (4 files).
   * The coverage test still expects the 3 routes to be `skipped_live: obo-only`. That stays true, and `manifest.ts` is unchanged.
2. **Runbook (session 63):** note that `ai-gateway` was added to `user_api_scopes`, so users consent again once. The owner prerequisite still applies: reconnect `system.ai.slack` in Catalog Explorer, and confirm `slack_send_message` appears in `tools/list` (research §Q3).
3. **Session 56 (UI):**
   * `needs_slack_login` comes back as HTTP 200 with an optional `loginUrl`. The URL comes from the MCP elicitation and can be missing (for example on a plain 401). Fall back to "open `system.ai.slack` in Catalog Explorer and click Login".
   * 429 carries `error.details.retryAfterSeconds` when Slack sends Retry-After.

## Assumptions

* The input schema of `slack_search_channels` is not documented. The research doc only lists the tool name, so I assumed `{ query }`, and the parser accepts several output shapes. Check it in the manual wave (M5) with a draft share.
* `slack_send_message_draft` takes `channel_id` + `message` (research §Q3 table, from the legacy listing).
* HTTP 401 from Unity Gateway means Slack sign-in is needed (plan step 1). A bad Databricks token would show the same "Connect Slack" state.
* `DATABRICKS_APP_URL` may not be injected by Apps. In that case the forwarded host gives the origin.

## Decisions

* Audit rows reuse `app.notifications` without a migration. Status stays within the existing CHECK list: `drafted` is `status='sent'` + `metadata.shareStatus='drafted'`. `event_type='share.slack'` is a server-internal value, not added to `NOTIFICATION_EVENT_TYPES`, because `shared/contracts` belongs to session 44. The inbox reads `channel='in_app'` only, so audit rows never show there.
* A failed audit insert is logged at error level and does not change the response. The Slack call already happened, and failing the request would make the user retry and post twice. Recorded as a suppression.
* A steward can share only notifications addressed to them or to their roles, which is the same visibility as the inbox.
* The flag check runs before RBAC, so a disabled feature returns 404 for everyone.

## Contract-suite patch (apply from repo root with `git apply`)

```diff
--- a/ground-truth-app/tests/contract/fakeStore.ts
+++ b/ground-truth-app/tests/contract/fakeStore.ts
@@ -24,6 +24,7 @@
 import type { MembershipService } from '../../server/services/membership';
 import type { MetricViewService } from '../../server/services/metricView';
 import type { NotificationService } from '../../server/services/notification';
+import type { SlackShareAudit } from '../../server/services/notification/notificationService';
 import type { ReviewEngine } from '../../server/services/review';
 import { computeConfidence, deriveStatus, wilsonLowerBound } from '../../server/services/review/wilsonScore';
 import type { UserSettingsService } from '../../server/services/settings';
@@ -128,6 +129,8 @@
   mcpSessions = new Map<string, { current_asset_id: string; campaign_id: string | null; updated_at: string }>();
   /** Steward notifications the fake steward service sent (eventType + batchId), in order. */
   stewardNotifications: { eventType: string; batchId: string }[] = [];
+  /** Share to Slack audit rows (NotificationService.recordSlackShare), in order. */
+  slackShares: SlackShareAudit[] = [];
 
   now(): string {
     return new Date(this.clockMs).toISOString();
@@ -347,7 +350,7 @@
 type AssetsFake = Pick<AssetRegistry, 'list' | 'get' | 'listVersions' | 'register' | 'listSynonyms' | 'addSynonym' | 'voteSynonym' | 'removeSynonym' | 'listExamples' | 'addExample' | 'voteExample'>;
 type CampaignsFake = Pick<CampaignManager, 'list' | 'create' | 'get' | 'updateStatus' | 'runFreshnessCheck'>;
 type MetricViewsFake = Pick<MetricViewService, 'listCatalogs' | 'listSchemas' | 'listMetricViews' | 'list' | 'get' | 'validate'>;
-type NotificationsFake = Pick<NotificationService, 'list' | 'unreadCount' | 'markRead' | 'getPreferences' | 'updatePreferences'>;
+type NotificationsFake = Pick<NotificationService, 'list' | 'unreadCount' | 'markRead' | 'getPreferences' | 'updatePreferences' | 'getVisible' | 'recordSlackShare'>;
 type MembershipFake = Pick<MembershipService, 'listGroups' | 'addMember' | 'removeMember'>;
 type StewardFake = Pick<StewardService, 'feedbackQueue' | 'conflicts' | 'resolveConflict' | 'listFeedbackBranches' | 'upsertFeedbackBranch' | 'updateFeedbackBranchStatus'>;
 type SettingsFake = Pick<UserSettingsService, 'get' | 'update'>;
@@ -390,6 +393,10 @@
       });
       return [];
     }
+    if (/FROM app\.confidence_scores/.test(text)) {
+      const assetId = String(params[0]);
+      return store.assets.some((a) => a.id === assetId) ? [{ confidence: store.confidence(assetId).confidence }] : [];
+    }
     throw new Error(`FakeDb: unexpected SQL: ${text.slice(0, 80)}`);
   };
   return {
@@ -657,6 +664,12 @@
       return targets.length;
     },
     getPreferences: async (userId) => clone(store.preferences.filter((p) => p.userId === userId)).sort((a, b) => a.eventType.localeCompare(b.eventType)),
+    getVisible: async (id, userId, roles = []) =>
+      clone(store.notifications.find((n) => n.id === id && (n.userId === userId || (roles as string[]).includes(n.userId))) ?? null),
+    recordSlackShare: async (audit) => {
+      store.slackShares.push(clone(audit));
+      return store.newId();
+    },
     updatePreferences: async (userId, prefs) => {
       for (const p of prefs) {
         store.preferences = store.preferences.filter((x) => !(x.userId === userId && x.eventType === p.eventType));
--- a/ground-truth-app/tests/contract/routeCases.ts
+++ b/ground-truth-app/tests/contract/routeCases.ts
@@ -13,6 +13,7 @@
 import { DEFAULT_SETTINGS } from '../../server/lib/config';
 import { DEFAULT_USER_SETTINGS } from '../../server/services/settings/userSettingsService';
 import type { FakeStore } from './fakeStore';
+import { FAKE_SLACK_CHANNELS, fakeSlack } from './fakeSlack';
 import {
   ADMIN,
   ASSETS,
@@ -122,13 +123,12 @@
   resurfacedFromSkip: false,
 });
 
-/** Share to Slack stubs (build 5 session 44): handlers land in session 50. */
-const SLACK_STUB = 'session 50 (Share to Slack handlers)';
-const SLACK_NA = {
-  404: { na: `stub until ${SLACK_STUB}: no notification / asset lookup yet` },
-  429: { na: `stub until ${SLACK_STUB}: no system.ai.slack call yet` },
-  500: { na: `stub until ${SLACK_STUB}: handler makes no data-layer call` },
-  502: { na: `stub until ${SLACK_STUB}: no system.ai.slack call yet` },
+/** Share to Slack (build 5 session 50): fake system.ai.slack modes (fakeSlack.ts). */
+const slackMode = (mode: typeof fakeSlack.mode) => () => { fakeSlack.mode = mode; };
+/** A notification addressed to the steward role (stewards may share it). */
+const STEWARD_NOTIFICATION_ID = GEN(900);
+const addStewardNotification = (s: FakeStore) => {
+  s.notifications.push({ ...NOTIFICATIONS[1], id: STEWARD_NOTIFICATION_ID, userId: 'steward', status: 'sent', readAt: null });
 };
 const SHARE_BODY = { channelId: 'C0123ABCD', mode: 'draft', message: 'Please review.' };
 
@@ -607,20 +607,49 @@
     },
   },
 
-  // ── slack.ts (build 5: 501 stubs until session 50) ──
+  // ── slack.ts (build 5: contract session 44, handlers session 50) ──
   'POST /api/notifications/:id/share-slack': {
-    stub: SLACK_STUB,
-    happy: { params: { id: NOTIFICATIONS[0].id }, body: SHARE_BODY, expected: () => null },
-    errors: { 400: { params: { id: NOTIFICATIONS[0].id }, body: { channelId: 'C0123ABCD', mode: 'post' } }, ...SLACK_NA },
+    happy: {
+      params: { id: STEWARD_NOTIFICATION_ID },
+      body: SHARE_BODY,
+      setup: addStewardNotification,
+      expected: () => ({ status: 'drafted' }),
+      after: (s) => {
+        if (s.slackShares.length !== 1 || s.slackShares[0].status !== 'sent') throw new Error('expected one audit row');
+      },
+    },
+    errors: {
+      400: { params: { id: NOTIFICATIONS[0].id }, body: { channelId: 'C0123ABCD', mode: 'post' } },
+      // NOTIFICATIONS[0] is addressed to the reviewer: not visible to a steward.
+      404: { params: { id: NOTIFICATIONS[0].id }, body: SHARE_BODY },
+      429: { params: { id: STEWARD_NOTIFICATION_ID }, body: SHARE_BODY, setup: (s) => { addStewardNotification(s); slackMode('rate_limited')(); } },
+      502: { params: { id: STEWARD_NOTIFICATION_ID }, body: SHARE_BODY, setup: (s) => { addStewardNotification(s); slackMode('down')(); } },
+    },
   },
   'POST /api/assets/:assetId/share-slack': {
-    stub: SLACK_STUB,
-    happy: { params: { assetId: IDS.A1 }, body: SHARE_BODY, expected: () => null },
-    errors: { 400: { params: { assetId: 'not-a-uuid' }, body: SHARE_BODY }, ...SLACK_NA },
+    happy: {
+      params: { assetId: IDS.A1 },
+      body: SHARE_BODY,
+      expected: () => ({ status: 'drafted' }),
+      after: (s) => {
+        if (s.slackShares.length !== 1) throw new Error('expected one audit row');
+      },
+    },
+    errors: {
+      400: { params: { assetId: 'not-a-uuid' }, body: SHARE_BODY },
+      404: { params: { assetId: IDS.UNKNOWN }, body: SHARE_BODY },
+      429: { params: { assetId: IDS.A1 }, body: SHARE_BODY, setup: slackMode('rate_limited') },
+      502: { params: { assetId: IDS.A1 }, body: SHARE_BODY, setup: slackMode('down') },
+    },
   },
   'GET /api/slack/channels': {
-    stub: SLACK_STUB,
-    happy: { query: { query: 'data-stewards' }, expected: () => null },
-    errors: { 400: { query: { query: 'x'.repeat(201) } }, ...SLACK_NA },
+    happy: { query: { query: 'data-stewards' }, expected: () => FAKE_SLACK_CHANNELS },
+    errors: {
+      400: { query: { query: 'x'.repeat(201) } },
+      404: { na: 'only when GT_SLACK_SHARE_ENABLED=false (server/services/notification/slackShare.test.ts)' },
+      429: { query: {}, setup: slackMode('rate_limited') },
+      500: { na: 'handler makes no data-layer call (system.ai.slack only)' },
+      502: { query: {}, setup: slackMode('down') },
+    },
   },
 };
--- a/ground-truth-app/tests/contract/routes.contract.test.ts
+++ b/ground-truth-app/tests/contract/routes.contract.test.ts
@@ -10,6 +10,7 @@
 import { ErrorResponseSchema, ROUTE_CONTRACTS, routeKey } from '../../shared/contracts/schemas';
 import { ERROR_CODE_FOR_STATUS, callRoute, newEnv, userBelow } from './harness';
 import { ROUTE_CASES, errorPlan } from './routeCases';
+import { fakeSlack } from './fakeSlack';
 import type { CallInput } from './routeCases';
 
 vi.mock('../../server/services/sources', async (importOriginal) => ({
@@ -17,8 +18,24 @@
   SourceService: (await import('./fakeStore')).FakeSourceService,
 }));
 
+// Share to Slack (build 5 session 50): never call system.ai.slack from tests.
+vi.mock('../../server/services/notification/destinations/slackMcp', async (importOriginal) => {
+  const orig = await importOriginal<typeof import('../../server/services/notification/destinations/slackMcp')>();
+  const { AppError } = await import('../../server/lib/errors');
+  const { createFakeSlackClient } = await import('./fakeSlack');
+  return {
+    ...orig,
+    SlackMcpClient: createFakeSlackClient({
+      login: (url) => new orig.SlackLoginRequiredError(url),
+      rateLimited: () => new AppError('RATE_LIMITED', 'Slack rate limit reached; try again later', { retryAfterSeconds: 30 }),
+      down: () => new AppError('UPSTREAM_ERROR', 'system.ai.slack returned HTTP 503'),
+    }),
+  };
+});
+
 afterEach(() => {
   delete process.env.GT_EXEC_DASHBOARD_URL;
+  fakeSlack.mode = 'ok';
 });
 
 /** Input for a generated error case (errorPlan kind 'generated'): 401, 403 or 500. */
--- /dev/null
+++ b/ground-truth-app/tests/contract/fakeSlack.ts
@@ -0,0 +1,35 @@
+// tests/contract/fakeSlack.ts — fake system.ai.slack for the contract suite
+// Build 5 · Session 50 · test-only · No default export
+//
+// routes.contract.test.ts mocks SlackMcpClient with createFakeSlackClient();
+// cases switch `fakeSlack.mode` in setup (reset after each test). No server
+// imports here: the vi.mock factory loads this file while slackMcp is mocked.
+
+export const FAKE_SLACK_CHANNELS = [{ id: 'C0123ABCD', name: 'data-stewards' }];
+export const FAKE_SLACK_LOGIN_URL = 'https://example.cloud.databricks.com/slack/login';
+export const FAKE_SLACK_PERMALINK = 'https://acme.slack.com/archives/C0123ABCD/p1761600000000100';
+
+export const fakeSlack: { mode: 'ok' | 'login' | 'rate_limited' | 'down' } = { mode: 'ok' };
+
+interface Errors {
+  login: (url: string) => Error;
+  rateLimited: () => Error;
+  down: () => Error;
+}
+
+/** A SlackMcpClient stand-in class; `errors` builds the real error types. */
+export function createFakeSlackClient(errors: Errors) {
+  return class FakeSlackMcpClient {
+    constructor(opts: { token: string }) {
+      if (!opts.token) throw new Error('FakeSlackMcpClient: no OBO token');
+    }
+    private check(): void {
+      if (fakeSlack.mode === 'login') throw errors.login(FAKE_SLACK_LOGIN_URL);
+      if (fakeSlack.mode === 'rate_limited') throw errors.rateLimited();
+      if (fakeSlack.mode === 'down') throw errors.down();
+    }
+    async searchChannels() { this.check(); return FAKE_SLACK_CHANNELS.map((c) => ({ ...c })); }
+    async send() { this.check(); return { permalink: FAKE_SLACK_PERMALINK }; }
+    async draft() { this.check(); return {}; }
+  };
+}
```

Gotcha: keep the fake in its own file with no server imports. My first version put the fake client in `fakeStore.ts`, which imports `slackMcp`. The `vi.mock` factory then waited on itself (circular dynamic import), and vitest hung.

## Files modified

* `ground-truth-app/server/services/notification/destinations/slackMcp.ts` (new)
* `ground-truth-app/server/services/notification/destinations/slackMcp.test.ts` (new)
* `ground-truth-app/server/services/notification/slackShare.ts` (new)
* `ground-truth-app/server/services/notification/slackShare.test.ts` (new)
* `ground-truth-app/server/services/notification/notificationService.ts`
* `ground-truth-app/server/services/notification/index.ts`
* `ground-truth-app/server/routes/slack.ts`
* `ground-truth-app/server/routes/config.ts`
* `ground-truth-app/resources/app.app.yml`
