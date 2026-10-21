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
