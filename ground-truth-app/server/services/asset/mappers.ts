import type {
  Asset,
  AssetVersion,
  AssetSynonym,
  ExampleQuestion,
} from '../../../shared/contracts/entities';

function toIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return '';
}

function toNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return Number(val) || 0;
  return 0;
}

/**
 * Map an app.assets row to the Asset DTO. `synonyms` are loaded separately
 * from app.asset_synonyms (AssetRegistry.get / list); [] when none.
 */
export function rowToAsset(
  row: Record<string, unknown>,
  synonyms: AssetSynonym[] = [],
): Asset {
  return {
    id: row.id as string,
    assetType: row.asset_type as Asset['assetType'],
    name: row.name as string,
    displayName: (row.display_name as string) ?? '',
    description: (row.description as string) ?? null,
    plainEnglishLogic: (row.plain_english_logic as string) ?? null,
    yamlContent: (row.yaml_content as string) ?? null,
    repoUrl: (row.repo_url as string) ?? null,
    fixturePath: (row.fixture_path as string) ?? null,
    branch: (row.branch as string) ?? null,
    environment: row.environment as Asset['environment'],
    targetCatalog: row.target_catalog as string,
    targetSchema: row.target_schema as string,
    status: row.status as Asset['status'],
    domain: (row.domain as string) ?? null,
    subdomain: (row.subdomain as string) ?? null,
    sourceId: (row.source_id as string) ?? null,
    sourceMetadata: row.source_metadata
      ? (typeof row.source_metadata === 'string'
        ? JSON.parse(row.source_metadata as string) as Record<string, unknown>
        : row.source_metadata as Record<string, unknown>)
      : null,
    synonyms,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function rowToAssetVersion(row: Record<string, unknown>): AssetVersion {
  return {
    id: row.id as string,
    assetId: row.asset_id as string,
    version: toNum(row.version),
    yamlContent: (row.yaml_content as string) ?? null,
    description: (row.description as string) ?? null,
    plainEnglishLogic: (row.plain_english_logic as string) ?? null,
    createdAt: toIso(row.created_at),
    createdBy: (row.created_by as string) ?? null,
  };
}

export function rowToSynonym(row: Record<string, unknown>): AssetSynonym {
  return {
    id: row.id as string,
    assetId: row.asset_id as string,
    synonym: row.synonym as string,
    proposedBy: row.proposed_by as string,
    approvals: toNum(row.approvals),
    rejections: toNum(row.rejections),
    createdAt: toIso(row.created_at),
  };
}

export function rowToExampleQuestion(row: Record<string, unknown>): ExampleQuestion {
  return {
    id: row.id as string,
    assetId: row.asset_id as string,
    questionText: row.question_text as string,
    proposedBy: row.proposed_by as string,
    approved: row.approved === true || row.approved === 'true',
    createdAt: toIso(row.created_at),
  };
}
