import type { ServiceDeps } from '../../lib/deps';
import type { Db } from '../../lib/db';
import { notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type {
  Asset,
  AssetVersion,
  AssetSynonym,
  ExampleQuestion,
} from '../../../shared/contracts/entities';
import type {
  RegisterAssetBody,
  RegisterAssetResult,
  ReviewableQuery,
  Paged,
} from '../../../shared/contracts/api';
import { computeVersionHash } from './versionHash';
import {
  rowToAsset,
  rowToAssetVersion,
  rowToSynonym,
  rowToExampleQuestion,
} from './mappers';

export class AssetRegistry {
  private db: Db;
  private deps: ServiceDeps;

  constructor(deps: ServiceDeps) {
    this.deps = deps;
    this.db = deps.db;
  }

  async register(
    input: RegisterAssetBody,
    registeredBy: string,
  ): Promise<RegisterAssetResult> {
    const hash = computeVersionHash(input.yamlContent);

    // Check if asset already exists by identity
    const existing = await this.db.one<Record<string, unknown>>(
      `SELECT id, version_hash, status
       FROM app.assets
       WHERE asset_type = $1 AND name = $2
         AND COALESCE(repo_url, '') = COALESCE($3, '')
         AND COALESCE(fixture_path, '') = COALESCE($4, '')`,
      [input.assetType, input.name, input.repoUrl ?? '', input.fixturePath ?? ''],
    );

    if (existing && existing.version_hash === hash) {
      // Same hash — no change
      const asset = await this.get(existing.id as string);
      return { asset, created: false, newVersion: false };
    }

    if (existing) {
      // New version — different hash
      const assetId = existing.id as string;
      const versionRow = await this.db.one<{ max_v: number }>(
        'SELECT COALESCE(MAX(version), 0) AS max_v FROM app.asset_versions WHERE asset_id = $1',
        [assetId],
      );
      const nextVersion = ((versionRow?.max_v as number) ?? 0) + 1;

      await this.db.query(
        `INSERT INTO app.asset_versions (asset_id, version, yaml_content, description, plain_english_logic, change_type, created_by)
         VALUES ($1, $2, $3, $4, $5, 'modified', $6)`,
        [
          assetId,
          nextVersion,
          input.yamlContent,
          input.description ?? null,
          input.plainEnglishLogic ?? null,
          registeredBy,
        ],
      );

      await this.db.query(
        `UPDATE app.assets
         SET version_hash = $1, yaml_content = $2, description = $3,
             plain_english_logic = $4, display_name = COALESCE($5, display_name, name),
             domain = $6, subdomain = $7,
             status = 'PENDING', updated_at = NOW()
         WHERE id = $8`,
        [
          hash,
          input.yamlContent,
          input.description ?? null,
          input.plainEnglishLogic ?? null,
          input.displayName ?? null,
          input.domain ?? null,
          input.subdomain ?? null,
          assetId,
        ],
      );

      this.deps.events.emit({
        type: 'asset.registered',
        assetId,
        isNewVersion: true,
      });

      const asset = await this.get(assetId);
      return { asset, created: false, newVersion: true };
    }

    // New asset
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO app.assets (
        asset_type, name, display_name, description, plain_english_logic,
        yaml_content, repo_url, fixture_path, branch, environment,
        target_catalog, target_schema, domain, subdomain, version_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        input.assetType,
        input.name,
        input.displayName ?? input.name,
        input.description ?? null,
        input.plainEnglishLogic ?? null,
        input.yamlContent,
        input.repoUrl ?? null,
        input.fixturePath ?? null,
        input.branch ?? null,
        input.environment,
        input.targetCatalog,
        input.targetSchema,
        input.domain ?? null,
        input.subdomain ?? null,
        hash,
      ],
    );

    const assetId = row!.id;

    // Version 1
    await this.db.query(
      `INSERT INTO app.asset_versions (asset_id, version, yaml_content, description, plain_english_logic, change_type, created_by)
       VALUES ($1, 1, $2, $3, $4, 'created', $5)`,
      [
        assetId,
        input.yamlContent,
        input.description ?? null,
        input.plainEnglishLogic ?? null,
        registeredBy,
      ],
    );

    // Synonyms
    if (input.synonyms && input.synonyms.length > 0) {
      for (const syn of input.synonyms) {
        await this.db.query(
          `INSERT INTO app.asset_synonyms (asset_id, synonym, proposed_by, source)
           VALUES ($1, $2, $3, 'registration')
           ON CONFLICT (asset_id, synonym) DO NOTHING`,
          [assetId, syn, registeredBy],
        );
      }
    }

    // Example questions
    if (input.exampleQuestions && input.exampleQuestions.length > 0) {
      for (const q of input.exampleQuestions) {
        await this.db.query(
          `INSERT INTO app.example_questions (asset_id, question_text, proposed_by, source)
           VALUES ($1, $2, $3, 'registration')`,
          [assetId, q, registeredBy],
        );
      }
    }

    this.deps.events.emit({
      type: 'asset.registered',
      assetId,
      isNewVersion: false,
    });

    const asset = await this.get(assetId);
    return { asset, created: true, newVersion: false };
  }

  async get(assetId: string): Promise<Asset> {
    const row = await this.db.one(
      'SELECT * FROM app.assets WHERE id = $1',
      [assetId],
    );
    if (!row) throw notFound(`Asset not found: ${assetId}`);
    return rowToAsset(row, await this.listSynonyms(assetId));
  }

  async list(q: ReviewableQuery): Promise<Paged<Asset>> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.assetType) {
      conditions.push(`asset_type = $${idx++}`);
      params.push(q.assetType);
    }
    if (q.status) {
      conditions.push(`status = $${idx++}`);
      params.push(q.status);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRow = await this.db.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app.assets ${where}`,
      params,
    );
    const total = Number(countRow?.count ?? 0);

    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;

    const rows = await this.db.query(
      `SELECT * FROM app.assets ${where} ORDER BY updated_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );

    const synonymsByAsset = await this.synonymsFor(rows.map((r) => String(r.id)));

    return {
      items: rows.map((r) => rowToAsset(r, synonymsByAsset.get(String(r.id)) ?? [])),
      total,
      limit,
      offset,
    };
  }

  /** 404 for an unknown asset id, before any read or write that would otherwise hit a FK error or return []. */
  private async requireAsset(assetId: string): Promise<void> {
    const row = await this.db.one<{ id: string }>('SELECT id FROM app.assets WHERE id = $1', [assetId]);
    if (!row) throw notFound(`Asset not found: ${assetId}`);
  }

  async listVersions(assetId: string): Promise<AssetVersion[]> {
    await this.requireAsset(assetId);
    const rows = await this.db.query(
      'SELECT * FROM app.asset_versions WHERE asset_id = $1 ORDER BY version DESC',
      [assetId],
    );
    return rows.map(rowToAssetVersion);
  }

  async listSynonyms(assetId: string): Promise<AssetSynonym[]> {
    const rows = await this.db.query(
      `SELECT s.*, 
              COALESCE(SUM(CASE WHEN sv.action = 'approve' THEN 1 ELSE 0 END), 0)::int AS approvals,
              COALESCE(SUM(CASE WHEN sv.action = 'reject' THEN 1 ELSE 0 END), 0)::int AS rejections
       FROM app.asset_synonyms s
       LEFT JOIN app.synonym_votes sv ON sv.synonym_id = s.id
       WHERE s.asset_id = $1 AND s.is_active = TRUE
       GROUP BY s.id`,
      [assetId],
    );
    return rows.map(rowToSynonym);
  }

  /** Active synonyms for many assets in one query (Asset.synonyms on list pages). */
  private async synonymsFor(assetIds: string[]): Promise<Map<string, AssetSynonym[]>> {
    const byAsset = new Map<string, AssetSynonym[]>();
    if (assetIds.length === 0) return byAsset;
    const rows = await this.db.query(
      `SELECT s.*,
              COALESCE(SUM(CASE WHEN sv.action = 'approve' THEN 1 ELSE 0 END), 0)::int AS approvals,
              COALESCE(SUM(CASE WHEN sv.action = 'reject' THEN 1 ELSE 0 END), 0)::int AS rejections
       FROM app.asset_synonyms s
       LEFT JOIN app.synonym_votes sv ON sv.synonym_id = s.id
       WHERE s.asset_id = ANY($1::uuid[]) AND s.is_active = TRUE
       GROUP BY s.id`,
      [assetIds],
    );
    for (const row of rows) {
      const syn = rowToSynonym(row);
      const list = byAsset.get(syn.assetId) ?? [];
      list.push(syn);
      byAsset.set(syn.assetId, list);
    }
    return byAsset;
  }

  async listExamples(assetId: string): Promise<ExampleQuestion[]> {
    await this.requireAsset(assetId);
    const rows = await this.db.query(
      'SELECT * FROM app.example_questions WHERE asset_id = $1 ORDER BY created_at',
      [assetId],
    );
    return rows.map(rowToExampleQuestion);
  }

  async addSynonym(
    assetId: string,
    synonym: string,
    userId: string,
  ): Promise<void> {
    await this.requireAsset(assetId);
    await this.db.query(
      `INSERT INTO app.asset_synonyms (asset_id, synonym, proposed_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (asset_id, synonym) DO NOTHING`,
      [assetId, synonym, userId],
    );
  }

  async voteSynonym(
    assetId: string,
    synonym: string,
    userId: string,
    action: 'approve' | 'reject',
  ): Promise<void> {
    // Find synonym id
    const synRow = await this.db.one<{ id: string }>(
      'SELECT id FROM app.asset_synonyms WHERE asset_id = $1 AND synonym = $2 AND is_active = TRUE',
      [assetId, synonym],
    );
    if (!synRow) throw notFound('Synonym not found');

    // Upsert vote
    await this.db.query(
      `INSERT INTO app.synonym_votes (synonym_id, user_id, action)
       VALUES ($1, $2, $3)
       ON CONFLICT (synonym_id, user_id) DO UPDATE SET action = $3, created_at = NOW()`,
      [synRow.id, userId, action],
    );
  }

  async removeSynonym(assetId: string, synonym: string): Promise<void> {
    await this.requireAsset(assetId);
    await this.db.query(
      `UPDATE app.asset_synonyms SET is_active = FALSE
       WHERE asset_id = $1 AND synonym = $2`,
      [assetId, synonym],
    );
  }

  async addExample(
    assetId: string,
    questionText: string,
    userId: string,
  ): Promise<void> {
    await this.requireAsset(assetId);
    await this.db.query(
      `INSERT INTO app.example_questions (asset_id, question_text, proposed_by)
       VALUES ($1, $2, $3)`,
      [assetId, questionText, userId],
    );
  }

  async voteExample(
    questionId: string,
    userId: string,
    action: 'approve' | 'reject',
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO app.example_question_votes (question_id, user_id, action)
       VALUES ($1, $2, $3)
       ON CONFLICT (question_id, user_id) DO UPDATE SET action = $3, created_at = NOW()`,
      [questionId, userId, action],
    );
  }

  async updateStatus(assetId: string, status: Asset['status']): Promise<void> {
    await this.db.query(
      'UPDATE app.assets SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, assetId],
    );
  }

  async touchReviewed(assetId: string): Promise<void> {
    await this.db.query(
      'UPDATE app.assets SET last_reviewed_at = NOW(), updated_at = NOW() WHERE id = $1',
      [assetId],
    );
  }

  async applyEdits(
    assetId: string,
    edits: { description?: string; plainEnglishLogic?: string; displayName?: string },
    _userId: string,
  ): Promise<void> {
    // Store proposed edits as feedback only — do NOT mutate the asset description.
    // Edits flow through the feedback pipeline.
    logger.info('Edit proposal received', { assetId, edits });
  }
}
