// server/services/notification/destinations/slackMcp.ts — Unity Gateway Slack MCP client (G5 Option A)
// Build 5 · Session 50 · No default export
//
// Minimal Streamable-HTTP JSON-RPC client for the Databricks-provided MCP
// `system.ai.slack` at ${DATABRICKS_HOST}/ai-gateway/mcp-services/system.ai.slack.
// It always runs with the signed-in user's OBO token (x-forwarded-access-token),
// never the app service principal: the Slack MCP uses per-user Slack OAuth, so
// every message is sent as that user (docs/research/05_slack_mcp_notifications.md).
//
// Error mapping:
//   JSON-RPC -32042 or HTTP 401 -> SlackLoginRequiredError (status needs_slack_login)
//   HTTP 403                    -> FORBIDDEN (no EXECUTE on system.ai.slack)
//   HTTP 429                    -> RATE_LIMITED (details.retryAfterSeconds)
//   anything else / timeout     -> UPSTREAM_ERROR
//
// Never log the token or the message text.

import { AppError, forbidden, upstream } from '../../../lib/errors';
import { workspaceHost } from '../../../lib/databricks';
import { logger } from '../../../lib/logger';
import type { SlackChannel } from '../../../../shared/contracts/api';

/** Unity Gateway path of the Databricks-provided Slack MCP. */
export const SLACK_MCP_PATH = '/ai-gateway/mcp-services/system.ai.slack';

/** JSON-RPC error code the MCP returns when the user has not connected Slack. */
export const SLACK_LOGIN_REQUIRED_CODE = -32042;

export const SLACK_MCP_TIMEOUT_MS = 10_000;

/** Tool names on system.ai.slack (input schemas: research doc §Q3). */
export const SLACK_TOOLS = {
  searchChannels: 'slack_search_channels',
  send: 'slack_send_message',
  draft: 'slack_send_message_draft',
} as const;

const MCP_PROTOCOL_VERSION = '2025-06-18';
const MAX_CHANNELS = 50;

/** The user has not signed in to Slack on system.ai.slack (or the sign-in expired). */
export class SlackLoginRequiredError extends Error {
  readonly loginUrl?: string;

  constructor(loginUrl?: string) {
    super('Slack sign-in required for system.ai.slack');
    this.name = 'SlackLoginRequiredError';
    this.loginUrl = loginUrl;
  }
}

export interface SlackPostResult {
  /** Message permalink when Slack returns one. */
  permalink?: string;
}

/** What the share service needs from the client (tests inject a fake). */
export interface SlackMcpApi {
  searchChannels(query: string): Promise<SlackChannel[]>;
  send(channelId: string, text: string): Promise<SlackPostResult>;
  draft(channelId: string, text: string): Promise<SlackPostResult>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface SlackMcpClientOptions {
  /** The signed-in user's OBO token. Required. */
  token: string;
  /** Workspace URL (default: DATABRICKS_HOST). */
  host?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

interface JsonRpcError {
  code: number;
  message?: string;
  data?: unknown;
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: JsonRpcError;
}

interface ToolResult {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

// ── Pure helpers (exported for tests) ──────────────────────────────────────

/** Login URL from a -32042 error: error.data.elicitations[0].url (tolerates .params.url). */
export function loginUrlFromError(error: JsonRpcError | undefined): string | undefined {
  const data = error?.data as { elicitations?: unknown } | undefined;
  const list = Array.isArray(data?.elicitations) ? data!.elicitations as unknown[] : [];
  for (const item of list) {
    const e = item as { url?: unknown; params?: { url?: unknown } };
    const url = typeof e?.url === 'string' ? e.url : typeof e?.params?.url === 'string' ? e.params.url : undefined;
    if (url && /^https:\/\//.test(url)) return url;
  }
  return undefined;
}

/** Seconds from a Retry-After header (delta-seconds or HTTP date); undefined when absent/invalid. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/**
 * Parse a Streamable-HTTP response body: plain JSON (object or batch array) or
 * text/event-stream (`data:` lines). Returns every JSON-RPC message found.
 */
export function parseRpcBody(text: string, contentType: string): JsonRpcMessage[] {
  const messages: JsonRpcMessage[] = [];
  const push = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) messages.push(...(parsed as JsonRpcMessage[]));
      else if (parsed && typeof parsed === 'object') messages.push(parsed as JsonRpcMessage);
    } catch {
      // Not JSON (e.g. an HTML error page): no message.
    }
  };
  if (contentType.includes('text/event-stream')) {
    // Events are separated by a blank line; an event's data lines are joined with \n.
    for (const event of text.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''));
      if (data.length > 0) push(data.join('\n'));
    }
  } else {
    push(text);
  }
  return messages;
}

const PERMALINK_RE = /https:\/\/[A-Za-z0-9.-]*slack\.com\/archives\/[^\s"'<>)\]|]+/;

/** First Slack message permalink in a tool result (structured content or text). */
export function extractPermalink(result: ToolResult): string | undefined {
  const haystacks: string[] = [];
  if (result.structuredContent !== undefined) haystacks.push(JSON.stringify(result.structuredContent));
  for (const c of result.content ?? []) if (typeof c.text === 'string') haystacks.push(c.text);
  for (const h of haystacks) {
    const m = PERMALINK_RE.exec(h);
    if (m) return m[0];
  }
  return undefined;
}

const CHANNEL_ID_RE = /^[CG][A-Z0-9]{6,}$/;

function collectChannels(value: unknown, out: Map<string, string>, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const v of value) collectChannels(v, out, depth + 1);
    return;
  }
  const obj = value as Record<string, unknown>;
  const id = [obj.id, obj.channel_id, obj.channelId].find((v) => typeof v === 'string' && CHANNEL_ID_RE.test(v)) as string | undefined;
  const name = [obj.name, obj.channel_name, obj.channelName].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  if (id && name && !out.has(id)) out.set(id, name.replace(/^#/, '').trim());
  for (const v of Object.values(obj)) collectChannels(v, out, depth + 1);
}

/** String leaves of a parsed JSON value (system.ai.slack wraps markdown as {"results": "..."}). */
function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 6 || value === null) return;
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (typeof value !== 'object') return;
  for (const v of Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)) collectStrings(v, out, depth + 1);
}

const BLOCK_NAME_RES = [/^[ \t]*(?:-[ \t]*)?(?:\*\*)?Name:(?:\*\*)?[ \t]*#?([A-Za-z0-9][\w.-]*)/m, /^#{1,6}[ \t]+#([A-Za-z0-9][\w.-]*)/m];
const BLOCK_ID_RES = [/\*\*ID:\*\*[ \t]*([CG][A-Z0-9]{6,})\b/, /\bID:[ \t]*([CG][A-Z0-9]{6,})\b/, /\/archives\/([CG][A-Z0-9]{6,})\b/];

/**
 * Channels from markdown/plain text. Live system.ai.slack output (verified 2026-10-28):
 *   slack_search_channels:    `### Result 1 of 20` / `Name: #general` / `Permalink: [link](https://….slack.com/archives/C02EPKPGB)`
 *   slack_list_user_channels: `### #general` / `- **ID:** C02EPKPGB`
 * Name and id sit on different lines of one block, so parse per block first, then
 * fall back to lines that carry both (`#name (C…)`, `Name: x ID: C…`). Slack
 * mentions (`<#C…>`, `<@U…>`) in purposes/topics are removed first so they never
 * read as channels.
 */
function collectChannelsFromText(raw: string, out: Map<string, string>): void {
  const text = raw.replace(/<[#@!][^>\s]*>/g, '');
  for (const block of text.split(/^(?=#{1,6}[ \t])|^-{3,}[ \t]*$/m)) {
    const name = BLOCK_NAME_RES.map((re) => re.exec(block)?.[1]).find(Boolean);
    const id = BLOCK_ID_RES.map((re) => re.exec(block)?.[1]).find(Boolean);
    if (id && name) {
      if (!out.has(id)) out.set(id, name);
      continue;
    }
    for (const line of block.split(/\r?\n/)) {
      const lid = /\b([CG][A-Z0-9]{6,})\b/.exec(line)?.[1];
      const lname = /#([A-Za-z0-9][\w.-]*)/.exec(line)?.[1] ?? /\bname\b\W*\s*([\w.-]+)/i.exec(line)?.[1];
      if (lid && lname && lname !== lid && !out.has(lid)) out.set(lid, lname);
    }
  }
}

/**
 * Channels from a slack_search_channels result. Accept, in order: structured
 * content, JSON text (objects with id/name, plus any markdown string inside it),
 * or markdown/plain text (see collectChannelsFromText).
 */
export function parseChannels(result: ToolResult): SlackChannel[] {
  const found = new Map<string, string>();
  if (result.structuredContent !== undefined) collectChannels(result.structuredContent, found);
  for (const c of result.content ?? []) {
    if (typeof c.text !== 'string') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(c.text);
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined && typeof parsed === 'object' && parsed !== null) {
      collectChannels(parsed, found);
      const strings: string[] = [];
      collectStrings(parsed, strings);
      for (const s of strings) collectChannelsFromText(s, found);
      continue;
    }
    collectChannelsFromText(c.text, found);
  }
  return [...found.entries()].slice(0, MAX_CHANNELS).map(([id, name]) => ({ id, name }));
}

// ── Client ─────────────────────────────────────────────────────────────────

export class SlackMcpClient implements SlackMcpApi {
  private readonly url: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private sessionId: string | undefined;
  private initialized: Promise<void> | undefined;
  private nextId = 1;

  constructor(opts: SlackMcpClientOptions) {
    if (!opts.token) throw new AppError('UNAUTHENTICATED', 'Share to Slack needs your signed-in Databricks token (OBO)');
    const host = (opts.host ?? workspaceHost()).replace(/\/+$/, '');
    if (!host) throw upstream('DATABRICKS_HOST not configured');
    this.url = `${host}${SLACK_MCP_PATH}`;
    this.token = opts.token;
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
    this.timeoutMs = opts.timeoutMs ?? SLACK_MCP_TIMEOUT_MS;
  }

  async searchChannels(query: string): Promise<SlackChannel[]> {
    const result = await this.callTool(SLACK_TOOLS.searchChannels, { query });
    return parseChannels(result);
  }

  async send(channelId: string, text: string): Promise<SlackPostResult> {
    const result = await this.callTool(SLACK_TOOLS.send, { channel_id: channelId, message: text });
    return { permalink: extractPermalink(result) };
  }

  async draft(channelId: string, text: string): Promise<SlackPostResult> {
    const result = await this.callTool(SLACK_TOOLS.draft, { channel_id: channelId, message: text });
    return { permalink: extractPermalink(result) };
  }

  // ── JSON-RPC plumbing ────────────────────────────────────────────────────

  private async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    await this.ensureInitialized();
    const result = (await this.request('tools/call', { name, arguments: args }, name)) as ToolResult | undefined;
    if (!result || typeof result !== 'object') throw upstream(`system.ai.slack returned no result for ${name}`);
    if (result.isError) {
      logger.warn('Slack MCP tool returned an error', { tool: name });
      throw upstream(`Slack tool ${name} failed`, { tool: name });
    }
    return result;
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      this.initialized = (async () => {
        await this.request('initialize', {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'semantic-ground-truth', version: '1.0.0' },
        }, 'initialize');
        await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' }, 'initialized');
      })();
      // A failed handshake must not be cached for the next call.
      this.initialized.catch(() => { this.initialized = undefined; });
    }
    return this.initialized;
  }

  /** Send one JSON-RPC request and return its `result` (errors mapped, see header). */
  private async request(method: string, params: Record<string, unknown>, label: string): Promise<unknown> {
    const id = this.nextId++;
    const { status, messages } = await this.post({ jsonrpc: '2.0', id, method, params }, label);
    const reply = messages.find((m) => m.id === id) ?? messages.find((m) => m.error || m.result !== undefined);
    if (reply?.error) {
      if (reply.error.code === SLACK_LOGIN_REQUIRED_CODE) throw new SlackLoginRequiredError(loginUrlFromError(reply.error));
      logger.warn('Slack MCP JSON-RPC error', { call: label, code: reply.error.code });
      throw upstream(`system.ai.slack error ${reply.error.code}`, { call: label, code: reply.error.code });
    }
    if (!reply) throw upstream(`system.ai.slack sent no reply (HTTP ${status})`, { call: label });
    return reply.result;
  }

  /** POST a JSON-RPC message; maps HTTP errors. Notifications (no id) expect 202. */
  private async post(message: Record<string, unknown>, label: string): Promise<{ status: number; messages: JsonRpcMessage[] }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    let res: Response;
    try {
      res = await this.fetchImpl(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const name = (err as Error)?.name;
      const timedOut = name === 'TimeoutError' || name === 'AbortError';
      logger.warn('Slack MCP request failed', { call: label, reason: timedOut ? 'timeout' : 'network' });
      throw upstream(timedOut ? 'system.ai.slack timed out' : 'system.ai.slack unreachable', { call: label });
    }

    const session = res.headers.get('mcp-session-id');
    if (session) this.sessionId = session;

    // Decode as UTF-8 explicitly: an event stream without a charset must not be read as latin-1.
    const text = new TextDecoder('utf-8').decode(await res.arrayBuffer());
    const messages = parseRpcBody(text, res.headers.get('content-type') ?? '');

    if (!res.ok) {
      const rpcError = messages.find((m) => m.error)?.error;
      if (rpcError?.code === SLACK_LOGIN_REQUIRED_CODE || res.status === 401) {
        throw new SlackLoginRequiredError(loginUrlFromError(rpcError));
      }
      logger.warn('Slack MCP HTTP error', { call: label, status: res.status });
      if (res.status === 403) {
        throw forbidden('No EXECUTE privilege on system.ai.slack', { call: label });
      }
      if (res.status === 429) {
        const retryAfterSeconds = parseRetryAfter(res.headers.get('retry-after'));
        throw new AppError('RATE_LIMITED', 'Slack rate limit reached; try again later', {
          call: label,
          ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
        });
      }
      throw upstream(`system.ai.slack returned HTTP ${res.status}`, { call: label, status: res.status });
    }
    return { status: res.status, messages };
  }
}
