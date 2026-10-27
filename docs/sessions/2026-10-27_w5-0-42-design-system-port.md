# Session 42 · wave 5-0 · Design-system port (tokens, icons, primitives)

* **Build 5 run:** `229891579528310` · branch `mg-genie-build-5` · mode `edit`
* **Plan:** `docs/plans/build-5/42_design_system_port.md`
* **Status:** `blocked`. Everything in scope is done and tested except one manual step: 6 catalog icon SVGs could not be downloaded from this session (see Blocking).

## Changes

1. **Tokens (D-B5-1).** `client/src/theme/tokens.ts` and `client/src/index.css`: Green 600 `#00A972`, Yellow 500 `#FCBA33`, Maroon 500 `#AB4057`, Maroon 300 `#D69EA8`. New semantic token `warning-text` (light Yellow 800 `#7D5319`, dark Yellow 600 `#FFAB00`) in both maps, both CSS blocks, and the Tailwind theme (`--color-warning-text`). Also mapped `--color-info` (AppKit does not map `--info`, and the new primitives use `text-info`). The existing "Warning text" contrast pairs now read `warning-text`.
2. **Parity.** `client/src/theme/figma-variables.json` is a byte copy of `docs/design/ui/figma/design-system/variables.json`. `tokens-parity.test.ts` checks: every Figma key in both modes equals `tokens.ts` and `index.css`; every `tokens.ts` semantic token equals `index.css`; `--dbx-*` primitives equal `brand` in both directions; the copy is byte-identical to the docs file (skipped when `docs/` is not there). Result: 0 mismatches.
3. **Contrast.** `contrast.test.ts` now also covers `vote-*`, `confidence-*` and `warning-text`, in both modes: text on card ≥ 4.5:1, non-text on background and card ≥ 3:1, and `warning-text` text on background ≥ 4.5:1. All pass. None of the 4 corrected primitives is used in a text or non-text pair the app renders (they are only `chart-3/4/5`), so no `blocked` for contrast.
4. **Icons.** The 47 non-symbol SVGs from `docs/design/ui/figma/_code/src/assets/brand/` were copied byte for byte to `client/public/brand/icons/` (the two Databricks symbols stay in `client/public/brand/`). `icons.manifest.json` has 55 entries `{ name, kind, file, attachment_id, source, downloaded, use }`; all ids come from `/Workspace/Shared/brandfolder/assets.csv`. All 6 icons the export README listed without ids are in the catalog: `copyIcon` `cj8fwgs34skzjpp3gm6tjtg`, `fileCodeIcon` `mzvjwx43t4nt97hkgsq3q6`, `arrowUpIcon` `69j5tbsn78xqf685f5gc6hh`, `arrowDownIcon` `2s7cnmwxmrb9fp9v7qkcq74`, `SendIcon` `7vm9ttgr6m36q8nn5bzwg5t`, `FolderBranchIcon` `nq6rwnj8shmnrc4bgnhqxfgh`. No substitutes were needed.
5. **Primitives** in `client/src/components/ui/` (barrel `index.ts`): `Icon` (CSS mask + `currentColor`, `CanvasText` under forced colors, `aria-hidden` unless `label`, then `role="img"`; typed `IconName` from `ICON_FILES`), `Badge`, `StatusBadge` (text + icon), `Skeleton` / `SkeletonGroup` (one `role="status"` label), `InlineAlert` (`role="alert"`, Retry), `EmptyPanel` (navy/white primary illustration), `ToastRegion` + `useToasts` (always-mounted `role="status"` region), `Sheet` (AppKit/Radix wrapper, required title), `RadioCardGroup` (native radios in a fieldset), `DiffText` + `diffWords` (word-level LCS, `<ins>`/`<del>` with screen-reader markers), `KeyHint` (`<kbd>`, spoken arrow names). No new dependency, no `lucide-react`, no hex or palette classes. Styling uses semantic tokens only.
6. **Tests:** `ui-primitives.test.tsx` (each primitive in light and dark with axe; keyboard for InlineAlert, Toast, Sheet, RadioCardGroup; `diffWords` unit cases) and `icons-manifest.test.ts` (ids or substitutes, files exist, `ICON_FILES` equals the manifest, the export's SVGs are all listed, no `https://` outside comments in non-test `client/src`).

## Decisions

* Status badges and alerts draw status colors as text on `bg-card` with a tinted border, not on a tinted fill, because text-on-card is the pair the contrast test proves.
* `ICON_FILES` only offers icons whose SVG is committed, so no component can point at a missing file. The 6 pending icons are in the manifest with `downloaded: false`.
* The CDN check skips `client/src/test/**` and `*.test.*` (test fixtures are not shipped). `client/src/test/fixtures/executive.ts` (session 43) has a dashboard URL in mock data.

## Findings for the owner (no change made)

* `vote-approve` / `confidence-high` / `success` (Green 700 `#00875C`) on light `background` (Oat Light) is 4.25:1. That is fine for non-text (≥ 3:1) and for text on cards (4.55:1), which is how the app uses them today (SwipeActions and ExampleQuestions are inside the review card). These tokens must not be used as text directly on the page background. Changing the value is an owner decision (D-B5-1: sessions do not pick colors).

## Checks

| Check | Result |
| --- | --- |
| `vitest run client/src/components/ui client/src/theme` (shared tree in `/tmp/gt-42`, `docs/` copied in) | 5 files, 283 tests pass, 0 skipped |
| Full `vitest run` + both `tsc -b` on HEAD `08766ac` plus only session 42's owned files (`/tmp/gt-42h`) | 40 files, 1071 tests pass; server and client `tsc -b` exit 0 |
| Full `vitest run` / `tsc -b` on the shared working tree (`/tmp/gt-42`) | Fails only in other sessions' files that were mid-edit: `client/src/test/**` fixtures (43), `shared/contracts` + `tests/contract` (44), `@mlflow/core` not in the lockfile yet (45). None in session 42 files |
| `a11y-static.test.ts` (session 43 owns it; not edited) | pass (161 tests incl. the new `components/ui` files) |
| `pnpm install --frozen-lockfile` | pass (HEAD lockfile) |

Runs used the Node toolchain of `docs/runbooks/node_toolchain_genie_code.md` (Node 22.16.0, pnpm 11.0.8).

## Blocking (manual prerequisite)

The 6 catalog-only SVGs could not be downloaded: the Genie Code safety guardrail blocks requests to `cdn.bfldr.com` from this session, and `src/notebooks/download_brand_assets` only downloads the symbols and favicons. To unblock (about 5 minutes):

1. Download each file once from `https://cdn.bfldr.com/9AYANS2F/at/<attachment_id>/<filename>` (ids above, also in `icons.manifest.json`) into `ground-truth-app/client/public/brand/icons/`.
2. In `icons.manifest.json` set `downloaded: true` for the 6 entries (and drop the `pending` note).
3. Add `copy`, `fileCode`, `arrowUp`, `arrowDown`, `send`, `folderBranch` to `ICON_FILES` in `client/src/components/ui/Icon.tsx`. `icons-manifest.test.ts` fails until steps 2 and 3 agree, and checks the files exist.

## Files

* `ground-truth-app/client/src/theme/tokens.ts`, `contrast.test.ts` (edited); `tokens-parity.test.ts`, `figma-variables.json` (new)
* `ground-truth-app/client/src/index.css` (edited)
* `ground-truth-app/client/src/components/ui/`: `Icon.tsx`, `Badge.tsx`, `StatusBadge.tsx`, `Skeleton.tsx`, `InlineAlert.tsx`, `EmptyPanel.tsx`, `Toast.tsx`, `Sheet.tsx`, `RadioCardGroup.tsx`, `DiffText.tsx`, `KeyHint.tsx`, `index.ts`, `ui-primitives.test.tsx`, `icons-manifest.test.ts` (new)
* `ground-truth-app/client/public/brand/icons/`: 47 SVGs + `icons.manifest.json` (new)

## Notes for the integrator

* The SVGs and `figma-variables.json` were copied with a Python byte copy (`shutil.copyfile`) instead of the file-edit tool, because the parity test requires a byte-identical copy and 47 binary-exact SVG copies through the edit tool would risk changing bytes. Everything else was written with the workspace file tools.

## Requests

* **Owner:** download the 6 SVGs (Blocking above).
* **Owner:** decide whether Green 700 needs a darker text variant on Oat Light (Findings).
* **Session 43:** `client/src/test/fixtures/executive.ts` and `feedbackBranches.ts` need `slackShareEnabled` / `htmlUrl` from session 44's contracts for `tsc -b` client to pass in the shared tree (seen while the wave was running; may already be fixed).
