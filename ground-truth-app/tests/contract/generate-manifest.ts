// tests/contract/generate-manifest.ts — regenerate tests/contract/manifest.json
// Session 35 · Wave 4-3 · No default export
//
// Prints the contract manifest to stdout (no node:fs). From ground-truth-app/:
//
//   pnpm exec tsx tests/contract/generate-manifest.ts > tests/contract/manifest.json

import { renderContractManifest } from './manifest';

// renderContractManifest() already ends with a newline.
console.log(renderContractManifest().trimEnd());
