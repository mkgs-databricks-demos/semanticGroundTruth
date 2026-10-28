// tests/contract/fakeStore.ts — seeded in-memory data layer behind every route and MCP tool
// Session 35 · Wave 4-3 · test-only · No enum, no namespace, no default export
//
// FakeStore holds the fixture state; createFakeServices() returns a Services
// object whose methods read and write it. Each fake is typed as Pick<RealClass, ...>
// so a signature change in a real service breaks `tsc -p tests/contract`.
// Business rules that already exist as pure functions (Wilson score, status
// derivation, conflict detection, resolution mapping, campaign transitions,
// default settings) are imported from the server, not re-implemented.
//
// Switches: `failAll` makes every data-layer call throw a plain Error (500);
// `upstreamDown` makes every Unity Catalog / SQL warehouse call throw
// UPSTREAM_ERROR (502); `dbDown` makes the health check's SELECT 1 fail.

import type { Db } from '../../server/lib/db';
import type { AppSettings, ConfigStore } from '../../server/lib/config';
import { DEFAULT_SETTINGS } from '../../server/lib/config';
import type { UserContext } from '../../server/lib/context';
import { badRequest, conflict, notFound, upstream } from '../../server/lib/errors';
import type { Services } from '../../server/services';
import type { AssetRegistry } from '../../server/services/asset';
import type { CampaignManager } from '../../server/services/campaign';
import { assertTransition } from '../../server/services/campaign';
import type { MembershipService } from '../../server/services/membership';
import type { MetricViewService } from '../../server/services/metricView';
import type { NotificationService } from '../../server/services/notification';
import type { ReviewEngine } from '../../server/services/review';
import { computeConfidence, deriveStatus, wilsonLowerBound } from '../../server/services/review/wilsonScore';
import type { UserSettingsService } from '../../server/services/settings';
import { DEFAULT_USER_SETTINGS } from '../../server/services/settings/userSettingsService';
import type { StewardService, TriageVoteRow } from '../../server/services/steward/stewardService';
import { detectConflicts, resolutionFor, shouldNotifyOnUpsert } from '../../server/services/steward/stewardService';
import { feedbackBranchHtmlUrl } from '../../server/services/steward/feedbackRepo';
import type { SourceService } from '../../server/services/sources';
import type {
  AppGroup,
  Asset,
  AssetSource,
  AssetSynonym,
  AssetVersion,
  Campaign,
  ConfidenceScore,
  ExampleQuestion,
  FeedbackBatch,
  FeedbackBranch,
  LeaderboardEntry,
  MetricViewSummary,
  Notification,
  NotificationPreference,
  ReviewSkip,
  UserSettings,
  UserStats,
  Vote,
} from '../../shared/contracts/entities';
import type { ReviewCard } from '../../shared/contracts/review';
import type { ConflictResolution } from '../../shared/contracts/values';
import {
  ASSETS,
  CAMPAIGNS,
  CATALOGS,
  EXAMPLES,
  FEEDBACK_BATCHES,
  FEEDBACK_REPO_URL,
  GROUPS,
  METRIC_VIEW,
  METRIC_VIEW_FQN,
  BROKEN_METRIC_VIEW_FQN,
  NOTIFICATIONS,
  NOW,
  PREFERENCES,
  QUERY_RESULT,
  SCAN_RESULT,
  SCHEMAS,
  SOURCES,
  SYNONYMS,
  USERS,
  VERSIONS,
  VOTES,
} from './fixtures';

export interface StoredVote extends Vote {
  campaignId: string | null;
  resolution: ConflictResolution | null;
  isProcessed: boolean;
}
export interface StoredSkip extends ReviewSkip {
  userId: string;
}

const clone = <T>(v: T): T => structuredClone(v);
const DAY_MS = 86_400_000;

export class FakeStore {
  clockMs = Date.parse(NOW);
  failAll = false;
  upstreamDown = false;
  dbDown = false;
  private seq = 0;

  assets: Asset[] = clone(ASSETS).map((a) => ({ ...a, synonyms: [] }));
  synonyms: AssetSynonym[] = clone(SYNONYMS);
  versions: AssetVersion[] = clone(VERSIONS);
  examples: ExampleQuestion[] = clone(EXAMPLES);
  votes: StoredVote[] = VOTES.map((v) => ({
    id: v.id,
    assetId: v.assetId,
    userId: v.userId,
    voteType: v.voteType,
    source: 'web',
    feedback: v.feedback,
    editDescription: v.editDescription,
    editPlainEnglishLogic: null,
    editDisplayName: null,
    createdAt: v.createdAt,
    campaignId: v.campaignId,
    resolution: null,
    isProcessed: false,
  }));
  skips: StoredSkip[] = [];
  campaigns: Campaign[] = clone(CAMPAIGNS);
  batches: FeedbackBatch[] = clone(FEEDBACK_BATCHES);
  notifications: Notification[] = clone(NOTIFICATIONS);
  preferences: NotificationPreference[] = clone(PREFERENCES);
  groups: AppGroup[] = clone(GROUPS);
  settings = new Map<string, UserSettings>();
  config: AppSettings = { ...clone(DEFAULT_SETTINGS) };
  sources: AssetSource[] = clone(SOURCES);
  mcpSessions = new Map<string, { current_asset_id: string; campaign_id: string | null; updated_at: string }>();
  /** Steward notifications the fake steward service sent (eventType + batchId), in order. */
  stewardNotifications: { eventType: string; batchId: string }[] = [];

  now(): string {
    return new Date(this.clockMs).toISOString();
  }
  advanceHours(h: number): void {
    this.clockMs += h * 3_600_000;
  }
  /** Next generated id (v4-shaped, prefix f). */
  newId(): string {
    this.seq += 1;
    return `f0000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }
  guard(): void {
    if (this.failAll) throw new Error('fake data layer failure');
  }
  guardUpstream(): void {
    if (this.upstreamDown) throw upstream('Unity Catalog / SQL warehouse unavailable');
  }

  // ── reads used by the fakes and by the tests' expected values ──

  asset(id: string): Asset {
    const a = this.assets.find((x) => x.id === id);
    if (!a) throw notFound(`Asset not found: ${id}`);
    return { ...clone(a), synonyms: this.synonymsOf(id) };
  }
  synonymsOf(assetId: string): AssetSynonym[] {
    return clone(this.synonyms.filter((s) => s.assetId === assetId));
  }
  examplesOf(assetId: string): ExampleQuestion[] {
    return clone(this.examples.filter((e) => e.assetId === assetId));
  }
  campaign(id: string): Campaign {
    const c = this.campaigns.find((x) => x.id === id);
    if (!c) throw notFound(`Campaign ${id} not found`);
    return clone(c);
  }
  publicVote(v: StoredVote): Vote {
    const { campaignId: _c, resolution: _r, isProcessed: _p, ...vote } = v;
    return clone(vote);
  }
  publicSkip(s: StoredSkip): ReviewSkip {
    const { userId: _u, ...skip } = s;
    return clone(skip);
  }

  /** Confidence from every vote on the asset (Wilson lower/upper bound with the app prior). */
  confidence(assetId: string): ConfidenceScore {
    const votes = this.votes.filter((v) => v.assetId === assetId);
    const approvals = votes.filter((v) => v.voteType === 'approve').length;
    const rejections = votes.filter((v) => v.voteType === 'reject').length;
    const edits = votes.filter((v) => v.voteType === 'edit').length;
    const { score, total } = computeConfidence({ approvals, rejections, edits }, this.config);
    const s = this.config;
    const w = total >= s.priorDecayThreshold ? 0 : s.priorWeight * (1 - total / s.priorDecayThreshold);
    const pos = approvals + 0.5 * edits + s.industryPrior * w;
    const adjTotal = total + w;
    const upper = adjTotal > 0 ? 1 - wilsonLowerBound(adjTotal - pos, adjTotal, s.wilsonZ) : 0;
    const last = votes.map((v) => v.createdAt).sort().at(-1) ?? null;
    return {
      assetId,
      totalVotes: total,
      approvals,
      rejections,
      edits,
      wilsonLower: score,
      wilsonUpper: upper,
      confidence: score,
      lastVoteAt: last,
      computedAt: this.now(),
    };
  }

  skipStats(userId: string): { skippedCount: number; skippedToday: number } {
    const mine = this.skips.filter((s) => s.userId === userId);
    const today = this.now().slice(0, 10);
    return { skippedCount: mine.length, skippedToday: mine.filter((s) => s.createdAt.slice(0, 10) === today).length };
  }

  leaderboard(period: '7d' | '30d' | 'all', limit: number): LeaderboardEntry[] {
    const since = period === 'all' ? -Infinity : this.clockMs - (period === '7d' ? 7 : 30) * DAY_MS;
    const inPeriod = (ts: string) => Date.parse(ts) >= since;
    const byUser = new Map<string, StoredVote[]>();
    for (const v of this.votes.filter((x) => inPeriod(x.createdAt))) {
      byUser.set(v.userId, [...(byUser.get(v.userId) ?? []), v]);
    }
    return [...byUser.entries()]
      .map(([userId, votes]) => ({ userId, votes }))
      .sort((a, b) => b.votes.length - a.votes.length || a.userId.localeCompare(b.userId))
      .slice(0, limit)
      .map(({ userId, votes }, i) => ({
        userId,
        email: userId,
        displayName: USERS.find((u) => u.userId === userId)?.displayName ?? userId,
        totalVotes: votes.length,
        approvals: votes.filter((v) => v.voteType === 'approve').length,
        rejections: votes.filter((v) => v.voteType === 'reject').length,
        edits: votes.filter((v) => v.voteType === 'edit').length,
        skippedCount: this.skips.filter((s) => s.userId === userId && inPeriod(s.createdAt)).length,
        currentStreakDays: this.streak(userId),
        rank: i + 1,
      }));
  }

  /** Consecutive UTC days with a vote, ending today or yesterday. */
  streak(userId: string): number {
    const days = new Set(this.votes.filter((v) => v.userId === userId).map((v) => v.createdAt.slice(0, 10)));
    let day = Date.parse(this.now().slice(0, 10));
    if (!days.has(new Date(day).toISOString().slice(0, 10))) day -= DAY_MS;
    let n = 0;
    while (days.has(new Date(day).toISOString().slice(0, 10))) {
      n += 1;
      day -= DAY_MS;
    }
    return n;
  }

  userStats(userId: string): UserStats {
    const mine = this.votes.filter((v) => v.userId === userId);
    const rank = this.leaderboard('all', 1000).find((e) => e.userId === userId)?.rank ?? 0;
    const covered = new Set(mine.map((v) => v.assetId)).size;
    return {
      totalVotes: mine.length,
      approvals: mine.filter((v) => v.voteType === 'approve').length,
      rejections: mine.filter((v) => v.voteType === 'reject').length,
      edits: mine.filter((v) => v.voteType === 'edit').length,
      ...this.skipStats(userId),
      currentStreakDays: this.streak(userId),
      rank,
      coveragePct: Math.round((covered / this.assets.length) * 1000) / 10,
    };
  }

  /** Next card: scope assets the user has not voted on, minus skips inside the cooldown. */
  nextCard(user: UserContext, q: { campaignId?: string; assetType?: Asset['assetType'] }): { card: ReviewCard | null; resurfacedFromSkip: boolean } {
    const campaign = q.campaignId ? this.campaign(q.campaignId) : null;
    const scope = (campaign?.scopeAssetIds ?? this.assets.map((a) => a.id))
      .map((id) => this.assets.find((a) => a.id === id))
      .filter((a): a is Asset => !!a && (!q.assetType || a.assetType === q.assetType));
    const voted = new Set(this.votes.filter((v) => v.userId === user.userId).map((v) => v.assetId));
    const candidates = scope.filter((a) => !voted.has(a.id));
    const cooldownMs = this.config.skipCooldownHours * 3_600_000;
    const lastSkip = (assetId: string) =>
      this.skips.filter((s) => s.userId === user.userId && s.assetId === assetId).map((s) => Date.parse(s.createdAt)).sort().at(-1);
    const fresh = candidates.filter((a) => {
      const at = lastSkip(a.id);
      return cooldownMs === 0 || at === undefined || this.clockMs - at >= cooldownMs;
    });
    let pick: Asset | undefined = fresh[0];
    let resurfacedFromSkip = false;
    if (!pick && candidates.length > 0 && cooldownMs > 0) {
      pick = [...candidates].sort((a, b) => (lastSkip(a.id) ?? 0) - (lastSkip(b.id) ?? 0))[0];
      resurfacedFromSkip = true;
    }
    if (!pick) return { card: null, resurfacedFromSkip: false };
    const hasVotes = this.votes.some((v) => v.assetId === pick!.id);
    const card: ReviewCard = {
      asset: this.asset(pick.id),
      synonyms: this.synonymsOf(pick.id),
      examples: this.examplesOf(pick.id),
      confidence: hasVotes ? this.confidence(pick.id) : null,
      ...(campaign ? { campaign: { campaignId: campaign.id, name: campaign.name } } : {}),
      reason: campaign ? 'campaign' : 'low_confidence',
      progress: { reviewed: scope.filter((a) => voted.has(a.id)).length, total: scope.length },
      // Same rule as ReviewEngine: everything in cooldown, or skipped before (cooldown passed).
      resurfacedFromSkip: resurfacedFromSkip || (cooldownMs > 0 && lastSkip(pick.id) !== undefined),
    };
    return { card, resurfacedFromSkip };
  }

  branch(b: FeedbackBatch): FeedbackBranch {
    return {
      batchId: b.id,
      branchName: b.branchName ?? '',
      status: b.status,
      assetCount: b.assetCount,
      files: [...b.files],
      summary: b.summary,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
      reviewedBy: b.reviewedBy,
      htmlUrl: feedbackBranchHtmlUrl(FEEDBACK_REPO_URL, b.branchName),
    };
  }

  triageRows(q: { campaignId?: string; assetType?: Asset['assetType'] } = {}): TriageVoteRow[] {
    const inCampaign = (assetId: string) =>
      !q.campaignId || (this.campaigns.find((c) => c.id === q.campaignId)?.scopeAssetIds ?? []).includes(assetId);
    const hasOpenEdit = (assetId: string) =>
      this.votes.some((v) => v.assetId === assetId && v.voteType === 'edit' && v.resolution === null);
    return this.votes
      .filter((v) => v.resolution === null && hasOpenEdit(v.assetId) && inCampaign(v.assetId))
      .filter((v) => !q.assetType || this.assets.find((a) => a.id === v.assetId)?.assetType === q.assetType)
      .sort((a, b) => a.assetId.localeCompare(b.assetId) || a.createdAt.localeCompare(b.createdAt))
      .map((v) => ({
        id: v.id,
        assetId: v.assetId,
        displayName: this.assets.find((a) => a.id === v.assetId)?.displayName ?? '',
        userId: v.userId,
        voteType: v.voteType,
        editDescription: v.editDescription,
        editPlainEnglishLogic: v.editPlainEnglishLogic,
        editDisplayName: v.editDisplayName,
        createdAt: v.createdAt,
      }));
  }

  metricViewSummary(): MetricViewSummary {
    const { fullName, comment, measureCount, dimensionCount } = METRIC_VIEW;
    return { fullName, comment, measureCount, dimensionCount };
  }
}

// ── Services ──

type ReviewFake = Pick<ReviewEngine, 'getNext' | 'getNextWithMeta' | 'submitVote' | 'skip' | 'recompute' | 'getUserStats' | 'getLeaderboard' | 'getExecutiveSummary' | 'runQuery'>;
type AssetsFake = Pick<AssetRegistry, 'list' | 'get' | 'listVersions' | 'register' | 'listSynonyms' | 'addSynonym' | 'voteSynonym' | 'removeSynonym' | 'listExamples' | 'addExample' | 'voteExample'>;
type CampaignsFake = Pick<CampaignManager, 'list' | 'create' | 'get' | 'updateStatus' | 'runFreshnessCheck'>;
type MetricViewsFake = Pick<MetricViewService, 'listCatalogs' | 'listSchemas' | 'listMetricViews' | 'list' | 'get' | 'validate'>;
type NotificationsFake = Pick<NotificationService, 'list' | 'unreadCount' | 'markRead' | 'getPreferences' | 'updatePreferences'>;
type MembershipFake = Pick<MembershipService, 'listGroups' | 'addMember' | 'removeMember'>;
type StewardFake = Pick<StewardService, 'feedbackQueue' | 'conflicts' | 'resolveConflict' | 'listFeedbackBranches' | 'upsertFeedbackBranch' | 'updateFeedbackBranchStatus'>;
type SettingsFake = Pick<UserSettingsService, 'get' | 'update'>;
type ConfigFake = Pick<ConfigStore, 'get' | 'update'>;
type SourcesFake = Pick<SourceService, 'list' | 'register' | 'scan' | 'importAssets'>;

/** Wrap every method so `store.failAll` turns it into a plain Error (HTTP 500). */
function guarded<T extends object>(store: FakeStore, impl: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, fn] of Object.entries(impl)) {
    out[k] = async (...args: unknown[]) => {
      store.guard();
      return (fn as (...a: unknown[]) => unknown)(...args);
    };
  }
  return out as T;
}

export interface FakeDb extends Db {
  store: FakeStore;
}

/** Only the SQL the routes / MCP session store issue directly; anything else is a test bug. */
export function createFakeDb(store: FakeStore): FakeDb {
  const run = async (text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
    if (/SELECT 1 AS ok/.test(text)) {
      if (store.dbDown) throw new Error('connection refused');
      return [{ ok: 1 }];
    }
    if (/FROM app\._migrations/.test(text)) return [{ count: '9' }];
    if (/FROM app\.mcp_sessions/.test(text)) {
      const row = store.mcpSessions.get(String(params[0]));
      return row ? [{ session_id: params[0], ...row }] : [];
    }
    if (/INSERT INTO app\.mcp_sessions/.test(text)) {
      store.mcpSessions.set(String(params[0]), {
        current_asset_id: String(params[2]),
        campaign_id: (params[3] as string | null) ?? null,
        updated_at: store.now(),
      });
      return [];
    }
    throw new Error(`FakeDb: unexpected SQL: ${text.slice(0, 80)}`);
  };
  return {
    store,
    query: async <T>(text: string, params?: unknown[]) => (await run(text, params)) as T[],
    one: async <T>(text: string, params?: unknown[]) => ((await run(text, params))[0] ?? null) as T | null,
    tx: async () => {},
  };
}

export function createFakeServices(store: FakeStore): Services {
  const review: ReviewFake = {
    getNextWithMeta: async (user, q) => store.nextCard(user, q),
    getNext: async (user, q) => store.nextCard(user, q).card,
    submitVote: async (user, body) => {
      const asset = store.asset(body.assetId);
      const vote: StoredVote = {
        id: store.newId(),
        assetId: asset.id,
        userId: user.userId,
        voteType: body.voteType,
        source: user.source,
        feedback: body.feedback ?? null,
        editDescription: body.edits?.description ?? null,
        editPlainEnglishLogic: body.edits?.plainEnglishLogic ?? null,
        editDisplayName: body.edits?.displayName ?? null,
        createdAt: store.now(),
        campaignId: null,
        resolution: null,
        isProcessed: false,
      };
      store.votes.push(vote);
      const confidence = store.confidence(asset.id);
      const assetStatus = deriveStatus(confidence.confidence, confidence.totalVotes, store.config);
      store.assets.find((a) => a.id === asset.id)!.status = assetStatus;
      return { vote: store.publicVote(vote), confidence, assetStatus, next: store.nextCard(user, {}).card };
    },
    skip: async (user, req, source = user.source) => {
      store.asset(req.assetId);
      if (req.campaignId) store.campaign(req.campaignId);
      const skip: StoredSkip = {
        id: store.newId(),
        assetId: req.assetId,
        campaignId: req.campaignId ?? null,
        reason: req.reason ?? null,
        versionHash: null,
        source,
        createdAt: store.now(),
        userId: user.userId,
      };
      store.skips.push(skip);
      return { skip: store.publicSkip(skip), stats: store.skipStats(user.userId) };
    },
    recompute: async (assetId) => {
      store.asset(assetId);
      return store.confidence(assetId);
    },
    getUserStats: async (userId) => store.userStats(userId),
    getLeaderboard: async (period = '7d', limit = 20) => store.leaderboard(period, limit),
    getExecutiveSummary: async () => {
      const total = store.assets.length;
      const reviewed = store.assets.filter((a) => a.status !== 'PENDING').length;
      const certified = store.assets.filter((a) => a.status === 'CERTIFIED').length;
      const recent = store.votes.filter((v) => Date.parse(v.createdAt) >= store.clockMs - 7 * DAY_MS);
      return {
        totalAssets: total,
        reviewedAssets: reviewed,
        certifiedAssets: certified,
        coveragePct: Math.round((reviewed / total) * 1000) / 10,
        certificationPct: Math.round((certified / total) * 1000) / 10,
        activeReviewers7d: new Set(recent.map((v) => v.userId)).size,
        votes7d: recent.length,
        activeCampaigns: store.campaigns.filter((c) => c.status === 'active').length,
      };
    },
    runQuery: async (_user, assetId) => {
      const asset = store.asset(assetId);
      store.guardUpstream();
      if (!asset.yamlContent) throw badRequest(`Asset ${assetId} has no validation query`);
      return clone(QUERY_RESULT);
    },
  };

  const assets: AssetsFake = {
    list: async (q) => {
      const all = store.assets
        .filter((a) => (!q.assetType || a.assetType === q.assetType) && (!q.status || a.status === q.status))
        .map((a) => store.asset(a.id));
      return { items: all.slice(q.offset, q.offset + q.limit), total: all.length, limit: q.limit, offset: q.offset };
    },
    get: async (id) => store.asset(id),
    listVersions: async (id) => {
      store.asset(id);
      return clone(store.versions.filter((v) => v.assetId === id)).sort((a, b) => b.version - a.version);
    },
    register: async (input, by) => {
      const existing = store.assets.find(
        (a) => a.name === input.name && a.targetCatalog === input.targetCatalog && a.targetSchema === input.targetSchema,
      );
      if (existing) {
        const newVersion = existing.yamlContent !== input.yamlContent;
        if (newVersion) {
          existing.yamlContent = input.yamlContent;
          existing.updatedAt = store.now();
        }
        return { asset: store.asset(existing.id), created: false, newVersion };
      }
      const asset: Asset = {
        id: store.newId(),
        assetType: input.assetType,
        name: input.name,
        displayName: input.displayName ?? input.name,
        description: input.description ?? null,
        plainEnglishLogic: input.plainEnglishLogic ?? null,
        yamlContent: input.yamlContent,
        repoUrl: input.repoUrl ?? null,
        fixturePath: input.fixturePath ?? null,
        branch: input.branch ?? null,
        environment: input.environment,
        targetCatalog: input.targetCatalog,
        targetSchema: input.targetSchema,
        status: 'PENDING',
        domain: input.domain ?? null,
        subdomain: input.subdomain ?? null,
        synonyms: [],
        sourceId: null,
        sourceMetadata: null,
        createdAt: store.now(),
        updatedAt: store.now(),
      };
      store.assets.push(asset);
      for (const synonym of input.synonyms ?? []) {
        store.synonyms.push({ id: store.newId(), assetId: asset.id, synonym, proposedBy: by, approvals: 0, rejections: 0, createdAt: store.now() });
      }
      return { asset: store.asset(asset.id), created: true, newVersion: false };
    },
    listSynonyms: async (assetId) => {
      store.asset(assetId);
      return store.synonymsOf(assetId);
    },
    addSynonym: async (assetId, synonym, userId) => {
      store.asset(assetId);
      if (!store.synonyms.some((s) => s.assetId === assetId && s.synonym === synonym)) {
        store.synonyms.push({ id: store.newId(), assetId, synonym, proposedBy: userId, approvals: 0, rejections: 0, createdAt: store.now() });
      }
    },
    voteSynonym: async (assetId, synonym, _userId, action) => {
      store.asset(assetId);
      const s = store.synonyms.find((x) => x.assetId === assetId && x.synonym === synonym);
      if (!s) throw notFound(`Synonym not found: ${synonym}`);
      if (action === 'approve') s.approvals += 1;
      else s.rejections += 1;
    },
    removeSynonym: async (assetId, synonym) => {
      store.asset(assetId);
      store.synonyms = store.synonyms.filter((s) => !(s.assetId === assetId && s.synonym === synonym));
    },
    listExamples: async (assetId) => {
      store.asset(assetId);
      return store.examplesOf(assetId);
    },
    addExample: async (assetId, questionText, userId) => {
      store.asset(assetId);
      store.examples.push({ id: store.newId(), assetId, questionText, proposedBy: userId, approved: false, createdAt: store.now() });
    },
    voteExample: async (questionId, _userId, action) => {
      const e = store.examples.find((x) => x.id === questionId);
      if (!e) throw notFound(`Example question not found: ${questionId}`);
      e.approved = action === 'approve';
    },
  };

  const campaigns: CampaignsFake = {
    list: async (_user, opts) => clone(store.campaigns.filter((c) => !opts?.status || c.status === opts.status)),
    create: async (body, createdBy) => {
      const scope = body.scopeAssetIds ?? store.assets
        .filter((a) => (!body.scopeDomain || a.domain === body.scopeDomain)
          && (!body.scopeSubdomain || a.subdomain === body.scopeSubdomain)
          && (!body.scopeAssetType || a.assetType === body.scopeAssetType))
        .map((a) => a.id);
      const c: Campaign = {
        id: store.newId(),
        name: body.name,
        campaignType: body.campaignType,
        status: 'active',
        completionRule: body.completionRule ?? 'reviewed_once',
        scopeDomain: body.scopeDomain ?? null,
        scopeSubdomain: body.scopeSubdomain ?? null,
        scopeAssetType: body.scopeAssetType ?? null,
        scopeAssetIds: scope,
        rbacGroups: body.rbacGroups ?? [],
        freshnessIntervalDays: body.freshnessIntervalDays ?? null,
        totalAssets: scope.length,
        reviewedAssets: 0,
        createdBy,
        createdAt: store.now(),
        updatedAt: store.now(),
        completedAt: null,
      };
      store.campaigns.push(c);
      return clone(c);
    },
    get: async (_user, id) => store.campaign(id),
    updateStatus: async (id, status) => {
      const c = store.campaigns.find((x) => x.id === id);
      if (!c) throw notFound(`Campaign ${id} not found`);
      assertTransition(c.status, status);
      c.status = status;
      c.updatedAt = store.now();
      c.completedAt = status === 'completed' ? store.now() : status === 'active' ? null : c.completedAt;
      return clone(c);
    },
    runFreshnessCheck: async () => {
      const cutoff = store.clockMs - store.config.stalenessDays * DAY_MS;
      const stale = store.assets.filter((a) => Date.parse(a.updatedAt) < cutoff);
      return { campaignId: null, added: stale.length };
    },
  };

  const metricViews: MetricViewsFake = {
    listCatalogs: async () => {
      store.guardUpstream();
      return clone(CATALOGS);
    },
    listSchemas: async (_t, catalog) => {
      store.guardUpstream();
      if (!CATALOGS.some((c) => c.name === catalog)) throw notFound(`Catalog not found: ${catalog}`);
      return clone(SCHEMAS);
    },
    listMetricViews: async (_t, catalog, schema) => {
      store.guardUpstream();
      if (!SCHEMAS.some((s) => s.fullName === `${catalog}.${schema}`)) throw notFound(`Schema not found: ${catalog}.${schema}`);
      return [store.metricViewSummary()];
    },
    list: async (_u, opts) => {
      store.guardUpstream();
      const prefix = [opts?.catalog, opts?.schema].filter(Boolean).join('.');
      return METRIC_VIEW_FQN.startsWith(prefix) ? [store.metricViewSummary()] : [];
    },
    get: async (_u, fullName) => {
      store.guardUpstream();
      if (fullName !== METRIC_VIEW_FQN) throw notFound(`Metric view not found: ${fullName}`);
      return clone(METRIC_VIEW);
    },
    validate: async (_u, fullName) => {
      store.guardUpstream();
      if (fullName === METRIC_VIEW_FQN) return { valid: true };
      if (fullName === BROKEN_METRIC_VIEW_FQN) return { valid: false, error: '[UNRESOLVED_COLUMN] revenue_usd' };
      throw notFound(`Metric view not found: ${fullName}`);
    },
  };

  const notifications: NotificationsFake = {
    list: async (userId, opts) => clone(store.notifications
      .filter((n) => n.userId === userId && (!opts?.unreadOnly || n.readAt === null))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, opts?.limit ?? 50)),
    unreadCount: async (userId) => store.notifications.filter((n) => n.userId === userId && n.readAt === null).length,
    markRead: async (userId, ids) => {
      const targets = store.notifications.filter((n) => n.userId === userId && n.readAt === null && (ids === 'all' || ids.includes(n.id)));
      for (const n of targets) {
        n.readAt = store.now();
        n.status = 'read';
      }
      return targets.length;
    },
    getPreferences: async (userId) => clone(store.preferences.filter((p) => p.userId === userId)).sort((a, b) => a.eventType.localeCompare(b.eventType)),
    updatePreferences: async (userId, prefs) => {
      for (const p of prefs) {
        store.preferences = store.preferences.filter((x) => !(x.userId === userId && x.eventType === p.eventType));
        store.preferences.push({ userId, eventType: p.eventType, channels: [...p.channels], digest: p.digest });
      }
      return clone(store.preferences.filter((p) => p.userId === userId)).sort((a, b) => a.eventType.localeCompare(b.eventType));
    },
  };

  const membership: MembershipFake = {
    listGroups: async () => clone(store.groups),
    addMember: async (groupName, memberId, addedBy) => {
      const g = store.groups.find((x) => x.name === groupName)!;
      const id = memberId.toLowerCase();
      if (!g.members.some((m) => m.memberId === id)) {
        g.members.push({ groupName, memberId: id, addedBy, addedAt: store.now() });
      }
    },
    removeMember: async (groupName, memberId) => {
      const g = store.groups.find((x) => x.name === groupName)!;
      if (groupName === 'semantic-ground-truth-admins' && g.members.length <= 1) {
        throw conflict('Cannot remove the last admin');
      }
      g.members = g.members.filter((m) => m.memberId !== memberId.toLowerCase());
    },
  };

  const steward: StewardFake = {
    feedbackQueue: async (q) => {
      const inCampaign = (assetId: string) =>
        !q.campaignId || (store.campaigns.find((c) => c.id === q.campaignId)?.scopeAssetIds ?? []).includes(assetId);
      const firstActive = (assetId: string) =>
        store.campaigns.filter((c) => c.status === 'active' && (c.scopeAssetIds ?? []).includes(assetId))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id ?? null;
      const items = store.assets
        .filter((a) => inCampaign(a.id) && (!q.assetType || a.assetType === q.assetType))
        .map((a) => {
          const votes = store.votes.filter((v) => v.assetId === a.id);
          const skips = store.skips.filter((s) => s.assetId === a.id);
          const times = [...votes.map((v) => v.createdAt), ...skips.map((s) => s.createdAt)].sort();
          return {
            item: {
              assetId: a.id,
              displayName: a.displayName,
              assetType: a.assetType,
              campaignId: q.campaignId ?? firstActive(a.id),
              votes: {
                approve: votes.filter((v) => v.voteType === 'approve').length,
                reject: votes.filter((v) => v.voteType === 'reject').length,
                edit: votes.filter((v) => v.voteType === 'edit').length,
              },
              skips: skips.length,
              pendingEdits: votes.filter((v) => v.voteType === 'edit' && v.resolution === null && !v.isProcessed).length,
              lastActivityAt: times.at(-1) ?? null,
            },
            active: votes.length > 0 || skips.length > 0,
            unprocessed: votes.filter((v) => !v.isProcessed).length,
          };
        })
        .filter((x) => x.active && (q.status !== 'pending' || x.unprocessed > 0))
        .map((x) => x.item)
        .sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '') || a.assetId.localeCompare(b.assetId));
      return { items: items.slice(q.offset, q.offset + q.limit), total: items.length, limit: q.limit, offset: q.offset };
    },
    conflicts: async (q) => detectConflicts(store.triageRows(q)),
    resolveConflict: async (user, assetId, req) => {
      store.asset(assetId);
      const group = detectConflicts(store.triageRows()).find((g) => g.assetId === assetId);
      if (!group) throw conflict(`Asset ${assetId} has no unresolved conflict`);
      if (req.resolution === 'accept_edit' && !group.edits.some((e) => e.voteId === req.voteId)) {
        throw notFound(`Edit vote ${req.voteId} is not an unresolved edit on asset ${assetId}`);
      }
      const open = store.votes.filter((v) => v.assetId === assetId && v.resolution === null);
      for (const v of open) v.resolution = resolutionFor(req, v.id);
      return { assetId, resolution: req.resolution, resolvedVotes: open.length, resolvedBy: user.userId, resolvedAt: store.now() };
    },
    listFeedbackBranches: async (q) =>
      store.batches.filter((b) => !q.status || b.status === q.status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((b) => store.branch(b)),
    upsertFeedbackBranch: async (user, req) => {
      const existing = req.batchId
        ? store.batches.find((b) => b.id === req.batchId)
        : store.batches.find((b) => b.branchName === req.branchName);
      if (req.batchId && !existing) throw notFound(`Feedback batch not found: ${req.batchId}`);
      const previousStatus = existing ? existing.status : null;
      const completes = req.status === 'proposed' || req.status === 'failed';
      const batch: FeedbackBatch = existing ?? {
        id: store.newId(),
        triggeredBy: user.userId,
        branchName: req.branchName,
        status: req.status,
        assetCount: 0,
        processingTimeSeconds: null,
        files: [],
        summary: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: store.now(),
        completedAt: null,
      };
      batch.branchName = req.branchName;
      batch.status = req.status;
      batch.files = [...req.files];
      batch.summary = req.summary ?? batch.summary;
      if (completes) batch.completedAt = store.now();
      if (!existing) store.batches.push(batch);
      if (shouldNotifyOnUpsert(previousStatus, req.status)) {
        store.stewardNotifications.push({
          eventType: req.status === 'failed' ? 'feedback.failed' : 'feedback.branch_ready',
          batchId: batch.id,
        });
      }
      return { branch: store.branch(batch), created: !existing };
    },
    updateFeedbackBranchStatus: async (user, batchId, req) => {
      const b = store.batches.find((x) => x.id === batchId);
      if (!b) throw notFound(`Feedback batch not found: ${batchId}`);
      if (b.status !== 'proposed' && b.status !== 'in_review') {
        throw conflict(`Feedback batch ${batchId} is ${b.status}; only proposed or in_review branches can be reviewed`);
      }
      b.status = req.status;
      b.reviewedBy = user.userId;
      b.reviewedAt = store.now();
      return store.branch(b);
    },
  };

  const settings: SettingsFake = {
    get: async (userId) => clone(store.settings.get(userId) ?? DEFAULT_USER_SETTINGS),
    update: async (userId, patch) => {
      if (patch.defaultCampaignId) store.campaign(patch.defaultCampaignId);
      const next: UserSettings = { ...(store.settings.get(userId) ?? DEFAULT_USER_SETTINGS), ...patch, updatedAt: store.now() };
      store.settings.set(userId, next);
      return clone(next);
    },
  };

  const config: ConfigFake = {
    get: async () => clone(store.config),
    update: async (patch) => {
      store.config = { ...store.config, ...patch };
      return clone(store.config);
    },
  };

  return {
    review: guarded(store, review),
    assets: guarded(store, assets),
    campaigns: guarded(store, campaigns),
    metricViews: guarded(store, metricViews),
    notifications: guarded(store, notifications),
    membership: guarded(store, membership),
    steward: guarded(store, steward),
    settings: guarded(store, settings),
    config: guarded(store, config),
    db: createFakeDb(store),
    events: { emit: () => {}, on: () => {} },
  } as unknown as Services;
}

/** Stand-in for SourceService (routes/assets.ts constructs it from services.db). */
export class FakeSourceService implements SourcesFake {
  private store: FakeStore;
  constructor(db: Db) {
    this.store = (db as FakeDb).store;
  }
  async list(): Promise<AssetSource[]> {
    this.store.guard();
    return clone(this.store.sources);
  }
  async register(input: Parameters<SourceService['register']>[0], userId: string): Promise<AssetSource> {
    this.store.guard();
    if (this.store.sources.some((s) => s.workspacePath === input.workspacePath)) {
      throw conflict(`Source already registered: ${input.workspacePath}`);
    }
    this.store.guardUpstream();
    const source: AssetSource = {
      id: this.store.newId(),
      sourceType: 'git_folder',
      workspacePath: input.workspacePath,
      displayName: input.displayName ?? null,
      metricViewGlob: input.metricViewGlob ?? '**/*.metric_view.yml',
      glossaryGlob: input.glossaryGlob ?? '**/glossary/*.md',
      createdBy: userId,
      createdAt: this.store.now(),
      lastScannedAt: null,
    };
    this.store.sources.push(source);
    return clone(source);
  }
  async scan(sourceId: string): ReturnType<SourceService['scan']> {
    this.store.guard();
    const s = this.store.sources.find((x) => x.id === sourceId);
    if (!s) throw notFound(`Source not found: ${sourceId}`);
    this.store.guardUpstream();
    s.lastScannedAt = this.store.now();
    return clone(SCAN_RESULT);
  }
  async importAssets(_user: UserContext, body: Parameters<SourceService['importAssets']>[1]): ReturnType<SourceService['importAssets']> {
    this.store.guard();
    this.store.guardUpstream();
    const out = { created: [] as string[], updated: [] as string[], skipped: [] as { ref: string; reason: string }[] };
    for (const fqn of body.metricViews ?? []) {
      if (fqn === METRIC_VIEW_FQN) out.updated.push(fqn);
      else out.skipped.push({ ref: fqn, reason: 'Metric view not found' });
    }
    for (const t of body.glossaryTerms ?? []) {
      if (!this.store.sources.some((s) => s.id === t.sourceId)) throw notFound(`Source not found: ${t.sourceId}`);
      out.created.push(t.term);
    }
    return out;
  }
}
