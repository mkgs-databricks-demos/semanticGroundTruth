// shared/contracts/api.test.ts — zod schema validation tests
// Session 15 · Wave 5 · Written, not run (no Node toolchain)

import { describe, expect, it } from 'vitest';
import {
  EDIT_VOTE_NEEDS_VALUE_MESSAGE,
  ExampleBodySchema,
  FeedbackQueueQuerySchema,
  ShareSlackRequestSchema,
  SlackChannelsQuerySchema,
  hasProposedEdit,
  ResolveConflictRequestSchema,
  ReviewableQuerySchema,
  SkipRequestSchema,
  UpdateConfigBodySchema,
  UpdateFeedbackBranchStatusRequestSchema,
  UpdateUserSettingsRequestSchema,
  UpsertFeedbackBranchRequestSchema,
  VoteBodySchema,
} from './api';
import { REVIEW_ACTIONS, VOTE_TYPES } from './values';

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

  // Build 5 follow-up 6: an edit vote must propose a value.
  it.each([
    ['no edits', {}],
    ['empty edits', { edits: {} }],
    ['blank values', { edits: { description: '   ', displayName: '' } }],
  ])('rejects an edit vote with %s (issue path edits)', (_label, extra) => {
    const result = VoteBodySchema.safeParse({ ...validBody, voteType: 'edit', ...extra });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['edits'], message: EDIT_VOTE_NEEDS_VALUE_MESSAGE }),
    ]);
  });

  it('accepts an edit vote with one non-blank value (others blank)', () => {
    const result = VoteBodySchema.safeParse({
      ...validBody,
      voteType: 'edit',
      edits: { description: ' ', plainEnglishLogic: 'Sum of net bookings' },
    });
    expect(result.success).toBe(true);
  });

  it('approve and reject votes do not need edits', () => {
    expect(VoteBodySchema.safeParse({ ...validBody, voteType: 'reject', edits: { description: '' } }).success).toBe(true);
  });

  it('hasProposedEdit trims values', () => {
    expect(hasProposedEdit(undefined)).toBe(false);
    expect(hasProposedEdit({ display_name: '\t' })).toBe(false);
    expect(hasProposedEdit({ display_name: ' Net revenue ' })).toBe(true);
  });
});

describe('Share to Slack request schemas (build 5)', () => {
  it('ShareSlackRequestSchema requires channelId and a mode', () => {
    expect(ShareSlackRequestSchema.safeParse({ channelId: 'C0123ABCD', mode: 'draft' }).success).toBe(true);
    expect(ShareSlackRequestSchema.safeParse({ channelId: 'C0123ABCD', mode: 'send', message: 'FYI' }).success).toBe(true);
    expect(ShareSlackRequestSchema.safeParse({ channelId: 'C0123ABCD' }).success).toBe(false);
    expect(ShareSlackRequestSchema.safeParse({ channelId: '  ', mode: 'draft' }).success).toBe(false);
    expect(ShareSlackRequestSchema.safeParse({ channelId: 'C1', mode: 'post' }).success).toBe(false);
    expect(ShareSlackRequestSchema.safeParse({ channelId: 'C1', mode: 'draft', message: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('SlackChannelsQuerySchema takes an optional query', () => {
    expect(SlackChannelsQuerySchema.parse({})).toEqual({});
    expect(SlackChannelsQuerySchema.parse({ query: ' data ' })).toEqual({ query: 'data' });
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

// ── Build 4 (plan 25) ──────────────────────────────────────────────────────

const ID = '550e8400-e29b-41d4-a716-446655440000';

describe('skip is not a vote', () => {
  it('VOTE_TYPES does not contain skip; REVIEW_ACTIONS does', () => {
    expect(VOTE_TYPES as readonly string[]).not.toContain('skip');
    expect(REVIEW_ACTIONS).toContain('skip');
    expect(REVIEW_ACTIONS).toEqual([...VOTE_TYPES, 'skip']);
  });

  it('VoteBodySchema rejects voteType skip', () => {
    expect(VoteBodySchema.safeParse({ assetId: ID, voteType: 'skip' }).success).toBe(false);
  });
});

describe('SkipRequestSchema', () => {
  it('accepts assetId only', () => {
    expect(SkipRequestSchema.safeParse({ assetId: ID }).success).toBe(true);
  });

  it('accepts campaignId and a known reason', () => {
    expect(SkipRequestSchema.safeParse({ assetId: ID, campaignId: ID, reason: 'not_my_area' }).success).toBe(true);
  });

  it('rejects an unknown reason', () => {
    expect(SkipRequestSchema.safeParse({ assetId: ID, reason: 'bored' }).success).toBe(false);
  });
});

describe('UpdateUserSettingsRequestSchema', () => {
  it('accepts a partial update', () => {
    expect(UpdateUserSettingsRequestSchema.safeParse({ theme: 'dark' }).success).toBe(true);
  });

  it('accepts clearing defaultCampaignId with null', () => {
    expect(UpdateUserSettingsRequestSchema.safeParse({ defaultCampaignId: null }).success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(UpdateUserSettingsRequestSchema.safeParse({}).success).toBe(false);
  });

  it('rejects cardsPerSession outside 5-100', () => {
    expect(UpdateUserSettingsRequestSchema.safeParse({ cardsPerSession: 4 }).success).toBe(false);
    expect(UpdateUserSettingsRequestSchema.safeParse({ cardsPerSession: 101 }).success).toBe(false);
    expect(UpdateUserSettingsRequestSchema.safeParse({ cardsPerSession: 100 }).success).toBe(true);
  });

  it('rejects unknown keys (updatedAt is not editable)', () => {
    expect(UpdateUserSettingsRequestSchema.safeParse({ theme: 'light', updatedAt: 'x' }).success).toBe(false);
  });
});

describe('UpdateConfigBodySchema.skipCooldownHours', () => {
  it('accepts 0-720', () => {
    expect(UpdateConfigBodySchema.safeParse({ skipCooldownHours: 0 }).success).toBe(true);
    expect(UpdateConfigBodySchema.safeParse({ skipCooldownHours: 720 }).success).toBe(true);
  });

  it('rejects values outside 0-720', () => {
    expect(UpdateConfigBodySchema.safeParse({ skipCooldownHours: -1 }).success).toBe(false);
    expect(UpdateConfigBodySchema.safeParse({ skipCooldownHours: 721 }).success).toBe(false);
  });
});

describe('steward triage request schemas', () => {
  it('FeedbackQueueQuerySchema defaults status=pending and coerces paging', () => {
    const q = FeedbackQueueQuerySchema.parse({ limit: '10' });
    expect(q).toEqual({ status: 'pending', limit: 10, offset: 0 });
  });

  it('ResolveConflictRequestSchema: accept_edit requires voteId', () => {
    expect(ResolveConflictRequestSchema.safeParse({ resolution: 'accept_edit' }).success).toBe(false);
    expect(ResolveConflictRequestSchema.safeParse({ resolution: 'accept_edit', voteId: ID }).success).toBe(true);
    expect(ResolveConflictRequestSchema.safeParse({ resolution: 'reject_all' }).success).toBe(true);
  });

  it('UpsertFeedbackBranchRequestSchema only accepts mg-genie-feedback-<yyyymmdd> branches', () => {
    const body = { branchName: 'mg-genie-feedback-20261024', files: ['a.yaml'], status: 'proposed' };
    expect(UpsertFeedbackBranchRequestSchema.safeParse(body).success).toBe(true);
    expect(UpsertFeedbackBranchRequestSchema.safeParse({ ...body, branchName: 'mg-genie-feedback-20261024-2' }).success).toBe(true);
    expect(UpsertFeedbackBranchRequestSchema.safeParse({ ...body, branchName: 'feedback/2026-10-24' }).success).toBe(false);
    expect(UpsertFeedbackBranchRequestSchema.safeParse({ ...body, branchName: 'main' }).success).toBe(false);
  });

  it('UpsertFeedbackBranchRequestSchema keeps uuid voteIds and rejects others', () => {
    const body = { branchName: 'mg-genie-feedback-20261024', files: ['a.yaml'], status: 'proposed' };
    const voteIds = ['644eff17-327b-4a18-9563-68ebc160dd81'];
    const parsed = UpsertFeedbackBranchRequestSchema.safeParse({ ...body, voteIds });
    expect(parsed.success && parsed.data.voteIds).toEqual(voteIds);
    expect(UpsertFeedbackBranchRequestSchema.safeParse({ ...body, voteIds: ['v1'] }).success).toBe(false);
  });

  it('UpdateFeedbackBranchStatusRequestSchema allows only steward transitions', () => {
    expect(UpdateFeedbackBranchStatusRequestSchema.safeParse({ status: 'merged' }).success).toBe(true);
    expect(UpdateFeedbackBranchStatusRequestSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });
});
