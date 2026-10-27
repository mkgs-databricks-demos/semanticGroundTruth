// shared/contracts/generate-schemas.ts — regenerate generated/contracts.schema.json
// Session 25 · Wave 4-0 · No default export
//
// Prints the JSON Schema for every route and MCP tool to stdout. From
// ground-truth-app/ (Node toolchain: docs/runbooks/node_toolchain_genie_code.md):
//
//   pnpm exec tsx shared/contracts/generate-schemas.ts > shared/contracts/generated/contracts.schema.json
//
// It writes to stdout (no node:fs) so this file type-checks under both the
// server and the client tsconfig. schemas.test.ts fails when the committed file
// is stale.

import { renderContractSchemas } from './schemas';

// renderContractSchemas() already ends with a newline.
console.log(renderContractSchemas().trimEnd());
