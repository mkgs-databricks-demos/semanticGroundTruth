// server/services/sources/sourceService.ts — source registration, scan, and import
// Session 09 · Wave 1 · No default export

import type { Db } from '../../lib/db';
import type { AssetRegistry } from '../asset/assetRegistry';
import type { MetricViewService } from '../metricView/metricViewService';
import type { UserContext } from '../../lib/context';
import type {
  AssetSource,
} from '../../../shared/contracts/entities';
import type {
  RegisterAssetBody,
  ImportAssetsBody,
  ImportAssetsResponse,
  ScanMetricViewFile,
  ScanGlossaryTerm,
  ScanSourceResponse,
} from '../../../shared/contracts/api';
import { notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { DEFAULT_METRIC_VIEW_GLOB, DEFAULT_GLOSSARY_GLOB } from '../../../shared/contracts/values';
import { listFilesRecursive, exportFileContent, matchGlob } from './workspaceFiles';
import { parseGlossaryMarkdown } from './glossaryParser';

// ── Row mapper ───────────────────────────────────────────────────────────────

function toIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return '';
}

function rowToSource(row: Record<string, unknown>): AssetSource {
  return {
    id: row.id as string,
    sourceType: (row.source_type as AssetSource['sourceType']),
    workspacePath: row.workspace_path as string,
    displayName: (row.display_name as string) ?? null,
    metricViewGlob: (row.metric_view_glob as string) ?? DEFAULT_METRIC_VIEW_GLOB,
    glossaryGlob: (row.glossary_glob as string) ?? DEFAULT_GLOSSARY_GLOB,
    createdBy: row.created_by as string,
    createdAt: toIso(row.created_at),
    lastScannedAt: row.last_scanned_at ? toIso(row.last_scanned_at) : null,
  };
}

// ── Service ─────────────────────────────────────────────────────────────────

export class SourceService {
  private db: Db;
  private assets: AssetRegistry;
  private metricViews: MetricViewService;

  constructor(db: Db, assets: AssetRegistry, metricViews: MetricViewService) {
    this.db = db;
    this.assets = assets;
    this.metricViews = metricViews;
  }

  // ── Register a Git folder source ───────────────────────────────────────

  async register(
    input: {
      workspacePath: string;
      displayName?: string;
      metricViewGlob?: string;
      glossaryGlob?: string;
    },
    userId: string,
  ): Promise<AssetSource> {
    const row = await this.db.one<Record<string, unknown>>(
      `INSERT INTO app.asset_sources (
        source_type, workspace_path, display_name,
        metric_view_glob, glossary_glob, created_by
      ) VALUES ('git_folder', $1, $2, $3, $4, $5)
      ON CONFLICT (workspace_path) DO UPDATE
        SET display_name = COALESCE(EXCLUDED.display_name, app.asset_sources.display_name),
            metric_view_glob = EXCLUDED.metric_view_glob,
            glossary_glob = EXCLUDED.glossary_glob
      RETURNING *`,
      [
        input.workspacePath,
        input.displayName ?? null,
        input.metricViewGlob ?? DEFAULT_METRIC_VIEW_GLOB,
        input.glossaryGlob ?? DEFAULT_GLOSSARY_GLOB,
        userId,
      ],
    );
    return rowToSource(row!);
  }

  // ── List registered sources ───────────────────────────────────────────

  async list(): Promise<AssetSource[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM app.asset_sources ORDER BY created_at DESC',
    );
    return rows.map(rowToSource);
  }

  // ── Scan a source for candidates ───────────────────────────────────────

  async scan(sourceId: string): Promise<ScanSourceResponse> {
    const source = await this.getSource(sourceId);

    // List all files under the workspace path
    const allFiles = await listFilesRecursive(source.workspacePath);

    // Compute relative paths
    const rootPrefix = source.workspacePath.endsWith('/')
      ? source.workspacePath
      : source.workspacePath + '/';

    // Find metric view YAML files
    const metricViewFiles: ScanMetricViewFile[] = [];
    for (const file of allFiles) {
      const relPath = file.path.startsWith(rootPrefix)
        ? file.path.slice(rootPrefix.length)
        : file.path;
      if (matchGlob(source.metricViewGlob, relPath)) {
        // Extract view name from file stem
        const stem = relPath.split('/').pop()?.replace(/\.(metric_view|metric\.view)\.(yml|yaml)$/i, '') ?? relPath;
        metricViewFiles.push({ filePath: relPath, viewName: stem });
      }
    }

    // Find and parse glossary markdown files
    const glossaryTerms: ScanGlossaryTerm[] = [];
    for (const file of allFiles) {
      const relPath = file.path.startsWith(rootPrefix)
        ? file.path.slice(rootPrefix.length)
        : file.path;
      if (matchGlob(source.glossaryGlob, relPath)) {
        try {
          const content = await exportFileContent(file.path);
          const terms = parseGlossaryMarkdown(content, relPath);
          for (const t of terms) {
            glossaryTerms.push({
              filePath: relPath,
              term: t.term,
              domain: t.domain ?? undefined,
              subdomain: t.subdomain ?? undefined,
              definition: t.definition,
            });
          }
        } catch (err) {
          logger.warn('Failed to parse glossary file', {
            filePath: file.path,
            error: (err as Error).message,
          });
        }
      }
    }

    // Update last_scanned_at
    await this.db.query(
      'UPDATE app.asset_sources SET last_scanned_at = NOW() WHERE id = $1',
      [sourceId],
    );

    return { metricViewFiles, glossaryTerms };
  }

  // ── Import assets ─────────────────────────────────────────────────────

  async importAssets(
    user: UserContext,
    body: ImportAssetsBody,
  ): Promise<ImportAssetsResponse> {
    const created: string[] = [];
    const updated: string[] = [];
    const skipped: { ref: string; reason: string }[] = [];

    // ── Metric view imports ───────────────────────────────────────────
    if (body.metricViews && body.metricViews.length > 0) {
      // Look up source for linking if provided
      let source: AssetSource | null = null;
      let sourceFiles: ScanMetricViewFile[] | null = null;
      if (body.sourceId) {
        source = await this.getSource(body.sourceId);
        // Quick scan of the source to find matching files
        const allFiles = await listFilesRecursive(source.workspacePath);
        const rootPrefix = source.workspacePath.endsWith('/')
          ? source.workspacePath
          : source.workspacePath + '/';
        sourceFiles = [];
        for (const file of allFiles) {
          const relPath = file.path.startsWith(rootPrefix)
            ? file.path.slice(rootPrefix.length)
            : file.path;
          if (matchGlob(source.metricViewGlob, relPath)) {
            const stem = relPath.split('/').pop()?.replace(/\.(metric_view|metric\.view)\.(yml|yaml)$/i, '') ?? relPath;
            sourceFiles.push({ filePath: relPath, viewName: stem });
          }
        }
      }

      for (const fqn of body.metricViews) {
        try {
          // Fetch the metric view definition via OBO
          const detail = await this.metricViews.get(user, fqn);
          const [catalog, schema, viewName] = fqn.split('.');

          // Find matching YAML in source
          let repoUrl: string | undefined;
          let fixturePath: string | undefined;
          if (source && sourceFiles) {
            const match = sourceFiles.find(
              (f) => f.viewName.toLowerCase() === viewName.toLowerCase(),
            );
            if (match) {
              repoUrl = source.workspacePath;
              fixturePath = match.filePath;
            }
          }

          // Import measures
          for (const m of detail.measures) {
            const registerBody: RegisterAssetBody = {
              assetType: 'measure',
              name: `${fqn}/${m.name}`,
              displayName: m.displayName ?? m.name,
              description: m.comment ?? undefined,
              plainEnglishLogic: m.expr,
              yamlContent: detail.yaml ?? '',
              repoUrl,
              fixturePath,
              environment: 'dev',
              targetCatalog: catalog,
              targetSchema: schema,
            };
            const result = await this.assets.register(
              { ...registerBody, sourceId: body.sourceId } as RegisterAssetBody & { sourceId?: string },
              user.userId,
            );
            await this.linkSource(result.asset.id, body.sourceId);
            if (result.created) created.push(result.asset.id);
            else if (result.newVersion) updated.push(result.asset.id);
          }

          // Import dimensions
          for (const d of detail.dimensions) {
            const registerBody: RegisterAssetBody = {
              assetType: 'dimension',
              name: `${fqn}/${d.name}`,
              displayName: d.displayName ?? d.name,
              description: d.comment ?? undefined,
              plainEnglishLogic: d.expr,
              yamlContent: detail.yaml ?? '',
              repoUrl,
              fixturePath,
              environment: 'dev',
              targetCatalog: catalog,
              targetSchema: schema,
            };
            const result = await this.assets.register(
              registerBody,
              user.userId,
            );
            await this.linkSource(result.asset.id, body.sourceId);
            if (result.created) created.push(result.asset.id);
            else if (result.newVersion) updated.push(result.asset.id);
          }
        } catch (err) {
          skipped.push({ ref: fqn, reason: (err as Error).message });
        }
      }
    }

    // ── Glossary term imports ─────────────────────────────────────────
    if (body.glossaryTerms && body.glossaryTerms.length > 0) {
      for (const gt of body.glossaryTerms) {
        try {
          const source = await this.getSource(gt.sourceId);
          // Read the file and parse the specific term
          const fullPath = source.workspacePath.endsWith('/')
            ? source.workspacePath + gt.filePath
            : source.workspacePath + '/' + gt.filePath;
          const content = await exportFileContent(fullPath);
          const allTerms = parseGlossaryMarkdown(content, gt.filePath);
          const parsed = allTerms.find((t) => t.term === gt.term);

          if (!parsed) {
            skipped.push({
              ref: `${gt.filePath}#${gt.term}`,
              reason: 'Term not found in file',
            });
            continue;
          }

          const registerBody: RegisterAssetBody = {
            assetType: 'page',
            name: parsed.term,
            displayName: parsed.term,
            description: parsed.definition,
            plainEnglishLogic: parsed.businessContext ?? undefined,
            yamlContent: parsed.blockText,
            domain: parsed.domain ?? undefined,
            subdomain: parsed.subdomain ?? undefined,
            environment: 'dev',
            targetCatalog: '',
            targetSchema: '',
          };

          const result = await this.assets.register(registerBody, user.userId);

          // Set source_id and source_metadata
          await this.db.query(
            `UPDATE app.assets
             SET source_id = $1,
                 source_metadata = $2
             WHERE id = $3`,
            [
              gt.sourceId,
              JSON.stringify({
                data_usage: parsed.dataUsage,
                related_terms: parsed.relatedTerms,
                source: parsed.source,
                file_path: gt.filePath,
                heading_line: parsed.headingLine,
              }),
              result.asset.id,
            ],
          );

          if (result.created) created.push(result.asset.id);
          else if (result.newVersion) updated.push(result.asset.id);
        } catch (err) {
          skipped.push({
            ref: `${gt.filePath}#${gt.term}`,
            reason: (err as Error).message,
          });
        }
      }
    }

    return { created, updated, skipped };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async getSource(sourceId: string): Promise<AssetSource> {
    const row = await this.db.one<Record<string, unknown>>(
      'SELECT * FROM app.asset_sources WHERE id = $1',
      [sourceId],
    );
    if (!row) throw notFound(`Source not found: ${sourceId}`);
    return rowToSource(row);
  }

  private async linkSource(
    assetId: string,
    sourceId: string | undefined,
  ): Promise<void> {
    if (!sourceId) return;
    await this.db.query(
      'UPDATE app.assets SET source_id = $1 WHERE id = $2 AND source_id IS NULL',
      [sourceId, assetId],
    );
  }
}
