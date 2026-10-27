# Moved: agent build plans

> **Superseded (2026-10-24).** All build planning lives at the repo root in [`docs/plans/`](../../../docs/plans/INDEX.md), with one manifest, [`docs/plans/waves.json`](../../../docs/plans/waves.json). Don't add plans here.

The agent bundle's own manifest never ran: root build 2 sessions 05, 06 and 14 replaced it. The files were moved with `git mv`:

| Was | Now |
| --- | --- |
| `ground-truth-agent/docs/plans/0N_<topic>.md`, `INDEX.md` | `docs/plans/agent/` (same names, unchanged content) |
| `ground-truth-agent/docs/plans/waves.json` | `docs/plans/manifests/agent_superseded.json` (frozen, not in the root manifest) |
