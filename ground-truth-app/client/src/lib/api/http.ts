// client/src/lib/api/http.ts — typed fetch client
// Session 10 · Wave 3 · No enum, no namespace, no default export

import type { ErrorCode } from '../../../../shared/contracts';

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined,
  );
  if (entries.length === 0) return '';
  const qs = entries
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join('&');
  return `?${qs}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let parsed: { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | undefined;
    try {
      parsed = (await res.json()) as typeof parsed;
    } catch {
      // response body was not JSON
    }
    const code = (parsed?.error?.code ?? 'INTERNAL') as ErrorCode;
    const message = parsed?.error?.message ?? res.statusText;
    const details = parsed?.error?.details;
    throw new ApiError(code, res.status, message, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiGet<T>(
  path: string,
  query?: Record<string, unknown>,
): Promise<T> {
  const url = `${path}${buildQuery(query)}`;
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  return handleResponse<T>(res);
}

export async function apiSend<T>(
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return handleResponse<T>(res);
}
