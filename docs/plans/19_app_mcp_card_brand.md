# 19 — App MCP card brand (light + dark)

**Wave 0 · edit · bundle `ground-truth-app` · gap G9**

## Context
`server/mcp/views/cardHtml.ts` renders the MCP App review card as self-contained HTML. It inlines hex values (`#f8f9fa` is off-brand; Lava/Navy are correct) and has no dark variant. Genie One controls the host theme, so the card must follow `prefers-color-scheme`.

## Steps
1. Move every color into CSS custom properties at the top of the card's `<style>` block using the ui_brand_plan §3.1 / §3.2 values (light defaults; `@media (prefers-color-scheme: dark)` overrides). Replace `#f8f9fa` with Oat Light `#F9F7F4`.
2. Font stacks: `"DM Sans", system-ui, sans-serif` and `"DM Mono", ui-monospace, monospace` (no font download inside the iframe).
3. Buttons follow the vote tokens and keep text labels; focus ring Blue 600 / Blue 400; any `outline: none` gets a `:focus-visible` replacement.
4. Keep all HTML escaping of asset fields exactly as today; do not change tool names or response shapes.
5. `server/mcp/views/cardHtml.test.ts`: render a sample card; assert no `#f8f9fa`, presence of `prefers-color-scheme: dark`, and that a `<script>`-containing asset name is escaped.

## Done when
Wave 0 gate line for 19 holds; no file outside `server/mcp/views/**` changed.
