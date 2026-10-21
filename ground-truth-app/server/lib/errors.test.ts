// server/lib/errors.test.ts — toAppError mapping tests
// Session 15 · Wave 5 · Written, not run (no Node toolchain)

import { describe, expect, it } from 'vitest';
import { AppError, toAppError } from './errors';

describe('toAppError', () => {
  it('returns the same AppError when given one', () => {
    const original = new AppError('NOT_FOUND' as never, 'gone');
    const result = toAppError(original);
    expect(result).toBe(original);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.status).toBe(404);
  });

  it('maps ZodError to BAD_REQUEST with issues in details', () => {
    const zodError = {
      name: 'ZodError',
      issues: [
        { path: ['voteType'], message: 'Invalid enum value' },
      ],
    };
    const result = toAppError(zodError);
    expect(result.code).toBe('BAD_REQUEST');
    expect(result.status).toBe(400);
    expect(result.message).toBe('Validation failed');
    expect(result.details).toEqual({ issues: zodError.issues });
  });

  it('maps pg 23505 (unique violation) to CONFLICT', () => {
    const pgError = { code: '23505', message: 'duplicate key value' };
    const result = toAppError(pgError);
    expect(result.code).toBe('CONFLICT');
    expect(result.status).toBe(409);
    expect(result.message).toBe('duplicate key value');
  });

  it('maps pg 23503 (foreign key violation) to BAD_REQUEST', () => {
    const pgError = { code: '23503', message: 'foreign key constraint' };
    const result = toAppError(pgError);
    expect(result.code).toBe('BAD_REQUEST');
    expect(result.status).toBe(400);
  });

  it('maps unknown errors to INTERNAL', () => {
    const result = toAppError(new Error('kaboom'));
    expect(result.code).toBe('INTERNAL');
    expect(result.status).toBe(500);
    expect(result.message).toBe('An unexpected error occurred');
  });

  it('maps null to INTERNAL', () => {
    const result = toAppError(null);
    expect(result.code).toBe('INTERNAL');
    expect(result.status).toBe(500);
  });

  it('maps a plain string to INTERNAL', () => {
    const result = toAppError('oops');
    expect(result.code).toBe('INTERNAL');
    expect(result.status).toBe(500);
  });
});
