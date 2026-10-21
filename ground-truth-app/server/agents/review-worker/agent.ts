// server/agents/review-worker/agent.ts — read-only tool agent for Ground Truth
// Session 14 · Wave 4 · Default export required by AppKit agents plugin

import { createAgent, tool } from '@databricks/appkit/beta';
import { z } from 'zod';
import { getServices } from '../../services';
import { computeConfidence } from '../../services/review';

export default createAgent({
  instructions: [
    'You are review-worker, a tool-using sub-agent for the Ground Truth app.',
    'You have read-only access to assets, confidence scores, campaigns, and leaderboards.',
    'You cannot record votes or modify any data.',
    'When asked to vote, explain that votes must be cast in the Review tab.',
    'Use your tools to look up information and answer questions precisely.',
  ].join(' '),
  tools: {
    get_asset: tool({
      description:
        'Get a single asset by ID, including its synonyms, example questions, and latest confidence score.',
      schema: z.object({
        asset_id: z.string().describe('UUID of the asset'),
      }),
      annotations: { effect: 'read' },
      execute: async ({ asset_id }) => {
        const { assets, db } = getServices();
        const asset = await assets.get(asset_id);
        const synonyms = await assets.listSynonyms(asset_id);
        const examples = await assets.listExamples(asset_id);
        const confRow = await db.one<Record<string, unknown>>(
          'SELECT * FROM app.confidence_scores WHERE asset_id = $1',
          [asset_id],
        );
        const confidence = confRow
          ? {
              totalVotes: Number(confRow.total_votes),
              approvals: Number(confRow.approvals),
              rejections: Number(confRow.rejections),
              edits: Number(confRow.edits),
              wilsonLower: Number(confRow.wilson_lower),
              wilsonUpper: Number(confRow.wilson_upper),
              confidence: Number(confRow.confidence),
            }
          : null;
        return { asset, synonyms, examples, confidence };
      },
    }),

    search_assets: tool({
      description:
        'Search reviewable assets with optional type, status, and limit filters.',
      schema: z.object({
        asset_type: z
          .string()
          .optional()
          .describe('Filter by asset type (e.g. "measure", "dimension")'),
        status: z
          .string()
          .optional()
          .describe('Filter by status ("PENDING", "REVIEWED", "CERTIFIED")'),
        limit: z.number().optional().describe('Max results (default 50)'),
      }),
      annotations: { effect: 'read' },
      execute: async ({ asset_type, status, limit }) => {
        const { assets } = getServices();
        return assets.list({ assetType: asset_type as 'measure' | 'dimension' | 'page' | 'domain' | 'subdomain' | undefined, status: status as 'PENDING' | 'REVIEWED' | 'CERTIFIED' | undefined, limit: limit ?? 50, offset: 0 });
      },
    }),

    explain_confidence: tool({
      description:
        "Explain how an asset's confidence score is calculated: vote counts, Wilson lower bound, prior adjustment, and distance to certification.",
      schema: z.object({
        asset_id: z.string().describe('UUID of the asset'),
      }),
      annotations: { effect: 'read' },
      execute: async ({ asset_id }) => {
        const { db, config } = getServices();
        const settings = await config.get();

        const confRow = await db.one<Record<string, unknown>>(
          'SELECT * FROM app.confidence_scores WHERE asset_id = $1',
          [asset_id],
        );

        if (!confRow) {
          return {
            asset_id,
            status: 'no_votes',
            message: 'This asset has no votes yet. Confidence is 0.',
          };
        }

        const approvals = Number(confRow.approvals);
        const rejections = Number(confRow.rejections);
        const edits = Number(confRow.edits);
        const totalVotes = approvals + rejections + edits;

        const result = computeConfidence(
          { approvals, rejections, edits },
          settings,
        );

        const gap = settings.certificationThreshold - result.score;
        const needsMoreVotes =
          totalVotes < settings.minVotesForCertification;

        return {
          asset_id,
          approvals,
          rejections,
          edits,
          totalVotes,
          wilsonZ: settings.wilsonZ,
          wilsonLowerBound: result.score,
          priorApplied: result.priorApplied,
          industryPrior: settings.industryPrior,
          priorWeight: settings.priorWeight,
          certificationThreshold: settings.certificationThreshold,
          minVotesForCertification: settings.minVotesForCertification,
          distanceToCertification: gap > 0 ? gap : 0,
          certified: gap <= 0 && !needsMoreVotes,
          needsMoreVotes,
        };
      },
    }),

    get_leaderboard: tool({
      description: 'Get the reviewer leaderboard for a given period.',
      schema: z.object({
        period: z
          .enum(['7d', '30d', 'all'])
          .describe('Time period for the leaderboard'),
      }),
      annotations: { effect: 'read' },
      execute: async ({ period }) => {
        const { review } = getServices();
        return review.getLeaderboard(period);
      },
    }),

    get_campaigns: tool({
      description:
        'List campaigns. Returns only publicly visible campaigns (those with no RBAC group restrictions).',
      schema: z.object({
        status: z
          .string()
          .optional()
          .describe(
            'Filter by campaign status (e.g. "active", "completed", "paused")',
          ),
      }),
      annotations: { effect: 'read' },
      execute: async ({ status }) => {
        const { db } = getServices();
        const conditions: string[] = [
          "(rbac_groups = '{}' OR rbac_groups IS NULL)",
        ];
        const params: unknown[] = [];

        if (status) {
          conditions.push('status = $1');
          params.push(status);
        }

        const where = conditions.join(' AND ');
        const rows = await db.query<Record<string, unknown>>(
          `SELECT c.*,
            (SELECT COUNT(*)::int FROM app.campaign_assets
             WHERE campaign_id = c.id AND status = 'reviewed') AS reviewed_assets
           FROM app.campaigns c
           WHERE ${where}
           ORDER BY c.created_at DESC`,
          params,
        );

        return rows.map((r) => ({
          id: String(r.id),
          name: String(r.name),
          campaignType: String(r.campaign_type),
          status: String(r.status),
          totalAssets: Number(r.total_assets ?? 0),
          reviewedAssets: Number(r.reviewed_assets ?? 0),
          createdAt: String(r.created_at),
        }));
      },
    }),

    get_coverage_summary: tool({
      description:
        'Get an executive-level coverage summary: total assets, reviewed, certified, active reviewers, votes, and campaigns.',
      schema: z.object({}),
      annotations: { effect: 'read' },
      execute: async () => {
        const { review } = getServices();
        return review.getExecutiveSummary();
      },
    }),
  },
});
