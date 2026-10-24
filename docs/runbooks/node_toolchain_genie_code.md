# Runbook: Node.js + pnpm toolchain in Genie Code serverless

Repeatable pattern for running `pnpm install`, `pnpm add`, `vitest`, `tsc` and `pnpm audit` from a Genie Code session (interactive or a build-wave `genie_task`) on serverless compute.

* **First used:** 2026-10-21 (lockfile regeneration, [ground-truth-app/docs/sessions/2026-10-21_first-deploy-planning.md](../../ground-truth-app/docs/sessions/2026-10-21_first-deploy-planning.md)).
* **Re-verified:** 2026-10-24, interactive Genie Code session on serverless (evidence below).
* **Still to prove:** inside a build-wave `genie_task`. Session 26 (build 4, wave `4-0`) runs this runbook first and records the result in its status file.

## Why it is needed

Serverless ships a bare Node `v22.9.0` at `/usr/local/bin/node`. `npm`, `npx` and `corepack` are broken symlinks into `/usr/local/lib/node_modules/`, which is stripped from the image. pnpm 11 needs Node `>= 22.13`, and `corepack` 0.29.3 has a stale registry signing key. So: install a private Node with `nodeenv`, then install pnpm with that Node's npm.

## Steps

Run in one shell (each step depends on `PATH`). Total time on 2026-10-24: 8 s.

```bash
pip install -q nodeenv
python -m nodeenv --node=22.16.0 --prebuilt /tmp/node2216
export PATH=/tmp/node2216/bin:$PATH
node --version            # v22.16.0
npm --version             # 10.9.2
npm install -g pnpm@11.0.8 --force
pnpm --version            # 11.0.8
```

`/tmp` does not survive a compute restart. Every new shell must `export PATH=/tmp/node2216/bin:$PATH`; if `/tmp/node2216` is gone, rerun the steps.

## Use it on the app

```bash
export PATH=/tmp/node2216/bin:$PATH
cd ground-truth-app
pnpm install --frozen-lockfile     # proves package.json and pnpm-lock.yaml agree
pnpm exec vitest run
pnpm exec tsc -b tsconfig.server.json
pnpm exec tsc -b tsconfig.client.json
```

Rules:

* **Parallel build sessions share the Git folder.** Only the session that owns `package.json` / `pnpm-lock.yaml` installs in the repo. Every other session copies `ground-truth-app/` to `/tmp/gt-<session_id>/` and runs install/test/tsc there, so two sessions never race on `node_modules/`.
* **Never commit `node_modules/`.** It is in `.gitignore`; check `git status` before committing. For dependency experiments, copy the app to `/tmp` first (exclude `node_modules`, `.venv`, `dist`, `.databricks`) and work there.
* **Lockfile changes:** run `pnpm add` / `pnpm update` in the repo, then `pnpm install --frozen-lockfile` again; commit `package.json` and `pnpm-lock.yaml` together, only if the frozen install, `vitest run` and both `tsc -b` pass.
* `.npmrc` keeps `enable-pre-post-scripts=true` (pnpm 11 needs it for the `prebuild` typegen). Do not add a registry override.
* `pnpm run build` runs `prebuild` (`appkit generate-types --wait`), which needs a warehouse connection. Use `tsc -b` + `vitest run` locally; the Apps build is the full build.

## Evidence (2026-10-24, temp copy of `ground-truth-app` at `0741bc7`)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Done in 9.6 s |
| `pnpm exec vitest run` | 21 files, 331 tests passed (3.8 s) |
| `tsc -b tsconfig.server.json` / `tsconfig.client.json` | exit 0 / exit 0 |
| `pnpm list @modelcontextprotocol/sdk zod` | sdk 1.32.1, zod 4.3.6 |
| `pnpm audit` | 42 vulnerabilities: 1 critical, 17 high, 18 moderate, 6 low |
| `pnpm add @modelcontextprotocol/ext-apps` (latest) | 2.0.3, peers `@modelcontextprotocol/core`, `client`, `server` `^2.0.0` (MCP TypeScript SDK v2 split packages): unmet with sdk 1.x |
| `@modelcontextprotocol/ext-apps@1.7.5` peers | `@modelcontextprotocol/sdk ^1.29.0`, `zod` 3.25+ or 4, React 17-19: compatible with the current app |
| `pnpm add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom vitest-axe msw` | Resolved (16.3.3, 14.6.8, 7.0.1, 30.1.3, 0.1.0, 3.0.3); `pnpm peers check` flags msw and tailwindcss; 331 tests still pass |

Nothing from the experiment was committed; it ran in `/tmp/gt`.
