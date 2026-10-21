# Session 08: Notification Service

**Wave:** 2 · **Run:** 842455926421383 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Implemented `server/services/notification/` with 8 files: event-driven notification creation, per-user preference management, in-app inbox (list/mark-read/unread-count with role-addressed visibility), digest batching for low-priority outbound events, and three webhook destinations (Slack, Teams, generic) that are inactive unless their respective env vars are set. No `app.yaml` or `resources/` changes. All domain events subscribed via the shared `EventBus`; no imports from `review/` or `campaign/` services.

## Files Created

| File | Exports | Purpose |
|---|---|---|
| `server/services/notification/routing.ts` | `PRIORITY`, `resolveChannels()` | Pure priority map (high: feedback.*/asset.certified; low: campaign.*/vote.milestone) and channel + digest resolution |
| `server/services/notification/destinations/types.ts` | `Destination` (interface) | Channel-aware send contract; `enabled()` checks env var |
| `server/services/notification/destinations/slack.ts` | `SlackDestination` | `SLACK_WEBHOOK_URL`; `*title*` + body Slack markdown |
| `server/services/notification/destinations/teams.ts` | `TeamsDestination` | `TEAMS_WEBHOOK_URL`; MessageCard `{title, text}` |
| `server/services/notification/destinations/webhook.ts` | `WebhookDestination` | `GENERIC_WEBHOOK_URL`; raw JSON `{title, body?, link?}` |
| `server/services/notification/notificationService.ts` | `NotificationService` | Constructor `(deps: ServiceDeps, destinations?: Destination[])`. Methods: `enabledChannels`, `notify`, `list`, `unreadCount`, `markRead`, `getPreferences`, `updatePreferences`, `flushDigests`, `subscribe` |
| `server/services/notification/index.ts` | barrel | Re-exports `NotificationService`, `PRIORITY`, `resolveChannels`, `SlackDestination`, `TeamsDestination`, `WebhookDestination` |
| `server/services/notification/routing.test.ts` | — | 8 vitest tests for `PRIORITY` and `resolveChannels` (written, not run) |

## Exported Signatures

```ts
// routing.ts
export const PRIORITY: Record<NotificationEventType, 'high' | 'low'>;
export function resolveChannels(
  eventType: NotificationEventType,
  prefs: NotificationPreference | undefined,
  enabled: NotificationChannel[],
): { channels: NotificationChannel[]; digest: boolean };

// destinations/types.ts
export interface Destination {
  readonly channel: NotificationChannel;
  enabled(): boolean;
  send(n: { title: string; body?: string; link?: string }): Promise<void>;
}

// notificationService.ts
export class NotificationService {
  constructor(deps: ServiceDeps, destinations?: Destination[]);
  enabledChannels(): NotificationChannel[];
  notify(input: {
    eventType: NotificationEventType;
    recipientType: 'user' | 'role';
    recipientId: string;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Notification[]>;
  list(userId: string, opts?: { unreadOnly?: boolean; limit?: number; roles?: Role[] }): Promise<Notification[]>;
  unreadCount(userId: string, roles?: Role[]): Promise<number>;
  markRead(userId: string, ids: string[] | 'all', roles?: Role[]): Promise<number>;
  getPreferences(userId: string): Promise<NotificationPreference[]>;
  updatePreferences(userId: string, prefs: Array<{ eventType: NotificationEventType; channels: NotificationChannel[]; digest: boolean }>): Promise<NotificationPreference[]>;
  flushDigests(): Promise<number>;
  subscribe(): void;
}
```

## Checks

| Check | Result |
|---|---|
| `databricks bundle validate --strict --target dev` | pass |
| No `app.yaml` / `resources/**` edits | pass (static) |
| No imports from `server/services/review` or `server/services/campaign` | pass (static) |
| Channel values limited to `in_app\|slack\|teams\|webhook` | pass (static; types from shared/contracts/values) |
| Status values per migration CHECK (`pending\|sent\|failed\|read`) | pass (static) |
| `enabledChannels()` returns `['in_app']` when no webhook env vars set | pass (static; dest.enabled() reads env at call time) |
| Every relative import resolves to an existing file | pass (19 imports verified) |
| TypeScript compilation | skipped (no Node toolchain) |
| vitest test execution | skipped (no Node toolchain) |

## Decisions

* **No `recipient_type` column.** Migration 004 has `recipient_id TEXT` but no `recipient_type`. Role-addressed notifications store the role name (`'steward'`, `'reviewer'`) in `recipient_id`. The `list`/`unreadCount`/`markRead` queries use `recipient_id = $userId OR recipient_id = ANY($roles)` to surface both user-addressed and role-addressed notifications. This avoids needing a schema change.
* **Shared read state for role notifications.** When `markRead` is called, role-addressed notifications are marked read for all holders of that role. Per-user read tracking would require an additional junction table; acceptable for V1.
* **Notification entity `userId` field.** For role-addressed rows, `Notification.userId` contains the role name (e.g. `'steward'`), not a user ID. This is a mapping oddity from the entity interface (session 01); documented but not changed (outside owned paths).
* **Digest is per-batch, not per-user.** `flushDigests()` groups pending rows by `recipient_id + channel` and sends one digest message per group. In role-addressed scenarios, the digest goes to the role's outbound channel.
* **fetch with AbortSignal.timeout(10s)** used in all three destinations per the plan spec. Global `fetch` is available on Node ≥18.
* **JSONB insert:** metadata is passed as `JSON.stringify(val)` with `$N::jsonb` cast to ensure correct Postgres handling regardless of the AppKit lakebase driver’s implicit casting.

## Assumptions

* `EventBus.on` and `EventBus.emit` work as documented (handlers fire-and-forget, errors logged by the bus).
* The AppKit lakebase driver correctly handles `TEXT[]` array params and `::jsonb` casts.
* Session 09 (REST routes) will wire `NotificationService` via the composition root and expose `/api/notifications/*` endpoints.

## Race Condition Note

Due to the `genie_task` for_each platform race, multiple iterations may have claimed session 08 (see `claim_08`). This iteration reviewed the code produced by the earlier-finishing iteration, found one bug, and applied a correction:

* **`deliverWithRetry` loop bounds (notificationService.ts):** The original loop ran `for (let attempt = 0; attempt < RETRY_DELAYS.length; ...)` — only 3 total attempts with delays at positions 0 and 1 (1 s, 2 s). The 4 s delay was never used. Fixed to `attempt <= RETRY_DELAYS.length` — 4 total attempts (initial + 3 retries) with all three delays (1 s / 2 s / 4 s), matching the plan spec.

The integrator should verify the final disk state of `notificationService.ts` for consistency.

## Requests

None.
