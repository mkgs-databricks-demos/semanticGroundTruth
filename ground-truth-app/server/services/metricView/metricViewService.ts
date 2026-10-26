import type { UserContext } from '../../lib/context';
import { AppError, forbidden, badRequest, notFound } from '../../lib/errors';
import { executeStatement } from '../../lib/databricks';
import type {
  MetricViewSummary,
  MetricViewDetail,
  QueryResult,
} from '../../../shared/contracts/entities';
import { parseMetricViewYaml } from './parseMetricViewYaml';

const IDENTIFIER_RE = /^[A-Za-z0-9_]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/;
const SAFE_IDENT_RE = /^[A-Za-z0-9_\-]+$/;
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

/** SQL error classes that mean the catalog, schema or table does not exist. */
const NOT_FOUND_SQL_RE = /\[(TABLE_OR_VIEW_NOT_FOUND|SCHEMA_NOT_FOUND|NO_SUCH_CATALOG_EXCEPTION|CATALOG_NOT_FOUND)\b/;
/** A SQL error class prefix, e.g. "[UNRESOLVED_COLUMN.WITH_SUGGESTION] ...": the statement ran and failed. */
const SQL_ERROR_CLASS_RE = /^\s*\[[A-Z][A-Z0-9_.]*\]/;

/**
 * Run a warehouse call and turn a "does not exist" SQL failure (reported by
 * executeStatement as UPSTREAM_ERROR) into NOT_FOUND with `message`. Other
 * errors pass through unchanged (502 stays 502).
 */
async function orNotFound<T>(fn: () => Promise<T>, message: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError && err.code === 'UPSTREAM_ERROR' && NOT_FOUND_SQL_RE.test(err.message)) {
      throw notFound(message);
    }
    throw err;
  }
}

function requireSafeIdent(value: string, label: string): void {
  if (!SAFE_IDENT_RE.test(value)) {
    throw badRequest(`Invalid ${label}: must match [A-Za-z0-9_-]+`);
  }
}

export class MetricViewService {
  // ── Catalog browse (conventions §4) ──────────────────────────────────

  async listCatalogs(token: string): Promise<{ name: string; comment: string | null }[]> {
    const result = await executeStatement({
      token,
      statement:
        `SELECT catalog_name, comment
         FROM system.information_schema.catalogs
         ORDER BY catalog_name`,
    });
    return result.rows.map((row) => ({
      name: row[0] as string,
      comment: (row[1] as string) ?? null,
    }));
  }

  async listSchemas(
    token: string,
    catalog: string,
  ): Promise<{ name: string; fullName: string; comment: string | null }[]> {
    requireSafeIdent(catalog, 'catalog');
    const result = await orNotFound(() => executeStatement({
      token,
      statement:
        `SELECT schema_name, comment
         FROM \`${catalog}\`.information_schema.schemata
         WHERE schema_name NOT IN ('information_schema')
         ORDER BY schema_name`,
    }), `Catalog not found: ${catalog}`);
    return result.rows.map((row) => ({
      name: row[0] as string,
      fullName: `${catalog}.${row[0] as string}`,
      comment: (row[1] as string) ?? null,
    }));
  }

  async listMetricViews(
    token: string,
    catalog: string,
    schema: string,
  ): Promise<MetricViewSummary[]> {
    requireSafeIdent(catalog, 'catalog');
    requireSafeIdent(schema, 'schema');
    // One round trip: the schema row (LEFT JOIN its metric views). No row at all
    // means the schema does not exist (404); a row with a NULL table_name means
    // the schema exists but has no metric views ([]).
    const result = await orNotFound(() => executeStatement({
      token,
      statement:
        `SELECT t.table_catalog, t.table_schema, t.table_name, t.comment
         FROM \`${catalog}\`.information_schema.schemata s
         LEFT JOIN \`${catalog}\`.information_schema.tables t
           ON t.table_schema = s.schema_name AND t.table_type = 'METRIC_VIEW'
         WHERE s.schema_name = :schema
         ORDER BY t.table_name`,
      parameters: [
        { name: 'schema', value: schema },
      ],
    }), `Catalog not found: ${catalog}`);
    if (result.rows.length === 0) {
      throw notFound(`Schema not found: ${catalog}.${schema}`);
    }
    return result.rows.filter((row) => row[2] != null).map((row) => ({
      fullName: `${row[0] as string}.${row[1] as string}.${row[2] as string}`,
      comment: (row[3] as string) ?? null,
      measureCount: 0,
      dimensionCount: 0,
    }));
  }

  // ── Existing list (default catalog/schema) ───────────────────────────

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

    const result = await orNotFound(() => executeStatement({
      token,
      statement: `DESCRIBE TABLE EXTENDED \`${catalog}\`.\`${schema}\`.\`${table}\` AS JSON`,
    }), `Metric view not found: ${fullName}`);

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
    // Request errors keep their status: a bad name is 400, a missing view 404,
    // no OBO token 403, an unreachable warehouse 502. Only a statement that ran
    // and failed with a SQL error class means the view itself is invalid.
    try {
      await this.get(user, fullName);
      return { valid: true };
    } catch (err) {
      if (err instanceof AppError && err.code === 'UPSTREAM_ERROR' && SQL_ERROR_CLASS_RE.test(err.message)) {
        return { valid: false, error: err.message };
      }
      throw err;
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
