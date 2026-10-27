# Session 60: Converge app: deploy build 5, probes, soak, bundle budget

**Build 5 · wave `5-7` · converge (alone) · target `app`; the wave gate also checks `app_deploy_verification`**

## Steps

1. In `/tmp/gt-60/`: `pnpm install --frozen-lockfile`, `pnpm exec vitest run`, both `pnpm exec tsc -b`, `pnpm build`, `node scripts/check-bundle-size.mjs` (entry chunk ≤ 350 kB gzip). Over budget: split further (lazy routes, move framer-motion out of the entry if possible); do not raise the budget.
2. **Strict-marker coverage:** the `a11y-static` report lists no file under `client/src/pages/**` or `client/src/components/**` without `// @a11y-strict`. Remaining files: bring them up to the strict rules (icons, test ids, one `<h1>`), within this session.
3. If no `lucide-react` import remains in `client/src`, remove the dependency (`pnpm remove lucide-react`) and re-run step 1.
4. Deploy from `ground-truth-app`: `bundle deploy --target dev`, then `bundle run app --target dev`. **Follow-up 10:** if `bundle deploy` fails with "Invalid delegation claim", spend at most one attempt finding the drift (`bundle plan` / `bundle deploy --debug`: which field of the app is planned to change; usually a redacted `config.env` value); fix it in `resources/app.app.yml` if it is a config difference, otherwise record the finding and continue with `bundle run app`.
5. Runtime gate: the build-5 probes pass (the 8 from build 4 plus `/settings` and `/steward/feedback-branches` returning the SPA `index.html`, and `/api/config` containing `"slackShareEnabled"`).
6. `bundle run deploy_verification --target dev` passes.
7. Soak 10 min, 0 errors, ≥ 1 trace.

## Stable when

App `RUNNING` on a deployment from this run, probes pass, soak clean, `deploy_verification` passes, bundle budget met.

## Owned paths

* `ground-truth-app/**` (excluding `ground-truth-app/.build-status/**`, `ground-truth-app/.databricks/**`, `ground-truth-app/docs/plans/**`)

## Dependencies

45, 49, 50, 51, 52, 53, 54, 55, 56
