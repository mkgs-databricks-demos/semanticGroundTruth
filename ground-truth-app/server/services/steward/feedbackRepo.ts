// server/services/steward/feedbackRepo.ts — web URL of the feedback repo (FeedbackBranch.htmlUrl)
// Build 5 · Session 44 · No enum, no namespace, no default export
//
// The feedback pipeline pushes mg-genie-feedback-* branches from a Git folder.
// Stewards get an "Open on GitHub" link built from that repo's web URL:
//   1. GT_FEEDBACK_REPO_URL (https URL of the repo), else
//   2. GT_FEEDBACK_REPO_PATH (workspace path of the Git folder): the Repos API
//      `url` of that folder, read once as the app service principal.
// Anything else (unset, not https, API error) gives null: the link is optional
// and must never fail a steward request. The URL is never stored.

import { getAppSpnToken, workspaceHost } from '../../lib/databricks';
import { logger } from '../../lib/logger';

/** Resolves the repo web URL (https, no trailing slash or .git), or null when unknown. */
export type FeedbackRepoUrlResolver = () => Promise<string | null>;

/**
 * Normalise a Git remote to its https web URL: strip `.git` and trailing
 * slashes, map `git@host:org/repo` to `https://host/org/repo`, drop any
 * userinfo. Returns null for anything that is not https after mapping.
 */
export function toRepoWebUrl(remote: string | null | undefined): string | null {
  let s = (remote ?? '').trim();
  if (!s) return null;
  const scp = /^[\w.-]+@([^:/]+):(.+)$/.exec(s);
  if (scp) s = `https://${scp[1]}/${scp[2]}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const path = url.pathname.replace(/\/+$/, '').replace(/\.git$/, '').replace(/\/+$/, '');
  if (!path || path === '/') return null;
  return `https://${url.host}${path}`;
}

/** `<repo>/tree/<branch>`, or null when the repo URL or the branch is unknown. */
export function feedbackBranchHtmlUrl(repoUrl: string | null, branchName: string | null | undefined): string | null {
  if (!repoUrl || !branchName) return null;
  return `${repoUrl}/tree/${branchName.split('/').map(encodeURIComponent).join('/')}`;
}

interface ReposListResponse {
  repos?: { path?: string; url?: string }[];
}

/** Repos API lookup of the Git folder at `path` (exact path match), as the app SPN. */
async function repoUrlFromWorkspace(path: string): Promise<string | null> {
  const host = workspaceHost();
  if (!host) return null;
  const norm = (p: string | undefined) => (p ?? '').replace(/^\/Workspace(?=\/)/, '').replace(/\/+$/, '');
  const token = await getAppSpnToken();
  // The Repos API lists paths without the /Workspace prefix.
  const res = await fetch(`${host}/api/2.0/repos?path_prefix=${encodeURIComponent(norm(path))}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    logger.warn('Feedback repo lookup failed', { status: res.status, path });
    return null;
  }
  const body = (await res.json()) as ReposListResponse;
  const repo = (body.repos ?? []).find((r) => norm(r.path) === norm(path));
  return toRepoWebUrl(repo?.url);
}

/**
 * Default resolver: env first, then the Repos API. The lookup runs at most
 * once per resolver (the promise is cached); failures are logged and give null.
 */
export function createFeedbackRepoUrlResolver(env: NodeJS.ProcessEnv = process.env): FeedbackRepoUrlResolver {
  let cached: Promise<string | null> | null = null;
  const resolve = async (): Promise<string | null> => {
    const fromEnv = env.GT_FEEDBACK_REPO_URL?.trim();
    if (fromEnv) {
      const url = toRepoWebUrl(fromEnv);
      if (!url) logger.warn('GT_FEEDBACK_REPO_URL is not an https repo URL; feedback branch links are off');
      return url;
    }
    const path = env.GT_FEEDBACK_REPO_PATH?.trim();
    if (!path) return null;
    try {
      return await repoUrlFromWorkspace(path);
    } catch (err) {
      logger.warn('Feedback repo lookup failed', { path, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  };
  return () => (cached ??= resolve());
}
