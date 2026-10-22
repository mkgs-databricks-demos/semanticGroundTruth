import type { UserContext } from '../../lib/context';
import { forbidden, badRequest } from '../../lib/errors';
import { executeStatement } from '../../lib/databricks';
import type {
  MetricViewSummary,
  MetricViewDetail,
  QueryResult,
} from '../../../shared/contracts/entities';
import { parseMetricViewYaml } from './parseMetricViewYaml';

const IDENTIFIER_RE = /^[A-Za-z0-9_]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/;
const SAFE_SQL_RE = /^\s*(\/\*[\s\S]*?\*\/\s*|--[^\n]*\n\s*)*(SELECT|WITH)\s/i;

function requireToken(user: UserContext): string {
  if (!user.accessToken) {
    throw forbidden('OBO token required');
  }
  return user.accessToken;
}

function defaultCatalog(): string {
  return process.env.GT_METRIC_VIEW_CATALOG ?? 'hls_fde_dev';
}

function defaultSchema(): string {
  return process.env.GT_METRIC_VIEW_SCHEMA ?? 'dev_matthew_giglia_semantic_ground_truth';
}

export class MetricViewService {
  async list(
    user: UserContext,
    opts?: { catalog?: string; schema?: string },
  ): Promise<MetricViewSummary[]> {
    const token = requireToken(user);
    const catalog = opts?.catalog ?? defaultCatalog();
    const schema = opts?.schema ?? defaultSchema();

    const result = await executeStatement({
      token,
      statement:
        `SELECT table_catalog, table_schema, table_name, comment
         FROM system.information_schema.tables
         WHERE table_type = 'METRIC_VIEW'
           AND table_catalog = :catalog
           AND table_schema = :schema`,
      parameters: [
        { name: 'catalog', value: catalog },
        { name: 'schema', value: schema },
      ],
    });

    return result.rows.map((row) => {
      const fullName = `${row[0]}.${row[1]}.${row[2]}`;
      return {
        fullName,
        comment: (row[3] as string) ?? null,
        measureCount: 0,
        dimensionCount: 0,
      };
    });
  }

  async get(
    user: UserContext,
    fullName: string,
  ): Promise<MetricViewDetail> {
    if (!IDENTIFIER_RE.test(fullName)) {
      throw badRequest('Invalid metric view name');
    }
    const token = requireToken(user);
    const [catalog, schema, table] = fullName.split('.');

    const result = await executeStatement({
      token,
      statement: `DESCRIBE TABLE EXTENDED \`${catalog}\`.\`${schema}\`.\`${table}\` AS JSON`,
    });

    // Extract view_text (YAML) from the DESCRIBE result
    let yaml = '';
    let comment: string | null = null;
    for (const row of result.rows) {
      const json = typeof row[0] === 'string' ? row[0] : JSON.stringify(row[0]);
      try {
        const parsed = JSON.parse(json) as Record<string, unknown>;
        if (typeof parsed.view_text === 'string') {
          yaml = parsed.view_text;
        }
        if (typeof parsed.comment === 'string') {
          comment = parsed.comment;
        }
      } catch (_e) {
        // Not JSON — skip
      }
    }

    const { measures, dimensions } = parseMetricViewYaml(yaml);

    return {
      fullName,
      comment,
      measureCount: measures.length,
      dimensionCount: dimensions.length,
      measures,
      dimensions,
      yaml: yaml || undefined,
    };
  }

  async validate(
    user: UserContext,
    fullName: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.get(user, fullName);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  }

  async runAssetQuery(
    user: UserContext,
    sql: string,
    rowLimit = 100,
  ): Promise<QueryResult> {
    const token = requireToken(user);

    // Safety: only allow SELECT/WITH; no multiple statements
    const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    if (!SAFE_SQL_RE.test(sql)) {
      throw badRequest('Only SELECT or WITH queries are allowed');
    }
    const semiCount = (stripped.match(/;/g) ?? []).length;
    if (semiCount > 1 || (semiCount === 1 && !stripped.trimEnd().endsWith(';'))) {
      throw badRequest('Multiple statements not allowed');
    }

    const result = await executeStatement({
      token,
      statement: sql,
      rowLimit,
    });

    return {
      columns: result.columns,
      rows: result.rows,
      truncated: result.rows.length >= rowLimit,
    };
  }
}
