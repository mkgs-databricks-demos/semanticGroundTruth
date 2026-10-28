// server/lib/tracing/mlflowTraces.ts — MLflow agent trace enrichment
// Session 45 · Build 5 · Wave 5-0
//
// How MLflow agent tracing works in this app:
//
// * The AppKit agents plugin (0.84.0) already records MLflow traces when the
//   optional peer `@mlflow/core` is installed and `MLFLOW_EXPERIMENT_ID` is set
//   (resources/app.app.yml config.env binds it from the `agents-mlflow-experiment` resource, the infra
//   experiment `app_agents_experiment`). Every chat turn is an AGENT span and
//   every tool call a TOOL span. Auth is the app's own Databricks credentials
//   (Apps inject DATABRICKS_HOST / DATABRICKS_CLIENT_ID / _SECRET; `@mlflow/core`
//   delegates to the Databricks SDK, which supports OAuth M2M). AppKit owns the
//   single OTel tracer provider, so this module must NOT call `mlflow.init()` or
//   start its own spans.
// * This module only enriches the span AppKit already opened around a tool
//   call: agent and tool names, input size, latency, result size, error, plus
//   trace tags (`gt.agent`, `gt.user_hash`). User ids are hashed, never raw.
// * Tracing never fails a request: every tracing call is wrapped, failures log
//   one warning, and the tool's own result or error is returned unchanged.
// * `GT_MLFLOW_TRACES=false` turns this enrichment off. AppKit's own AGENT/TOOL
//   spans follow `MLFLOW_EXPERIMENT_ID` only (unset it to stop all tracing).

import { createHash } from 'node:crypto';
import { getCurrentActorId } from '@databricks/appkit';
import { logger } from '../logger';

/** The part of an `@mlflow/core` LiveSpan this module uses. */
export interface TraceSpanLike {
  setAttributes(attributes: Record<string, unknown>): void;
}

/** The part of the `@mlflow/core` module this module uses. */
export interface MlflowTracingClient {
  getCurrentActiveSpan(): TraceSpanLike | null | undefined;
  updateCurrentTrace(options: { tags?: Record<string, string>; user?: string }): void;
}

export interface MlflowTracesDeps {
  /** Loads `@mlflow/core` (dynamic import, optional dependency). */
  load: () => Promise<MlflowTracingClient>;
  env: NodeJS.ProcessEnv;
  /** The calling user's id, or undefined outside a user scope. */
  resolveUserId: () => string | undefined;
  now: () => number;
}

export type TracingState = 'uninitialized' | 'enabled' | 'disabled';

export interface ToolTraceMeta {
  agent: string;
  tool: string;
  inputs?: unknown;
}

async function loadMlflowCore(): Promise<MlflowTracingClient> {
  const mod = (await import('@mlflow/core')) as unknown as MlflowTracingClient & {
    default?: MlflowTracingClient;
  };
  // `@mlflow/core` is CommonJS; under ESM interop the API can sit on `default`.
  return typeof mod.getCurrentActiveSpan === 'function' ? mod : (mod.default as MlflowTracingClient);
}

function defaultResolveUserId(): string | undefined {
  return getCurrentActorId();
}

const defaultDeps: MlflowTracesDeps = {
  load: loadMlflowCore,
  env: process.env,
  resolveUserId: defaultResolveUserId,
  now: () => Date.now(),
};

let deps: MlflowTracesDeps = defaultDeps;
let state: TracingState = 'uninitialized';
let client: MlflowTracingClient | undefined;
let initPromise: Promise<boolean> | undefined;
let warned = false;

function warnOnce(msg: string, err: unknown): void {
  if (warned) return;
  warned = true;
  logger.warn(msg, { reason: err instanceof Error ? err.message : String(err) });
}

/** True when the app should enrich agent traces (flag on and an experiment bound). */
export function tracingRequested(env: NodeJS.ProcessEnv = deps.env): boolean {
  const flag = (env.GT_MLFLOW_TRACES ?? '').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  return Boolean(env.MLFLOW_EXPERIMENT_ID?.trim());
}

/**
 * Load `@mlflow/core` once. Resolves to whether enrichment is enabled; never
 * rejects. Safe to call repeatedly and concurrently.
 */
export function initMlflowTraces(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!tracingRequested()) {
      state = 'disabled';
      logger.info('MLflow trace enrichment off', {
        experimentBound: Boolean(deps.env.MLFLOW_EXPERIMENT_ID?.trim()),
        flag: deps.env.GT_MLFLOW_TRACES ?? null,
      });
      return false;
    }
    try {
      client = await deps.load();
      if (typeof client?.getCurrentActiveSpan !== 'function') {
        throw new Error('@mlflow/core has no getCurrentActiveSpan()');
      }
      state = 'enabled';
      logger.info('MLflow trace enrichment on', {
        experimentId: deps.env.MLFLOW_EXPERIMENT_ID?.trim(),
      });
      return true;
    } catch (err) {
      state = 'disabled';
      client = undefined;
      warnOnce('MLflow trace enrichment disabled: @mlflow/core could not be loaded', err);
      return false;
    }
  })();
  return initPromise;
}

export function mlflowTracingState(): TracingState {
  return state;
}

/** Stable, non-reversible user id for trace tags (sha256, 16 hex chars). */
export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

/** Character length of the JSON form of a value (0 when not serialisable). */
export function payloadChars(value: unknown): number {
  if (value === undefined) return 0;
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

function resultItems(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

function annotate(attributes: Record<string, unknown>, tags: Record<string, string>): void {
  if (state !== 'enabled' || !client) return;
  try {
    const span = client.getCurrentActiveSpan();
    if (!span) return; // no active trace (AppKit tracing off or outside a turn)
    span.setAttributes(attributes);
    let userHash: string | undefined;
    try {
      const userId = deps.resolveUserId();
      if (userId) userHash = hashUserId(userId);
    } catch {
      // outside a caller scope: no user tag
    }
    client.updateCurrentTrace({
      tags: userHash ? { ...tags, 'gt.user_hash': userHash } : tags,
      ...(userHash ? { user: userHash } : {}),
    });
  } catch (err) {
    warnOnce('MLflow trace enrichment failed; continuing without it', err);
  }
}

/**
 * Run an agent tool and enrich the MLflow span AppKit opened around it. The
 * tool's result or error is passed through unchanged; tracing problems are
 * logged once and never thrown.
 */
export async function traceAgentTool<T>(meta: ToolTraceMeta, fn: () => Promise<T>): Promise<T> {
  let ready = false;
  try {
    ready = await initMlflowTraces();
  } catch {
    ready = false;
  }
  if (!ready) return fn();

  const started = deps.now();
  const base = {
    'gt.agent': meta.agent,
    'gt.tool': meta.tool,
    'gt.input_chars': payloadChars(meta.inputs),
  };
  const tags = { 'gt.agent': meta.agent, 'gt.app': 'ground-truth-app' };
  try {
    const result = await fn();
    const items = resultItems(result);
    annotate(
      {
        ...base,
        'gt.latency_ms': deps.now() - started,
        'gt.output_chars': payloadChars(result),
        ...(items === undefined ? {} : { 'gt.output_items': items }),
        'gt.error': false,
      },
      tags,
    );
    return result;
  } catch (err) {
    annotate(
      {
        ...base,
        'gt.latency_ms': deps.now() - started,
        'gt.error': true,
        'gt.error_message': err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      },
      tags,
    );
    throw err;
  }
}

/** Any tool object with an `execute` (AppKit `FunctionTool` from `tool()`). */
export interface ExecutableTool {
  execute: (args: Record<string, unknown>) => unknown;
}

/**
 * Wrap every tool in a keyed tool record with {@link traceAgentTool}. The record
 * key is the tool name (AppKit uses the key as the LLM-visible name). Returns
 * new tool objects; everything except `execute` is copied unchanged.
 */
export function withToolTracing<T extends Record<string, ExecutableTool>>(agent: string, tools: T): T {
  const wrapped: Record<string, ExecutableTool> = {};
  for (const [name, def] of Object.entries(tools)) {
    wrapped[name] = {
      ...def,
      execute: (args: Record<string, unknown>) =>
        traceAgentTool({ agent, tool: name, inputs: args }, () => Promise.resolve(def.execute(args))),
    };
  }
  return wrapped as T;
}

/** Test hook: replace dependencies and reset module state. */
export function _resetMlflowTracesForTests(overrides: Partial<MlflowTracesDeps> = {}): void {
  deps = { ...defaultDeps, ...overrides };
  state = 'uninitialized';
  client = undefined;
  initPromise = undefined;
  warned = false;
}
