// server/lib/otelEnvCheck.test.ts — startup OTel env check (Dependabot follow-up 3)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkOtelEnv, logOtelEnvCheck } from './otelEnvCheck';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkOtelEnv', () => {
  it('unset env: neither component is enabled', () => {
    expect(checkOtelEnv({})).toEqual({
      metricsExporters: [],
      propagators: [],
      prometheusExporter: false,
      jaegerPropagator: false,
      otelVarNames: [],
    });
  });

  it('otlp metrics and a sampler setting do not enable either component', () => {
    const report = checkOtelEnv({
      OTEL_METRICS_EXPORTER: 'otlp',
      OTEL_TRACES_SAMPLER: 'always_on',
    });
    expect(report.prometheusExporter).toBe(false);
    expect(report.jaegerPropagator).toBe(false);
    expect(report.metricsExporters).toEqual(['otlp']);
  });

  it('flags prometheus in a list, ignoring spaces and case', () => {
    const report = checkOtelEnv({ OTEL_METRICS_EXPORTER: 'otlp, Prometheus ' });
    expect(report.metricsExporters).toEqual(['otlp', 'prometheus']);
    expect(report.prometheusExporter).toBe(true);
  });

  it('flags jaeger in OTEL_PROPAGATORS', () => {
    const report = checkOtelEnv({ OTEL_PROPAGATORS: 'tracecontext,baggage,jaeger' });
    expect(report.propagators).toEqual(['tracecontext', 'baggage', 'jaeger']);
    expect(report.jaegerPropagator).toBe(true);
  });

  it('none and empty items do not count', () => {
    const report = checkOtelEnv({ OTEL_METRICS_EXPORTER: 'none', OTEL_PROPAGATORS: ' , ' });
    expect(report.prometheusExporter).toBe(false);
    expect(report.jaegerPropagator).toBe(false);
    expect(report.propagators).toEqual([]);
  });

  it('lists OTEL_* names only, sorted, and never their values', () => {
    const report = checkOtelEnv({
      OTEL_SERVICE_NAME: 'svc',
      OTEL_EXPORTER_OTLP_HEADERS: 'x-databricks-auth=abc123',
      PATH: '/usr/bin',
      OTEL_UNSET: undefined,
    });
    expect(report.otelVarNames).toEqual(['OTEL_EXPORTER_OTLP_HEADERS', 'OTEL_SERVICE_NAME']);
    expect(JSON.stringify(report)).not.toContain('abc123');
  });
});

describe('logOtelEnvCheck', () => {
  it('logs one info line when neither component is enabled', () => {
    const info = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logOtelEnvCheck({ OTEL_METRICS_EXPORTER: 'otlp' });
    expect(warn).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(info.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(entry).toMatchObject({
      level: 'info',
      check: 'otel_env',
      prometheusExporter: false,
      jaegerPropagator: false,
    });
  });

  it('logs one warn line when a flagged component is enabled', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logOtelEnvCheck({ OTEL_PROPAGATORS: 'jaeger' });
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(JSON.parse(line)).toMatchObject({ level: 'warn', jaegerPropagator: true });
    // Apps log ingestion tags any line containing "error:" as ERROR.
    expect(line.toLowerCase()).not.toContain('error:');
  });
});
