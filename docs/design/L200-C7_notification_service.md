# L200-C7 — Notification Service

## Component Design Document

**Component:** C7 — Notification Service
**Type:** Pluggable notification destinations
**Owner:** TBD
**References:** L100 § Cross-Cutting Patterns, § Technology Decisions (Notifications)

---

### Overview

The Notification Service delivers alerts and updates to Data Stewards, Admins, and reviewers through configurable channels. It uses Databricks notification destinations for Slack and Microsoft Teams, with in-app notifications as the baseline.

### Dependencies

| Dependency | Type | Description |
|---|---|---|
| Databricks Notification Destinations (Bundle 1) | Infrastructure | Slack, Teams, webhook configurations |
| C1 Asset Registry | Data source | Notification delivery log |
| C6 Feedback Pipeline | Trigger | Feature branch ready alerts |
| C5 Campaign Manager | Trigger | New campaign notifications |

### Design

#### Notification Types

| Event | Recipients | Channels | Priority |
|---|---|---|---|
| Feature branch ready | Data Steward | Slack/Teams + in-app | High |
| Feedback pipeline failure | Data Steward + Admin | Slack/Teams + in-app | Critical |
| Confidence score regression | Data Steward | In-app | Medium |
| Coverage stall (48h no reviews) | Reviewers | In-app + Slack/Teams | Low |
| Campaign created | Assigned reviewers | In-app | Low |
| Certification achieved | Data Steward + Admin | Slack/Teams + in-app | Medium |
| Gamification milestone | Individual reviewer | In-app | Low |

#### Lakebase Schema

```sql
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      TEXT NOT NULL,
    recipient_type  TEXT NOT NULL CHECK (recipient_type IN ('user', 'group', 'role')),
    recipient_id    TEXT NOT NULL,
    channel         TEXT NOT NULL CHECK (channel IN ('in_app', 'slack', 'teams', 'webhook', 'email')),
    title           TEXT NOT NULL,
    body            TEXT,
    metadata_json   JSONB,
    status          TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'read')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ
);
```

#### Destination Configuration

Notification destinations are configured in Bundle 1 (Infra) using Databricks notification destination APIs. The app reads destination configurations and routes notifications accordingly.

### Non-Functional Requirements

| NFR | Target | Notes |
|---|---|---|
| Delivery latency | < 5 minutes | From trigger event to delivery |
| In-app notification | < 1s | Real-time via WebSocket or polling |
| Delivery reliability | 99% | Retry failed deliveries |

### Testing

- **Delivery tests:** Each channel type (Slack, Teams, in-app, webhook) delivers correctly
- **Routing tests:** Notifications reach correct recipients based on event type and role
- **Failure tests:** Failed deliveries are retried and logged

### Deployment

- Part of Bundle 2 (App) — Node.js service
- Notification destinations configured in Bundle 1 (Infra)
- Notification table created in Bundle 1

> See [docs/diagrams/mermaid/13_notification_routing.md] for the notification routing flowchart.

### Resolved Questions

1. ✅ **Yes — notification preferences in V1.** Users configure which event types they receive and through which channels. Default: all events via in-app; Data Stewards also get Slack/Teams for high-priority events.
2. ✅ **Digest mode for low-priority in V1.** Gamification milestones and campaign creation batched into daily digest. High-priority (pipeline failures, branch ready) always immediate.
3. ✅ **Email deferred to V2.** Slack + Teams + in-app covers primary use cases. Add when a customer specifically requires it.
