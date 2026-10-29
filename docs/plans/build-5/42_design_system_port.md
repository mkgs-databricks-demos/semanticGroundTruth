# Session 42: Design-system port (tokens, icons, primitives)

**Build 5 · wave `5-0` · edit (parallel)**

## Context

Precondition 3 of `docs/design/ui/build5_outline.md` fails today: `variables.json` and `client/src/theme/tokens.ts` differ in 4 brand primitives and 1 missing token (see build-5 conventions §2 D-B5-1). The owner decided that the Figma / brand values win.

## Steps

1. **Tokens.** In `client/src/theme/tokens.ts` set Green 600 `#00A972`, Yellow 500 `#FCBA33`, Maroon 500 `#AB4057`, Maroon 300 `#D69EA8`. Mirror them in `client/src/index.css` (`--dbx-*` primitives). Add `warning-text` (light Yellow 800, dark Yellow 600) to both semantic maps, `index.css` and the Tailwind theme mapping.
2. **Parity test.** Copy `docs/design/ui/figma/design-system/variables.json` verbatim to `client/src/theme/figma-variables.json` (the Apps build and `/tmp` copies only contain `ground-truth-app/`). Add `client/src/theme/tokens-parity.test.ts`: asserts every key in both modes of `figma-variables.json` equals the `tokens.ts` value, and that the copy is byte-identical to the docs file when the docs file is reachable (skip that one check otherwise). Also assert `index.css` primitives equal `tokens.ts` primitives.
3. **Contrast.** Extend `client/src/theme/contrast.test.ts` with the vote tokens (`vote-*`), confidence tokens (`confidence-*`) and `warning-text` on `background`/`card`, both modes (≥ 4.5:1 text, ≥ 3:1 non-text). If a corrected primitive fails a pair the app uses, stop `blocked` with a `request` (do not pick colors).
4. **Icons.** Copy the Databricks SVGs the export uses (`docs/design/ui/figma/_code/src/assets/brand/*.svg`) to `client/public/brand/icons/`. Write `client/public/brand/icons/icons.manifest.json`: `{ name, file, attachment_id, source }` per icon, ids from `/Workspace/Shared/brandfolder/assets.csv`. Look up the 6 icons without ids (`copyIcon`, `fileCodeIcon`, `arrowUpIcon`, `arrowDownIcon`, `SendIcon`, `FolderBranchIcon`); download from the catalog CDN URL once if not in the export; if absent from the catalog, pick the closest catalog icon and set `source: "substitute:<name>"`.
5. **Primitives** in `client/src/components/ui/`: `Icon` (CSS `mask-image: url(/brand/icons/<file>.svg)` with `background-color: currentColor`, so no new dependency such as svgr; `aria-hidden` unless `label`, then `role="img"` + `aria-label`; typed `IconName` union from the manifest; under `@media (forced-colors: active)` use `background-color: CanvasText` so icons stay visible), `Badge`, `StatusBadge` (text + icon, never color only), `Skeleton`, `InlineAlert` (`role="alert"`, Retry), `EmptyPanel`, `Toast` live region (`role="status"`), `Sheet`, `RadioCardGroup`, `DiffText` (`<ins>`/`<del>`), `KeyHint`. Port the visual spec from `_code/src/components/BrandAssets.tsx` and `DesignSystemPage.tsx`. Each primitive has a test (render light + dark, axe, keyboard where interactive).
6. Run `pnpm exec vitest run` and both `pnpm exec tsc -b` in the `/tmp/gt-42/` copy.

## Acceptance

* `tokens-parity.test.ts` passes (0 mismatches); extended `contrast.test.ts` passes.
* `icons.manifest.json` lists every icon used by the export with an id or an explicit substitute.
* No runtime CDN URL in `client/**` (grep `https://` in `client/src` returns only documentation links).
* `a11y-static.test.ts` still passes (it is owned by session 43; do not edit it).

## Owned paths

* `ground-truth-app/client/src/theme/**` except `a11y-static.test.ts`
* `ground-truth-app/client/src/index.css`
* `ground-truth-app/client/src/components/ui/**`
* `ground-truth-app/client/public/brand/**`

## Dependencies

None.
