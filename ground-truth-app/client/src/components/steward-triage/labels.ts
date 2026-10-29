// @a11y-strict
// client/src/components/steward-triage/labels.ts — copy and pure helpers for S8-S10
// Session 55 · Build 5 · wave 5-3 (screen_inventory.md S8-S10, figma_make_brief.md S8-S10)
//
// Everything here is pure (no React), so the rules the tests check (the
// "Often skipped" badge, vote bar name, proposal grouping, who gets notified)
// live in one place.

import type {
  Asset,
  ConflictGroup,
  EditField,
  EditProposal,
  FeedbackBatchStatus,
  FeedbackBranchReviewStatus,
  FeedbackQueueItem,
} from '../../../../shared/contracts';
import type { Status } from '../ui';

/** "1 approval", "2 approvals". */
export function countLabel(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** "a", "a and b", "a, b and c". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ── S8 Feedback queue ─────────────────────────────────────────────────────────────

export const QUEUE_TITLE = 'Feedback queue';
export const QUEUE_SUBTITLE = "Assets with new votes, edits or skips that need a steward's look.";
export const QUEUE_EMPTY_TITLE = 'Nothing waiting for triage';
export const QUEUE_FILTERED_EMPTY_TITLE = 'No assets match these filters';
export const OFTEN_SKIPPED = 'Often skipped';

/** Accessible name of the vote bar: "8 approvals, 2 rejections, 3 edits" (brief S8). */
export function voteBarLabel(votes: FeedbackQueueItem['votes']): string {
  return [
    countLabel(votes.approve, 'approval'),
    countLabel(votes.reject, 'rejection'),
    countLabel(votes.edit, 'edit'),
  ].join(', ');
}

export function totalVotes(votes: FeedbackQueueItem['votes']): number {
  return votes.approve + votes.reject + votes.edit;
}

/**
 * "Often skipped" badge (screen_inventory.md S8): skips >= total votes, a
 * signal that the definition is unclear. An asset nobody has seen (0 skips)
 * never gets it.
 */
export function isOftenSkipped(item: Pick<FeedbackQueueItem, 'skips' | 'votes'>): boolean {
  return item.skips > 0 && item.skips >= totalVotes(item.votes);
}

/** Pending edits from which the row links to Conflicts (inventory S8: `pendingEdits >= 2`). */
export const RESOLVE_LINK_MIN_EDITS = 2;

export function canResolve(item: Pick<FeedbackQueueItem, 'pendingEdits'>): boolean {
  return item.pendingEdits >= RESOLVE_LINK_MIN_EDITS;
}

/** /steward/conflicts preselecting one asset. */
export function conflictsHref(assetId: string): string {
  return `/steward/conflicts?assetId=${encodeURIComponent(assetId)}`;
}

// ── S9 Conflicts ───────────────────────────────────────────────────────────────────

export const CONFLICTS_TITLE = 'Conflicts';
export const CONFLICTS_SUBTITLE = 'Assets where reviewers proposed different edits, or edited and rejected the same asset.';
export const CONFLICTS_EMPTY_TITLE = 'No conflicts. Reviewers agree.';
export const CONFLICT_STALE_TITLE = 'Another steward already resolved this.';
export const NOTE_MAX = 4000;

export const FIELD_LABELS: Readonly<Record<EditField, string>> = {
  description: 'Description',
  plain_english_logic: 'Plain English logic',
  display_name: 'Display name',
};

const FIELD_PLURALS: Readonly<Record<EditField, string>> = {
  description: 'descriptions',
  plain_english_logic: 'plain English logic',
  display_name: 'display names',
};

/** The current value of `field` on the asset (empty string when unset). */
export function currentFieldValue(asset: Asset, field: EditField): string {
  if (field === 'description') return asset.description ?? '';
  if (field === 'plain_english_logic') return asset.plainEnglishLogic ?? '';
  return asset.displayName ?? '';
}

/** One edit vote: the server emits one EditProposal per edited field of the vote. */
export interface Proposal {
  voteId: string;
  userId: string;
  createdAt: string;
  edits: EditProposal[];
}

/** Group a conflict's edits by vote, in the order the server sent them. */
export function groupProposals(edits: readonly EditProposal[]): Proposal[] {
  const byVote = new Map<string, Proposal>();
  for (const e of edits) {
    const p = byVote.get(e.voteId);
    if (p) p.edits.push(e);
    else byVote.set(e.voteId, { voteId: e.voteId, userId: e.userId, createdAt: e.createdAt, edits: [e] });
  }
  return [...byVote.values()];
}

/** Fields touched by a conflict, in EDIT_FIELDS order of first appearance. */
export function conflictFields(group: Pick<ConflictGroup, 'edits'>): EditField[] {
  return [...new Set(group.edits.map((e) => e.field))];
}

/** Radiogroup name (brief S9: "Proposed descriptions"); "Proposed edits" when fields differ. */
export function proposalsGroupName(fields: readonly EditField[]): string {
  return fields.length === 1 ? `Proposed ${FIELD_PLURALS[fields[0]]}` : 'Proposed edits';
}

/** "2 proposals · 2 rejects" (list item summary). */
export function conflictSummary(group: ConflictGroup): string {
  const proposals = groupProposals(group.edits).length;
  return `${countLabel(proposals, 'proposal')} · ${countLabel(group.rejectCount, 'reject')}`;
}

/** "8 approvals · 2 rejections". */
export function tallyLabel(group: Pick<ConflictGroup, 'approveCount' | 'rejectCount'>): string {
  return `${countLabel(group.approveCount, 'approval')} · ${countLabel(group.rejectCount, 'rejection')}`;
}

/** Latest proposal time of a group (list item age). */
export function latestEditAt(group: Pick<ConflictGroup, 'edits'>): string | null {
  let latest: string | null = null;
  for (const e of group.edits) if (latest === null || e.createdAt > latest) latest = e.createdAt;
  return latest;
}

/**
 * Edit authors the server notifies on resolve: every distinct author except
 * the resolving steward (stewardService.resolveConflict).
 */
export function authorsToNotify(group: Pick<ConflictGroup, 'edits'>, stewardId: string | undefined): string[] {
  return [...new Set(group.edits.map((e) => e.userId))].filter((u) => u !== stewardId);
}

/** Avatar initials from a user id (an email in this app): ana.duarte@x → "AD". */
export function initials(userId: string): string {
  const local = userId.split('@')[0] ?? userId;
  const parts = local.split(/[._\-\s]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2);
  return letters.toUpperCase();
}

// ── S10 Feedback branches ───────────────────────────────────────────────────────────

export const BRANCHES_TITLE = 'Feedback branches';
export const BRANCHES_SUBTITLE =
  'Branches the feedback pipeline opened with approved edits. Review and merge them in Git, then record the outcome here.';
export const BRANCHES_EMPTY_TITLE = 'No feedback branches yet';
export const BRANCHES_EMPTY_TEXT = 'The feedback pipeline opens one when approved edits are ready.';
export const BRANCH_COPIED = 'Branch name copied';

/** Badge per batch status (inventory S10): text + icon, never color alone. */
export const BRANCH_STATUS_SPEC: Readonly<Record<FeedbackBatchStatus, { status: Status; label: string }>> = {
  pending: { status: 'pending', label: 'Pending' },
  proposed: { status: 'open', label: 'Proposed' },
  in_review: { status: 'warning', label: 'In review' },
  merged: { status: 'merged', label: 'Merged' },
  rejected: { status: 'rejected', label: 'Rejected' },
  failed: { status: 'error', label: 'Failed' },
};

/** Status actions, by current status: the server accepts them only from proposed / in_review. */
export const BRANCH_ACTIONS: Readonly<Partial<Record<FeedbackBatchStatus, readonly FeedbackBranchReviewStatus[]>>> = {
  proposed: ['in_review', 'merged', 'rejected'],
  in_review: ['merged', 'rejected'],
};

export const BRANCH_ACTION_LABELS: Readonly<Record<FeedbackBranchReviewStatus, string>> = {
  in_review: 'Mark in review',
  merged: 'Mark merged',
  rejected: 'Mark rejected',
};

/** Only http(s) links are rendered (htmlUrl is server-built, but never trust a scheme). */
export function safeHttpUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}
