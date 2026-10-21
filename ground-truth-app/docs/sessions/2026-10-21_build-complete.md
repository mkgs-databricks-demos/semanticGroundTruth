# 2026-10-21 — Build complete: all 16 sessions passed

## Result

All 16 Genie Code sessions across 6 waves have passed their gate checks.
The Semantic Ground Truth App (Bundle 2) codebase is built on branch
`mg-genie-app-build-waves`. **177 files changed, +13,774 / −1,214 lines**
relative to the planning commit (`d2cbba2`).

## Build runs

| Run | Waves | Outcome |
|-----|-------|---------|
| `675802846673302` | 0 | w0 passed; sessions 3-16 used broken `{{input}}` — cancelled |
| `842455926421383` | 0-4 | w0-1 pass (by luck), w2 gate fail (session 07 collision), w3-5 excluded |
| `16400513324108` | 2-5 | w2-4 pass, w5 excluded (w4 gate failed on scaffold page fetch check) |
| `425081720670565` | 5 | w5 pass — **build complete** |

Total Genie Code compute: ~170 minutes across 3 partial runs. Would have been
~60 minutes in a single clean run.

## Commits on `mg-genie-app-build-waves`

| SHA | Content |
|-----|---------|
| `17d1ce9` | Wave 0: shared/contracts/ + server/lib/ (sessions 01, 02) |
| `f09c9e9` | Wave 1: migrations, middleware, asset registry, metric views, seed (03, 04, 05) |
| `bd5a77d` | Wave 2 partial: review engine + notifications (06, 08) |
| `d0a1d23` | Wave 2 complete: campaign manager added (07) |
| `4176e47` | Wave 3: REST routes, server.ts composition root, client API layer (09, 10) |
| `f63f486` | Wave 4: MCP server, review UX, secondary pages, agents (11, 12, 13, 14) |
| `6bac839` | Fix: wave 4 gate exclusion for scaffold pages + completed_at in migration 003 |
| `9ccba0b` | Wave 5: tests, scaffold cleanup, README, runbook (15, 16) |

## Problems encountered and root causes

### 1. `{{input.session_id}}` not reaching agents (runs 675802846673302, 842455926421383)
**Root cause:** The automation `user_prompt` listed parameter names without `{{}}`
template placeholders. The Genie Code runtime substitutes `{{param_name}}` from
`genie_task.parameters`, but the prompt had bare names like `- session_id` instead
of `- session_id: {{session_id}}`. Agents guessed their session from context.
Waves 0-1 passed by luck; wave 2 had a collision (two agents both ran session 08).
**Fix:** Commit `6ad4227` in the genie-build-waves bundle.

### 2. Schema `hls_fde_dev.dev_matthew_giglia_build_waves` didn't exist
**Root cause:** The setup job tried to publish UC Skills into a nonexistent schema.
**Fix:** Schema auto-creation added to setup notebook (commit `8a23ef7`).

### 3. Automation API body shape changed
**Root cause:** The setup notebook used flat body fields (`title`, `prompt`), but the
API now requires `parent_asset_name` at top level with `scheduled_insight` wrapper
using `display_name`/`user_prompt`. Updates need PATCH with `etag`+`update_mask`.
**Fix:** Commit `8a23ef7` in the genie-build-waves bundle.

### 4. UC Skills publish used wrong SDK methods
**Root cause:** Raw `api_client.do()` calls with wrong paths. The correct flow requires
`w.ai_gateway.create_skill()` with a `Skill` dataclass, `w.files.upload()`, then
`w.ai_gateway.finalize_skill()` with the `skills/` prefix. Pre-installed SDK 0.122.0
is too old; needs ~0.154+.
**Fix:** Commit `8a23ef7`.

### 5. `outcome` missing on If/else condition dependency
**Root cause:** Jobs API requires `"outcome": "true"` when a task depends on an
If/else `condition_task`. Setup notebook omitted it.
**Fix:** Commit `973ed14` in the genie-build-waves bundle.

### 6. Wave 4 gate failed on scaffold pages (run 16400513324108)
**Root cause:** The "no direct fetch" gate check flagged `jobs/JobsPage.tsx` and
`lakebase/LakebasePage.tsx`, which are scaffold pages that session 15 (wave 5)
deletes. The check could never pass at wave 4.
**Fix:** Commit `6bac839` — added exclusions for scaffold page directories.

### 7. `completed_at` column missing from migration 003
**Root cause:** Session 07's plan specified setting `completed_at` on campaign
completion, but migration 003 (session 03) didn't include the column.
**Fix:** Commit `6bac839` — added `completed_at TIMESTAMPTZ` to `app.campaigns`.

### 8. Run repair fails after bundle redeploy
**Observation:** Any `bundle deploy` replaces the build job's task list (via the
placeholder pattern), so the Jobs API refuses to repair older runs ("job structure
has changed"). Recovery requires starting a new run with `only:` targeting the
remaining waves.

## What's left before deploy

1. **Regenerate `pnpm-lock.yaml`** — 3 new dependencies added by session 02
2. **Run `tsc -b`** — TypeScript compilation was skipped in all sessions (no Node)
3. **Run `vitest`** — 7 new test files, never executed
4. **Resolve zod peer dependency** — `@modelcontextprotocol/sdk` may conflict with zod v4
5. **Deploy app bundle** — `databricks bundle deploy --target dev`
6. **Follow the runbook** — `docs/runbooks/first-deploy-verification.md` (12 steps)

## Files modified (this summary only)

- `docs/sessions/INDEX.md`
- `docs/sessions/2026-10-21_build-complete.md`
