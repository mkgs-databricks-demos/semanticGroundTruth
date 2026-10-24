// server/routes/config.test.ts — config route unit tests
// Session 20 · Wave 0

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { resolveExecDashboardUrl } from './config';

describe('resolveExecDashboardUrl', () => {
  const ENV_KEY = 'GT_EXEC_DASHBOARD_URL';
  let original: string | undefined;

  beforeEach(() => {
    original = process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it('returns the URL when set to a valid https URL', () => {
    process.env[ENV_KEY] = 'https://fevm-hls-fde.cloud.databricks.com/dashboards/abc123';
    expect(resolveExecDashboardUrl()).toBe(
      'https://fevm-hls-fde.cloud.databricks.com/dashboards/abc123',
    );
  });

  it('returns null when env is unset', () => {
    delete process.env[ENV_KEY];
    expect(resolveExecDashboardUrl()).toBeNull();
  });

  it('returns null when env is empty string', () => {
    process.env[ENV_KEY] = '';
    expect(resolveExecDashboardUrl()).toBeNull();
  });

  it('returns null when env is whitespace only', () => {
    process.env[ENV_KEY] = '   ';
    expect(resolveExecDashboardUrl()).toBeNull();
  });

  it('returns null for http:// (non-https)', () => {
    process.env[ENV_KEY] = 'http://example.com/dashboard';
    expect(resolveExecDashboardUrl()).toBeNull();
  });

  it('returns null for a bare path (non-https)', () => {
    process.env[ENV_KEY] = '/dashboards/abc123';
    expect(resolveExecDashboardUrl()).toBeNull();
  });

  it('trims whitespace before validation', () => {
    process.env[ENV_KEY] = '  https://example.com/dashboard  ';
    expect(resolveExecDashboardUrl()).toBe('https://example.com/dashboard');
  });
});
