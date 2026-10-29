// server/lib/otelEnvCheck.ts — one startup log line for the OTel env that
// decides whether two vulnerable OTel components load.
//
// Dependabot follow-up 3 (docs/requests/2026-10-29_dependabot-follow-ups.md).
// `@mlflow/core` builds `new NodeSDK({ spanProcessors })` with no metric reader
// and no propagator, so `@opentelemetry/sdk-node` 0.205.0 takes both from env:
//   * PrometheusExporter (GHSA-q7rr) only when OTEL_METRICS_EXPORTER lists `prometheus`
//   * JaegerPropagator (GHSA-45rx) only when OTEL_PROPAGATORS lists `jaeger`
// The Apps platform injects its own OTEL_* env, so the deployed values are
// logged once at startup. Only those two values are logged; for every other
// OTEL_* variable only the name is logged (OTLP headers can carry credentials).

import { logger } from './logger';

export interface OtelEnvReport {
  /** Parsed OTEL_METRICS_EXPORTER (empty = unset; sdk-node then uses otlp). */
  metricsExporters: string[];
  /** Parsed OTEL_PROPAGATORS (empty = unset; default tracecontext,baggage). */
  propagators: string[];
  /** True when sdk-node would start the Prometheus exporter (GHSA-q7rr). */
  prometheusExporter: boolean;
  /** True when sdk-node would install the Jaeger propagator (GHSA-45rx). */
  jaegerPropagator: boolean;
  /** Sorted names (no values) of every OTEL_* variable that is set. */
  otelVarNames: string[];
}

type Env = Record<string, string | undefined>;

/** Same split as sdk-node's getStringListFromEnv; lower-cased to err on the side of flagging. */
function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

export function checkOtelEnv(env: Env = process.env): OtelEnvReport {
  const metricsExporters = parseList(env.OTEL_METRICS_EXPORTER);
  const propagators = parseList(env.OTEL_PROPAGATORS);
  return {
    metricsExporters,
    propagators,
    prometheusExporter: metricsExporters.includes('prometheus'),
    jaegerPropagator: propagators.includes('jaeger'),
    otelVarNames: Object.keys(env)
      .filter((name) => name.startsWith('OTEL_') && env[name] !== undefined)
      .sort(),
  };
}

/** Logs the report once: `info` when neither component loads, `warn` otherwise. */
export function logOtelEnvCheck(env: Env = process.env): OtelEnvReport {
  const report = checkOtelEnv(env);
  const meta = { check: 'otel_env', ...report };
  if (report.prometheusExporter || report.jaegerPropagator) {
    logger.warn('OTel env check: a component flagged by Dependabot is enabled', meta);
  } else {
    logger.info('OTel env check: Prometheus exporter and Jaeger propagator not enabled', meta);
  }
  return report;
}
