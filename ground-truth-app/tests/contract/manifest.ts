// tests/contract/manifest.ts — route + MCP tool manifest for the live contract job
// Session 35 · Wave 4-3 · test-only · No enum, no namespace, no default export
//
// One entry per ROUTE_CONTRACTS / MCP_TOOL_CONTRACTS item, built from the same
// generator as shared/contracts/generated/contracts.schema.json (plan 25,
// toJsonSchemas): method, path, role, statuses and the schema $ref of every
// request / response. How this suite exercises each error status in-process
// (case / generated / na) lives in routeCases.ts errorPlan. The live job notebook
// (src/notebooks/api_contract_tests.ipynb) loads manifest.json and fails if any
// entry here has no result row. Regenerate from ground-truth-app/:
//
//   pnpm exec tsx tests/contract/generate-manifest.ts > tests/contract/manifest.json
//
// coverage.contract.test.ts fails when the committed file is stale.

import { MCP_TOOL_CONTRACTS, ROUTE_CONTRACTS, routeKey, toJsonSchemas } from '../../shared/contracts/schemas';
import { KNOWN_DEFECTS, TOOL_CASES } from './toolCases';

/** MCP Apps review card (server/mcp/tools/define.ts REVIEW_CARD_URI). */
export const REVIEW_CARD_URI = 'ui://ground-truth/review-card';
/** MCP Apps HTML MIME type (@modelcontextprotocol/ext-apps RESOURCE_MIME_TYPE). */
export const REVIEW_CARD_MIME_TYPE = 'text/html;profile=mcp-app';
/** Tools that render the interactive review card (docs/design/L300-17_mcp_app_review_card.md). */
export const UI_TOOLS: readonly string[] = ['review_get_next', 'review_submit_vote', 'review_skip_card', 'review_get_stats'];

export const MANIFEST_SCHEMA_FILE = 'shared/contracts/generated/contracts.schema.json';

type Ref = { $ref: string };

export interface ManifestRoute {
  key: string;
  method: string;
  path: string;
  role: string;
  status: number;
  errors: number[];
  plannedIn?: string;
  request?: Ref;
  query?: Ref;
  params?: Ref;
  response: Ref;
}

export interface ManifestTool {
  name: string;
  role: string;
  plannedIn?: string;
  emptyText?: string;
  input: Ref;
  output: Ref | null;
  uiResourceUri?: string;
  /** Keys of the known server defects this suite characterises (toolCases.ts KNOWN_DEFECTS). */
  knownDefects?: string[];
}

export interface ManifestResource {
  uri: string;
  mimeType: string;
}

export interface ContractManifest {
  version: 1;
  schemaFile: string;
  errorResponse: Ref;
  routes: ManifestRoute[];
  mcpTools: ManifestTool[];
  mcpResources: ManifestResource[];
}

export function buildContractManifest(): ContractManifest {
  const doc = toJsonSchemas();
  const routes: ManifestRoute[] = ROUTE_CONTRACTS.map((c) => {
    const key = routeKey(c);
    const js = doc.routes[key];
    return {
      key,
      method: js.method,
      path: js.path,
      role: js.role,
      status: js.status,
      errors: [...js.errors],
      ...(js.plannedIn ? { plannedIn: js.plannedIn } : {}),
      ...(js.request ? { request: js.request } : {}),
      ...(js.query ? { query: js.query } : {}),
      ...(js.params ? { params: js.params } : {}),
      response: js.response,
    };
  });

  const mcpTools: ManifestTool[] = MCP_TOOL_CONTRACTS.map((t) => {
    const js = doc.mcpTools[t.name];
    const tc = TOOL_CASES[t.name];
    const defectKey = (msg: string | undefined) =>
      Object.entries(KNOWN_DEFECTS).find(([, v]) => v === msg)?.[0];
    const defects = [tc?.happy.knownDefect, ...(tc?.errors ?? []).map((e) => e.knownDefect)]
      .map(defectKey)
      .filter((d): d is string => !!d);
    return {
      name: t.name,
      role: js.role,
      ...(js.plannedIn ? { plannedIn: js.plannedIn } : {}),
      ...(js.emptyText ? { emptyText: js.emptyText } : {}),
      input: js.input,
      output: js.output,
      ...(UI_TOOLS.includes(t.name) ? { uiResourceUri: REVIEW_CARD_URI } : {}),
      ...(defects.length ? { knownDefects: [...new Set(defects)] } : {}),
    };
  });

  return {
    version: 1,
    schemaFile: MANIFEST_SCHEMA_FILE,
    errorResponse: doc.errorResponse,
    routes,
    mcpTools,
    mcpResources: [{ uri: REVIEW_CARD_URI, mimeType: REVIEW_CARD_MIME_TYPE }],
  };
}

/** Exact text of tests/contract/manifest.json: valid JSON, one entry per line. */
export function renderContractManifest(): string {
  const m = buildContractManifest();
  const list = (items: unknown[]) => items.map((v) => `    ${JSON.stringify(v)}`).join(',\n');
  return [
    '{',
    `  "version": ${m.version},`,
    `  "schemaFile": ${JSON.stringify(m.schemaFile)},`,
    `  "errorResponse": ${JSON.stringify(m.errorResponse)},`,
    '  "routes": [',
    list(m.routes),
    '  ],',
    '  "mcpTools": [',
    list(m.mcpTools),
    '  ],',
    '  "mcpResources": [',
    list(m.mcpResources),
    '  ]',
    '}',
    '',
  ].join('\n');
}
