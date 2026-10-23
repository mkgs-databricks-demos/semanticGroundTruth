import { upstream } from './errors';
import { logger } from './logger';

export function workspaceHost(): string {
  let host = process.env.DATABRICKS_HOST ?? '';
  if (host && !host.startsWith('https://')) {
    host = 'https://' + host;
  }
  // Strip trailing slash
  return host.replace(/\/+$/, '');
}

// ── App service principal token (OAuth M2M) ─────────────────────────────────
// Databricks Apps inject DATABRICKS_CLIENT_ID / DATABRICKS_CLIENT_SECRET for the
// app service principal (no DATABRICKS_TOKEN). Exchange them for a workspace
// OAuth token and cache it until shortly before expiry. DATABRICKS_TOKEN is
// honoured as a fallback for local development.

let cachedSpToken: { token: string; expiresAt: number } | null = null;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

export async function getAppSpnToken(): Promise<string> {
  const now = Date.now();
  if (cachedSpToken && cachedSpToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return cachedSpToken.token;
  }

  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  const host = workspaceHost();
  if (!clientId || !clientSecret || !host) {
    const pat = process.env.DATABRICKS_TOKEN;
    if (pat) return pat;
    throw upstream(
      'App service principal credentials not configured (DATABRICKS_CLIENT_ID / DATABRICKS_CLIENT_SECRET)',
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${host}/oidc/v1/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'all-apis' }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw upstream(`App service principal token request returned ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw upstream('App service principal token response had no access_token');
  }
  cachedSpToken = {
    token: body.access_token,
    expiresAt: now + (body.expires_in ?? 3600) * 1000,
  };
  return cachedSpToken.token;
}

interface StatementParameter {
  name: string;
  value: string;
  type?: string;
}

interface ExecuteStatementOpts {
  token: string;
  statement: string;
  parameters?: StatementParameter[];
  rowLimit?: number;
}

interface StatementResponse {
  statement_id?: string;
  status?: {
    state?: string;
    error?: {
      message?: string;
    };
  };
  manifest?: {
    schema?: {
      columns?: { name: string }[];
    };
  };
  result?: {
    data_array?: unknown[][];
  };
}

const POLL_INTERVAL_MS = 1_000;
const MAX_POLL_MS = 60_000;

export async function executeStatement(
  opts: ExecuteStatementOpts,
): Promise<{ columns: string[]; rows: unknown[][] }> {
  const host = workspaceHost();
  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;

  if (!host || !warehouseId) {
    throw upstream('DATABRICKS_HOST or DATABRICKS_WAREHOUSE_ID not configured');
  }

  const body: Record<string, unknown> = {
    warehouse_id: warehouseId,
    statement: opts.statement,
    wait_timeout: '30s',
    disposition: 'INLINE',
    format: 'JSON_ARRAY',
  };
  if (opts.parameters && opts.parameters.length > 0) {
    body.parameters = opts.parameters;
  }
  if (opts.rowLimit !== undefined) {
    body.row_limit = opts.rowLimit;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${opts.token}`,
  };

  const postRes = await fetch(`${host}/api/2.0/sql/statements`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!postRes.ok) {
    const text = await postRes.text();
    throw upstream(`SQL statement API returned ${postRes.status}: ${text}`);
  }

  let data: StatementResponse = (await postRes.json()) as StatementResponse;
  const statementId = data.statement_id;

  // Poll while PENDING or RUNNING
  const start = Date.now();
  while (
    data.status?.state === 'PENDING' ||
    data.status?.state === 'RUNNING'
  ) {
    if (Date.now() - start > MAX_POLL_MS) {
      throw upstream('SQL statement timed out after 60s');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${host}/api/2.0/sql/statements/${statementId}`, {
      method: 'GET',
      headers,
    });
    if (!pollRes.ok) {
      const text = await pollRes.text();
      throw upstream(`SQL statement poll returned ${pollRes.status}: ${text}`);
    }
    data = (await pollRes.json()) as StatementResponse;
  }

  if (data.status?.state === 'FAILED') {
    throw upstream(
      data.status.error?.message ?? 'SQL statement failed',
    );
  }

  const columns = (data.manifest?.schema?.columns ?? []).map((c) => c.name);
  const rows = data.result?.data_array ?? [];
  return { columns, rows };
}

interface ScimResponse {
  userName?: string;
  groups?: { value?: string; display?: string }[];
}

export async function currentUserFromToken(
  token: string,
): Promise<{ userName: string; groups: string[] }> {
  try {
    const host = workspaceHost();
    const res = await fetch(`${host}/api/2.0/preview/scim/v2/Me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { userName: '', groups: [] };
    }
    const data = (await res.json()) as ScimResponse;
    return {
      userName: data.userName ?? '',
      groups: (data.groups ?? []).map((g) => g.display ?? g.value ?? '').filter(Boolean),
    };
  } catch (err) {
    logger.warn('currentUserFromToken failed', { error: (err as Error).message });
    return { userName: '', groups: [] };
  }
}
