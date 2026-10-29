// server/lib/tracing/mlflowTraces.test.ts — session 45 (build 5, wave 5-0)
// Mocked @mlflow/core client: the span is enriched, and tracing failures never
// fail the tool call.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetMlflowTracesForTests,
  hashUserId,
  initMlflowTraces,
  mlflowTracingState,
  payloadChars,
  traceAgentTool,
  tracingRequested,
  withToolTracing,
  type MlflowTracingClient,
} from './mlflowTraces';

const ENV = { MLFLOW_EXPERIMENT_ID: '1698842789305538' } as NodeJS.ProcessEnv;

function fakeClient(overrides: Partial<MlflowTracingClient> = {}) {
  const span = { setAttributes: vi.fn() };
  const client: MlflowTracingClient = {
    getCurrentActiveSpan: vi.fn(() => span),
    updateCurrentTrace: vi.fn(),
    ...overrides,
  };
  return { span, client };
}

function setup(
  client: MlflowTracingClient,
  opts: { env?: NodeJS.ProcessEnv; userId?: string; times?: number[] } = {},
) {
  const times = [...(opts.times ?? [1000, 1042])];
  const load = vi.fn(async () => client);
  _resetMlflowTracesForTests({
    load,
    env: opts.env ?? ENV,
    resolveUserId: () => opts.userId,
    now: () => times.shift() ?? 2000,
  });
  return { load };
}

afterEach(() => {
  _resetMlflowTracesForTests();
  vi.restoreAllMocks();
});

describe('tracingRequested', () => {
  it('is on when an experiment is bound and the flag is not false', () => {
    expect(tracingRequested({ MLFLOW_EXPERIMENT_ID: '1' } as NodeJS.ProcessEnv)).toBe(true);
    expect(
      tracingRequested({ MLFLOW_EXPERIMENT_ID: '1', GT_MLFLOW_TRACES: 'true' } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('is off without an experiment or with GT_MLFLOW_TRACES=false', () => {
    expect(tracingRequested({} as NodeJS.ProcessEnv)).toBe(false);
    expect(tracingRequested({ MLFLOW_EXPERIMENT_ID: '  ' } as NodeJS.ProcessEnv)).toBe(false);
    expect(
      tracingRequested({ MLFLOW_EXPERIMENT_ID: '1', GT_MLFLOW_TRACES: 'false' } as NodeJS.ProcessEnv),
    ).toBe(false);
  });
});

describe('traceAgentTool', () => {
  it('records tool attributes and trace tags on the active span', async () => {
    const { span, client } = fakeClient();
    setup(client, { userId: 'user-123' });

    const result = await traceAgentTool(
      { agent: 'review-worker', tool: 'search_assets', inputs: { limit: 5 } },
      async () => [{ id: 'a' }, { id: 'b' }],
    );

    expect(result).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(mlflowTracingState()).toBe('enabled');
    expect(span.setAttributes).toHaveBeenCalledTimes(1);
    expect(span.setAttributes).toHaveBeenCalledWith({
      'gt.agent': 'review-worker',
      'gt.tool': 'search_assets',
      'gt.input_chars': payloadChars({ limit: 5 }),
      'gt.latency_ms': 42,
      'gt.output_chars': payloadChars([{ id: 'a' }, { id: 'b' }]),
      'gt.output_items': 2,
      'gt.error': false,
    });
    const hash = hashUserId('user-123');
    expect(client.updateCurrentTrace).toHaveBeenCalledWith({
      tags: { 'gt.agent': 'review-worker', 'gt.app': 'ground-truth-app', 'gt.user_hash': hash },
      user: hash,
    });
  });

  it('never puts the raw user id on the trace', async () => {
    const { span, client } = fakeClient();
    setup(client, { userId: 'alice@example.com' });
    await traceAgentTool({ agent: 'review-worker', tool: 'get_asset' }, async () => ({ ok: true }));
    const serialized = JSON.stringify([
      vi.mocked(span.setAttributes).mock.calls,
      vi.mocked(client.updateCurrentTrace).mock.calls,
    ]);
    expect(serialized).not.toContain('alice@example.com');
    expect(hashUserId('alice@example.com')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('returns the result when the client throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = fakeClient({
      getCurrentActiveSpan: vi.fn(() => {
        throw new Error('mlflow exploded');
      }),
    });
    setup(client);

    await expect(
      traceAgentTool({ agent: 'review-worker', tool: 'get_leaderboard' }, async () => 'ok'),
    ).resolves.toBe('ok');
    await expect(
      traceAgentTool({ agent: 'review-worker', tool: 'get_leaderboard' }, async () => 'again'),
    ).resolves.toBe('again');
    // one warning, not one per call
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('MLflow trace enrichment failed');
  });

  it('returns the result when setAttributes or updateCurrentTrace throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const span = {
      setAttributes: vi.fn(() => {
        throw new Error('bad attribute');
      }),
    };
    const { client } = fakeClient({
      getCurrentActiveSpan: vi.fn(() => span),
      updateCurrentTrace: vi.fn(() => {
        throw new Error('no trace');
      }),
    });
    setup(client);
    await expect(
      traceAgentTool({ agent: 'review-worker', tool: 'get_campaigns' }, async () => [1]),
    ).resolves.toEqual([1]);
  });

  it('runs the tool when @mlflow/core cannot be loaded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    _resetMlflowTracesForTests({
      env: ENV,
      load: async () => {
        throw Object.assign(new Error("Cannot find package '@mlflow/core'"), {
          code: 'ERR_MODULE_NOT_FOUND',
        });
      },
    });
    await expect(
      traceAgentTool({ agent: 'review-worker', tool: 'get_asset' }, async () => 42),
    ).resolves.toBe(42);
    expect(mlflowTracingState()).toBe('disabled');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('passes the tool error through unchanged and records it on the span', async () => {
    const { span, client } = fakeClient();
    setup(client);
    const boom = new Error('asset not found');

    await expect(
      traceAgentTool({ agent: 'review-worker', tool: 'get_asset' }, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(span.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'gt.tool': 'get_asset',
        'gt.error': true,
        'gt.error_message': 'asset not found',
        'gt.latency_ms': 42,
      }),
    );
  });

  it('does not load @mlflow/core when GT_MLFLOW_TRACES=false', async () => {
    const { client } = fakeClient();
    const { load } = setup(client, {
      env: { ...ENV, GT_MLFLOW_TRACES: 'false' } as NodeJS.ProcessEnv,
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(
      traceAgentTool({ agent: 'review-worker', tool: 'get_asset' }, async () => 'x'),
    ).resolves.toBe('x');
    expect(load).not.toHaveBeenCalled();
    expect(client.getCurrentActiveSpan).not.toHaveBeenCalled();
    expect(mlflowTracingState()).toBe('disabled');
  });

  it('skips enrichment when there is no active span', async () => {
    const { client } = fakeClient({ getCurrentActiveSpan: vi.fn(() => null) });
    setup(client);
    await expect(
      traceAgentTool({ agent: 'review-worker', tool: 'get_asset' }, async () => 'x'),
    ).resolves.toBe('x');
    expect(client.updateCurrentTrace).not.toHaveBeenCalled();
  });

  it('loads @mlflow/core once across concurrent calls', async () => {
    const { client } = fakeClient();
    const { load } = setup(client, { times: [] });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await Promise.all([initMlflowTraces(), initMlflowTraces(), initMlflowTraces()]);
    await traceAgentTool({ agent: 'review-worker', tool: 'get_asset' }, async () => 1);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('withToolTracing', () => {
  it('keeps tool metadata and names the span after the record key', async () => {
    const { span, client } = fakeClient();
    setup(client);
    const execute = vi.fn(async (args: Record<string, unknown>) => ({ echoed: args }));
    const tools = withToolTracing('review-worker', {
      get_asset: { type: 'function', description: 'd', execute },
    });

    expect(tools.get_asset.description).toBe('d');
    expect(tools.get_asset.type).toBe('function');
    await expect(tools.get_asset.execute({ asset_id: 'x' })).resolves.toEqual({
      echoed: { asset_id: 'x' },
    });
    expect(execute).toHaveBeenCalledWith({ asset_id: 'x' });
    expect(span.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ 'gt.agent': 'review-worker', 'gt.tool': 'get_asset' }),
    );
  });

  it('still runs the tool when tracing is broken', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = fakeClient({
      updateCurrentTrace: vi.fn(() => {
        throw new Error('boom');
      }),
    });
    setup(client);
    const tools = withToolTracing('review-worker', {
      get_leaderboard: { execute: async (_args: Record<string, unknown>) => ['row'] },
    });
    await expect(tools.get_leaderboard.execute({ period: '7d' })).resolves.toEqual(['row']);
  });
});

describe('real @mlflow/core module', () => {
  it('exposes the API this module calls', async () => {
    const mod = (await import('@mlflow/core')) as unknown as Record<string, unknown> & {
      default?: Record<string, unknown>;
    };
    const api = typeof mod.getCurrentActiveSpan === 'function' ? mod : (mod.default ?? {});
    expect(typeof api.getCurrentActiveSpan).toBe('function');
    expect(typeof api.updateCurrentTrace).toBe('function');
  });
});
