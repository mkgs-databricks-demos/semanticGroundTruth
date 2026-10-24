# 24 — Project memory, READMEs, gap status, theming runbook

**Wave 4 · edit · all bundles (docs only) · depends on 22, 23**

## Steps
1. `docs/plans/gap_analysis_2026-10.md`: add a "Status after build" column or section; mark G1, G2, G3, G6, G7, G8, G9, G17 Done / Partial with the run id and evidence (job run ids, gate output). Leave deferred gaps unchanged.
2. `docs/runbooks/ui_theming.md`: token table (pointer to `client/src/theme/tokens.ts` + `index.css`), how to add a component with tokens, how the contrast and static a11y tests work, where brand assets came from (`/Shared/brandfolder/`), and decision D1 (primary fill).
3. Root `PROJECT_MEMORY.md` status log entry dated this build; root and bundle READMEs: theme, executive dashboard, bronze refresh schedule, scope ACL variable, `deploy.sh` app SPN resolution.
4. `ground-truth-infra/PROJECT_MEMORY.md` and `ground-truth-app/PROJECT_MEMORY.md`: same facts, bundle-scoped.

## Done when
Wave 4 gate lines hold. Docs only; no code or YAML changes.
