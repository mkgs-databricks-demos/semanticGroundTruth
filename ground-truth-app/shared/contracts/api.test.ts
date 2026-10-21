// shared/contracts/api.test.ts — zod schema validation tests
// Session 15 · Wave 5 · Written, not run (no Node toolchain)

import { describe, expect, it } from 'vitest';
import {
  ExampleBodySchema,
  ReviewableQuerySchema,
  VoteBodySchema,
} from './api';

describe('VoteBodySchema', () => {
  const validBody = {
    assetId: '550e8400-e29b-41d4-a716-446655440000',
    voteType: 'approve',
  };

  it('accepts a valid approve vote', () => {
    const result = VoteBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it('accepts a valid edit vote with edits', () => {
    const result = VoteBodySchema.safeParse({
      ...validBody,
      voteType: 'edit',
      feedback: 'Needs better description',
      edits: { description: 'Updated desc' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid voteType', () => {
    const result = VoteBodySchema.safeParse({
      ...validBody,
      voteType: 'abstain',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing assetId', () => {
    const result = VoteBodySchema.safeParse({ voteType: 'approve' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID assetId', () => {
    const result = VoteBodySchema.safeParse({
      assetId: 'not-a-uuid',
      voteType: 'approve',
    });
    expect(result.success).toBe(false);
  });
});

describe('ExampleBodySchema', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts add with questionText', () => {
    const result = ExampleBodySchema.safeParse({
      assetId: validUuid,
      action: 'add',
      questionText: 'What is total revenue?',
    });
    expect(result.success).toBe(true);
  });

  it('accepts approve with questionId', () => {
    const result = ExampleBodySchema.safeParse({
      assetId: validUuid,
      action: 'approve',
      questionId: validUuid,
    });
    expect(result.success).toBe(true);
  });

  it('rejects add without questionText (refinement)', () => {
    const result = ExampleBodySchema.safeParse({
      assetId: validUuid,
      action: 'add',
    });
    expect(result.success).toBe(false);
  });

  it('rejects approve without questionId (refinement)', () => {
    const result = ExampleBodySchema.safeParse({
      assetId: validUuid,
      action: 'approve',
    });
    expect(result.success).toBe(false);
  });
});

describe('ReviewableQuerySchema', () => {
  it('coerces string limit and offset to numbers', () => {
    const result = ReviewableQuerySchema.parse({
      limit: '20',
      offset: '5',
    });
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(5);
  });

  it('applies defaults when omitted', () => {
    const result = ReviewableQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('rejects limit above 200', () => {
    const result = ReviewableQuerySchema.safeParse({ limit: '999' });
    expect(result.success).toBe(false);
  });
});
