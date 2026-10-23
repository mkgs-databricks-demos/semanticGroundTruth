// server/services/sources/workspaceFiles.ts — list and read workspace files via REST API
// Session 09 · Wave 1 · No default export
//
// Uses the app SPN (default credentials), NOT the caller’s OBO token.
// On 403 return SOURCE_ACCESS_DENIED with the §4 message.

import { workspaceHost } from '../../lib/databricks';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkspaceObject {
  path: string;
  objectType: 'DIRECTORY' | 'NOTEBOOK' | 'FILE' | 'LIBRARY' | 'REPO' | 'DASHBOARD';
}

interface ListResponse {
  objects?: { path?: string; object_type?: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAppToken(): string {
  // AppKit injects DATABRICKS_TOKEN for the app SPN
  const token = process.env.DATABRICKS_TOKEN;
  if (!token) {
    throw new AppError('INTERNAL', 'DATABRICKS_TOKEN not configured');
  }
  return token;
}

function getAppSpnId(): string {
  return process.env.DATABRICKS_APP_SPN_ID ?? 'the app service principal';
}

function handleForbidden(path: string): never {
  const spnId = getAppSpnId();
  throw new AppError(
    'SOURCE_ACCESS_DENIED',
    `Grant CAN_READ on ${path} to the app service principal ${spnId}`,
  );
}

async function workspaceRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const host = workspaceHost();
  const token = getAppToken();
  const res = await fetch(`${host}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 403) {
    handleForbidden(path);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new AppError('UPSTREAM_ERROR', `Workspace API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Recursively list all files under a workspace path.
 * Returns relative paths (relative to `rootPath`).
 */
export async function listFilesRecursive(
  rootPath: string,
): Promise<WorkspaceObject[]> {
  const results: WorkspaceObject[] = [];

  async function walk(dirPath: string): Promise<void> {
    let data: ListResponse;
    try {
      data = await workspaceRequest<ListResponse>(
        `/api/2.0/workspace/list?path=${encodeURIComponent(dirPath)}`,
      );
    } catch (err) {
      if (err instanceof AppError && err.code === 'SOURCE_ACCESS_DENIED') {
        // Re-throw with the original rootPath for the user-facing message
        handleForbidden(rootPath);
      }
      throw err;
    }

    for (const obj of data.objects ?? []) {
      if (!obj.path || !obj.object_type) continue;
      const wsObj: WorkspaceObject = {
        path: obj.path,
        objectType: obj.object_type as WorkspaceObject['objectType'],
      };

      if (wsObj.objectType === 'DIRECTORY') {
        await walk(wsObj.path);
      } else {
        results.push(wsObj);
      }
    }
  }

  await walk(rootPath);
  return results;
}

/**
 * Export the text content of a workspace file.
 * Returns the UTF-8 text content.
 */
export async function exportFileContent(filePath: string): Promise<string> {
  const host = workspaceHost();
  const token = getAppToken();

  const res = await fetch(
    `${host}/api/2.0/workspace/export?path=${encodeURIComponent(filePath)}&direct_download=true&format=SOURCE`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (res.status === 403) {
    handleForbidden(filePath);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new AppError('UPSTREAM_ERROR', `Workspace export ${res.status}: ${text}`);
  }

  return await res.text();
}

/**
 * Simple glob matcher for workspace paths.
 * Supports * (single segment) and ** (any depth). No external deps.
 */
export function matchGlob(pattern: string, filePath: string): boolean {
  // Convert glob to regex
  const parts = pattern.split('/');
  const regexParts: string[] = [];

  for (const part of parts) {
    if (part === '**') {
      regexParts.push('(?:[^/]+/)*[^/]+');
    } else {
      // Escape regex special chars except *, then convert * to [^/]+
      const escaped = part
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*');
      regexParts.push(escaped);
    }
  }

  // Handle leading ** (match any prefix)
  let regexStr = regexParts.join('/');
  if (pattern.startsWith('**/')) {
    regexStr = '(?:.*/)?'  + regexParts.slice(1).join('/');
  }

  const re = new RegExp(`^${regexStr}$`);
  return re.test(filePath);
}
