# Moved: app build plans

> **Superseded (2026-10-24).** All build planning lives at the repo root in [`docs/plans/`](../../../docs/plans/INDEX.md), with one manifest, [`docs/plans/waves.json`](../../../docs/plans/waves.json). Don't add plans here.

The app bundle's own build (build 1, waves `1-0`..`1-8`, sessions `app-01`..`app-20`, run on 2026-10-20/21) was moved with `git mv`, so file history is preserved:

| Was | Now |
| --- | --- |
| `ground-truth-app/docs/plans/NN_<topic>.md` | `docs/plans/app/NN_<topic>.md` (unchanged content; paths inside are app-relative) |
| `ground-truth-app/docs/plans/INDEX.md`, `app_build_plan.md`, `build_conventions.md` | `docs/plans/app/` (same names) |
| `ground-truth-app/docs/plans/waves.json` | `docs/plans/manifests/build-1_app.json` (frozen) |

In the root manifest these sessions are `app-NN`, and their waves are archived.
