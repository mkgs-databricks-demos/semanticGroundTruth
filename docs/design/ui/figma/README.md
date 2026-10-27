# Semantic Ground Truth — Figma Make export

- **Figma file URL:** https://www.figma.com/make/QtXG8JU0oWrP99lnGVdeNE/Semantic-Ground-Truth---Build-5?t=Jx4EQL6hpvXLZfHY-1&preview-route=%2Freview
- **Preview URL:** https://www.figma.com/make/QtXG8JU0oWrP99lnGVdeNE/Semantic-Ground-Truth---Build-5?t=Jx4EQL6hpvXLZfHY-20&fullscreen=1&preview-route=%2Freview
- **Export date:** 2026-10-27
- **Header variant:** A
- **Source brief:** `docs/design/ui/figma_make_brief.md`

`_code/` is the complete generated React reference export. Build 5 must port it into `ground-truth-app/client/src/**`; production code must not import from `docs/`. The official Section 4 assets with published attachment IDs are bundled under `_code/public/brand/`.

Chromium exported 218 routed state/theme screenshots at 2x, including populated
390px mobile frames. The standalone Shell-only preview is not present in the
retained routed source, so its populated, loading, notifications-empty,
notifications-error, and offline frame matrix remains pending. The reference
components use the bundled official symbols, product marks, primary
illustrations, and functional icons. Section 4 does not publish attachment IDs
for `copyIcon`, `fileCodeIcon`, `arrowUpIcon`, `arrowDownIcon`, `SendIcon`, or
`FolderBranchIcon`, so those six require a brand-catalog lookup.
