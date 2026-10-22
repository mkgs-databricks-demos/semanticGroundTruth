# 15 — Docs: project memory, runbooks, READMEs

**Wave 5 · edit · owns `PROJECT_MEMORY.md`, `README.md`, `docs/runbooks/**`, `ground-truth-infra/PROJECT_MEMORY.md`, `ground-truth-infra/README.md`, `ground-truth-agent/PROJECT_MEMORY.md`, `ground-truth-agent/README.md`, `ground-truth-agent/docs/plans/INDEX.md`, `ground-truth-app/README.md`, `ground-truth-app/PROJECT_MEMORY.md`**

## Steps
1. Root `PROJECT_MEMORY.md`: status log entry for this build; RBAC model (app groups in Lakebase), asset sources/import, CDF + bronze schema, metric views over bronze, deploy order, M2M OAuth pattern for jobs; remove the stale "future `lb_*_history`" note.
2. `docs/runbooks/onboarding_users.md`: how an admin adds members in the app, how to grant the app SPN `CAN_READ` on a Git folder, how to register a source and start a campaign.
3. `docs/runbooks/cdf_bronze_operations.md`: CDF re-snapshot → full refresh of a flow; how new Postgres tables join bronze (YAML entry + next update).
4. Bundle READMEs/PROJECT_MEMORY: new resources (setup_lakebase_cdf job, cdf_bronze pipeline, metric view fixtures, demo_campaign_seed job, Genie space). Agent `docs/plans/INDEX.md`: note that the root manifest supersedes the agent `waves.json` (keep the file).
5. Do not touch `ground-truth-app/docs/plans/**`.

## Done when
Every new resource key from waves 0–4 is mentioned in its bundle README; links resolve to existing files.
