# Session 08: Notification Service (L200-C7)

## Scope
Implement `NotificationService`: event-driven notification creation, per-user preferences, in-app inbox (list / mark read / unread count), digest batching for low-priority events, and outbound destinations for Slack, Teams and generic webhooks that are **inactive unless their env var is set**. No routes (session 09).

## Context
* `../docs/design/L200-C7_notification_service.md` (schema, resolved questions: preferences in V1, digest for low priority, email deferred).
* `build_conventions.md` §5 decision 5 (env vars `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`, `GENERIC_WEBHOOK_URL`; no `app.yaml` changes), §7 (`DomainEvent`, `EventBus`, `ServiceDeps`).
* Tables `app.notifications`, `app.notification_preferences`, `app.campaigns`, `app.assets`, `app.votes` (session 03). DTOs `Notification`, `NotificationPreference`, `UpdatePreferencesBody` (session 01).

## Tasks
1. `server/services/notification/routing.ts` (pure): `PRIORITY: Record<NotificationEventType, 'high' | 'low'>` (`feedback.*` + `asset.certified` high; `campaign.created`, `campaign.completed`, `vote.milestone` low) and `resolveChannels(eventType, prefs: NotificationPreference | undefined, enabled: NotificationChannel[]): { channels: NotificationChannel[]; digest: boolean }` (default `['in_app']`, low priority defaults to digest for non-in-app channels; only channels in `enabled`).
2. `server/services/notification/destinations/types.ts` — `interface Destination { channel: NotificationChannel; enabled(): boolean; send(n: { title: string; body?: string; link?: string }): Promise<void> }`.
3. `destinations/slack.ts` (`{ text }` payload with `*title*` + body), `destinations/teams.ts` (MessageCard-style `{ title, text }`), `destinations/webhook.ts` (raw JSON). Each reads its URL from env at call time, uses global `fetch` with a 10 s `AbortSignal.timeout`, and throws on non-2xx. Never log the URL.
4. `server/services/notification/notificationService.ts` — `class NotificationService { constructor(deps: ServiceDeps, destinations?: Destination[]) }`:
   * `enabledChannels(): NotificationChannel[]` (`in_app` + destinations whose `enabled()`).
   * `notify(input: { eventType; recipientType: 'user' | 'role'; recipientId: string; title: string; body?: string; metadata?: Record<string, unknown> }): Promise<Notification[]>` — one row per resolved channel; `in_app` rows inserted with `status = 'sent'`; outbound rows `pending`, then delivered immediately unless digest (retry up to 3 times with 1 s/2 s/4 s backoff, then `failed`).
   * `list(userId, opts: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]>`, `unreadCount(userId): Promise<number>`, `markRead(userId, ids: string[] | 'all'): Promise<number>`.
   * `getPreferences(userId)`, `updatePreferences(userId, prefs)`.
   * `flushDigests(): Promise<number>` — group pending digest rows per recipient+channel into one message; mark `sent`.
   * `subscribe(): void` — `asset.certified` -> notify role `steward` (recipient_type `role`, recipient_id `steward`); `campaign.created` / `campaign.completed` -> role `reviewer`; `vote.milestone` -> the user. Look up names for titles.
   * Role-addressed in-app notifications are visible to any user holding that role (`list` matches `recipient_type='user' AND recipient_id=$userId OR recipient_type='role' AND recipient_id = ANY($roles)`): add an optional `roles: Role[]` param to `list`/`unreadCount`/`markRead`.
5. `server/services/notification/index.ts` — barrel exporting `NotificationService`, `PRIORITY`, `resolveChannels`, destination classes `SlackDestination`, `TeamsDestination`, `WebhookDestination`.
6. Vitest test (written, not run): `routing.test.ts`.

## Acceptance Criteria
- [ ] With no webhook env vars set, `enabledChannels()` returns `['in_app']` and no `fetch` is attempted.
- [ ] Channel values limited to `in_app|slack|teams|webhook`; status values per migration CHECK.
- [ ] No `app.yaml` / `resources/**` edits.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/services/notification/**`

## Dependencies
- Sessions 01, 02 (wave 0); 03 (wave 1). Parallel with 06, 07 — do not import their modules; react only to `DomainEvent`s.
