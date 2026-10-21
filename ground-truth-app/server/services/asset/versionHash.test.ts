// server/services/asset/versionHash.test.ts — normalisation tests
// Session 15 · Wave 5 · Written, not run (no Node toolchain)

import { describe, expect, it } from 'vitest';
import { computeVersionHash } from './versionHash';

describe('computeVersionHash', () => {
  const sampleYaml = 'measures:\n  - name: revenue\n    expr: SUM(amount)';

  it('returns a 64-char hex SHA-256', () => {
    const hash = computeVersionHash(sampleYaml);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same hash for CRLF vs LF', () => {
    const lf = 'line1\nline2\nline3';
    const crlf = 'line1\r\nline2\r\nline3';
    expect(computeVersionHash(crlf)).toBe(computeVersionHash(lf));
  });

  it('produces the same hash when trailing spaces differ', () => {
    const clean = 'measures:\n  - name: revenue';
    const trailing = 'measures:   \n  - name: revenue   ';
    expect(computeVersionHash(trailing)).toBe(computeVersionHash(clean));
  });

  it('produces different hashes for different content', () => {
    const a = 'measures:\n  - name: revenue';
    const b = 'measures:\n  - name: cost';
    expect(computeVersionHash(a)).not.toBe(computeVersionHash(b));
  });
});
