# Onboarding Users

How to add members, grant source access, register sources, and start campaigns in the Semantic Ground Truth App.

## Prerequisites

* The app (`dev-semantic-ground-truth`) is deployed and running.
* You have `admin` role in the app (member of `semantic-ground-truth-admins` app group).
* The M2M SPN (`semantic-ground-truth-m2m-dev`) has `CAN_USE` on the app.

---

## 1. Add a member to an app group

App roles are stored in Lakebase, not workspace SCIM groups. Three seeded groups:

| Group | Role | Who |
|---|---|---|
| `semantic-ground-truth-admins` | admin | App administrators |
| `semantic-ground-truth-stewards` | steward | Data stewards (create campaigns, import assets) |
| `semantic-ground-truth-users` | reviewer | All authenticated users (automatic; adding here is optional) |

**Via the app UI:**

1. Navigate to the **Admin** page → **Members** tab.
2. Select the group from the dropdown.
3. Enter the member's email address (lower-cased `x-forwarded-email` from Databricks) and click **Add**.

**Via the API (admin role required):**

```bash
curl -X POST "https://<app-url>/api/admin/groups/semantic-ground-truth-stewards/members" \
  -H "Content-Type: application/json" \
  -d '{"member_id": "user@example.com"}'
```

**Notes:**
* `admin` implies `steward`; stewards do not need to be in both groups.
* Every authenticated user with `CAN_USE` on the app is automatically a `reviewer`.
* Removing the last member of `semantic-ground-truth-admins` returns `409 CONFLICT`.
* For SPNs, `member_id` is the application id (UUID), not the email.

---

## 2. Grant app access (`CAN_USE`)

The `grant_app_permissions.ipynb` job (app bundle) grants `CAN_USE` to the workspace `users` group. For individual users or SPNs:

```bash
databricks apps update-permissions dev-semantic-ground-truth \
  --json '[{"user_name": "user@example.com", "permission_level": "CAN_USE"}]'
```

> **Never** add a `permissions` block to the app resource in `databricks.yml` — it replaces the entire ACL.

---

## 3. Grant the app SPN `CAN_READ` on a Git folder

When registering a Git folder as an asset source, the app SPN reads files from it. The SPN needs `CAN_READ` on the folder.

1. Find the app SPN identity. It changes on every destroy+redeploy; check the current one:
   ```bash
   databricks apps get dev-semantic-ground-truth --output json | jq '.service_principal_client_id'
   ```
2. Grant `CAN_READ` on the Git folder:
   ```bash
   databricks workspace update-permissions /Repos/<user>/<repo-name> \
     --json '[{"service_principal_name": "<spn-application-id>", "permission_level": "CAN_READ"}]'
   ```
3. If the grant fails with 403, the app returns `FORBIDDEN` with the SPN id and folder path.

---

## 4. Register a source and start a campaign

### Register a Git folder source (steward)

1. In the app, go to **Steward** page → **Sources** tab → **Register Source**.
2. Enter the workspace path (e.g., `/Repos/user/my-repo/fixtures/metric_views`).
3. Optionally set `display_name`, `metric_view_glob` (default `**/*.metric_view.yml`), and `glossary_glob` (default `**/semantics/**/*.md`).
4. Click **Register**.

**Via the API:**

```bash
curl -X POST "https://<app-url>/api/sources" \
  -H "Content-Type: application/json" \
  -d '{"workspace_path": "/Repos/user/repo", "display_name": "My Repo"}'
```

### Scan the source for candidates

```bash
curl -X POST "https://<app-url>/api/sources/<source-id>/scan"
```

Returns a list of metric-view YAML files and glossary terms found under the folder.

### Import assets and create a campaign

1. On the **Steward** page, select discovered assets from the scan results.
2. Click **Import** → assets are created/updated in the registry.
3. Click **Create Campaign** → select the imported asset IDs, set a title and deadline.
4. The campaign appears in the reviewer queue.

**Via the API:**

```bash
# Import
curl -X POST "https://<app-url>/api/assets/import" \
  -H "Content-Type: application/json" \
  -d '{"metric_views": ["catalog.schema.mv_name"], "source_id": "<uuid>"}'

# Create campaign
curl -X POST "https://<app-url>/api/campaigns" \
  -H "Content-Type: application/json" \
  -d '{"title": "Review Q4 metrics", "asset_ids": ["<uuid1>", "<uuid2>"], "deadline": "2026-12-01"}'
```

---

## Bootstrap admins

On first startup (when `semantic-ground-truth-admins` has no members), the app auto-inserts ids from:
* `GT_ADMIN_EMAILS` env var (comma-separated email list)
* `GT_BOOTSTRAP_ADMIN_IDS` env var (comma-separated application ids for SPNs)

Currently `GT_BOOTSTRAP_ADMIN_IDS` is hard-coded to the M2M SPN application id in `app.yaml`. After a non-delegated `bundle deploy`, this should be reverted to `valueFrom: m2m-client-id`.
