# L300-10 — Node.js AppKit Backend (Review Engine + Campaign Manager + Notification Service)

## Implementation Spec

**Phase:** 2 (Bundle 2 — App)
**Type:** Genie Code session + manual coding
**Prerequisites:** L300-09 complete (app scaffold initialized)
**References:** L200-C2, L200-C5, L200-C7

---


> See [docs/diagrams/mermaid/07_component_topology.md] for how the backend components connect.
> See [docs/diagrams/mermaid/08_dual_interface_architecture.md] for the shared Review Engine API.
### Step 1: Create the project structure

**Type:** Manual (terminal)

```bash
cd bundle-app
mkdir -p src/{routes,services,models,middleware,utils}
mkdir -p src/services/{review,campaign,notification,asset}
```

### Step 2: Implement the Review Engine service

**Type:** Genie Code session

Prompt:
```
Create the Review Engine service in bundle-app/src/services/review/:

1. reviewEngine.js — Core service class with methods:
   - getNext(userId, campaignId?, assetType?) — Smart surfacing algorithm
   - vote(assetId, userId, voteType, feedback?, edits?) — Record vote + recompute Wilson score
   - addSynonym(assetId, userId, action, synonym) — Add/remove synonym
   - addExample(assetId, userId, action, questionText?, questionId?) — Manage example questions
   - getStats(userId) — User stats, leaderboard, coverage
   - runQuery(assetId, userId) — Execute sample query via OBO

2. wilsonScore.js — Wilson score interval computation:
   - wilsonLowerBound(positive, total, z=1.96) — Core formula
   - computeConfidence(assetId, industryPrior, priorDecayThreshold) — Blended score with prior

3. surfacingAlgorithm.js — Smart surfacing implementation:
   - getReviewPool(userId, campaignId?, assetType?) — Filter and weight assets
   - weightedRandomSelect(pool) — Coverage-weighted random selection

Use the Lakebase Postgres client (pg) for database access.
Use the Databricks SDK for OBO SQL execution.
```

### Step 3: Implement the Campaign Manager service

**Type:** Genie Code session

Prompt:
```
Create the Campaign Manager service in bundle-app/src/services/campaign/:

1. campaignManager.js — Service class with methods:
   - createCampaign(name, type, scope, rbacGroups?, freshnessInterval?) — Create campaign
   - getActiveCampaigns(userId?) — Get campaigns visible to user (respecting RBAC)
   - updateCampaignStatus(campaignId, status) — Pause/resume/complete/archive
   - checkCompletion(campaignId) — Check if all assets meet completion criteria
   - getAssetPool(campaignId) — Get assets in this campaign's scope
```

### Step 4: Implement the Notification Service

**Type:** Genie Code session

Prompt:
```
Create the Notification Service in bundle-app/src/services/notification/:

1. notificationService.js — Service class with methods:
   - send(eventType, recipientType, recipientId, title, body, metadata) — Route and deliver
   - getPreferences(userId) — Get user's notification preferences
   - updatePreferences(userId, preferences) — Update preferences
   - getUnread(userId) — Get unread in-app notifications
   - markRead(notificationId) — Mark as read

2. destinations/slackDestination.js — Slack webhook delivery
3. destinations/teamsDestination.js — Teams webhook delivery
4. destinations/inAppDestination.js — Lakebase insert for in-app notifications
```

### Step 5: Create the REST API routes

**Type:** Genie Code session

Prompt:
```
Create Express routes in bundle-app/src/routes/:

1. reviewRoutes.js — Maps to Review Engine API:
   GET  /api/review/next
   POST /api/review/vote
   POST /api/review/synonym
   POST /api/review/example
   GET  /api/review/stats
   POST /api/review/run-query

2. campaignRoutes.js — Maps to Campaign Manager:
   GET  /api/campaigns
   POST /api/campaigns
   PUT  /api/campaigns/:id/status
   GET  /api/campaigns/:id/assets

3. notificationRoutes.js — Maps to Notification Service:
   GET  /api/notifications
   PUT  /api/notifications/:id/read
   GET  /api/notifications/preferences
   PUT  /api/notifications/preferences

4. assetRoutes.js — Maps to Asset Registry:
   POST /api/assets/register — Registration API for DAB post-deploy hooks
   GET  /api/assets/:id
   GET  /api/assets/reviewable

5. adminRoutes.js — Admin configuration:
   GET  /api/admin/config
   PUT  /api/admin/config
   GET  /api/admin/leaderboard
```

### Step 6: Create middleware

**Type:** Genie Code session

Prompt:
```
Create middleware in bundle-app/src/middleware/:

1. auth.js — Extract OBO user identity from the forwarded token; 
   extract SP credentials for Lakebase writes
2. otel.js — OpenTelemetry trace context propagation for all requests
3. errorHandler.js — Graceful error handling with structured JSON responses
4. rateLimiter.js — Optional rate limiting (disabled by default, configurable)
```

### Step 7: Wire everything into server.js

**Type:** Genie Code session

Prompt:
```
Update bundle-app/server.js to:
1. Initialize the Databricks AppKit
2. Connect to Lakebase using the app's service principal
3. Register all route modules
4. Apply middleware (auth, otel, errorHandler)
5. Start the Express server on the AppKit-provided port
6. Health check endpoint at GET /health
```

---

### Open Questions

1. **AppKit Express integration:** Does `databricks apps init` with Node.js generate an Express app, or a different framework? The routes above assume Express.
2. **OBO token extraction:** How does the AppKit forward the OBO token? Is it in a header (`Authorization: Bearer <user-token>`) or an environment variable?
