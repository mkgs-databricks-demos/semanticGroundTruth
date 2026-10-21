import type { MetricViewColumn } from '../../../shared/contracts/entities';

interface ParsedMetricView {
  measures: MetricViewColumn[];
  dimensions: MetricViewColumn[];
}

type SectionKind = 'measures' | 'dimensions' | null;

function parseInlineList(value: string): string[] {
  // Handles: [a, b, c] or a, b, c
  const trimmed = value.trim();
  const inner = trimmed.startsWith('[') && trimmed.endsWith(']')
    ? trimmed.slice(1, -1)
    : trimmed;
  return inner
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

export function parseMetricViewYaml(yaml: string): ParsedMetricView {
  const lines = yaml.split('\n');
  const measures: MetricViewColumn[] = [];
  const dimensions: MetricViewColumn[] = [];

  let currentSection: SectionKind = null;
  let current: Partial<MetricViewColumn> | null = null;
  let targetList: MetricViewColumn[] = [];

  function flush(): void {
    if (current && current.name) {
      targetList.push({
        name: current.name,
        expr: current.expr ?? '',
        ...(current.displayName ? { displayName: current.displayName } : {}),
        ...(current.comment ? { comment: current.comment } : {}),
        ...(current.synonyms && current.synonyms.length > 0
          ? { synonyms: current.synonyms }
          : {}),
      });
    }
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Top-level section headers
    if (/^measures\s*:/.test(line)) {
      flush();
      currentSection = 'measures';
      targetList = measures;
      continue;
    }
    if (/^dimensions\s*:/.test(line)) {
      flush();
      currentSection = 'dimensions';
      targetList = dimensions;
      continue;
    }

    if (!currentSection) continue;

    // New list item (- name: ...)
    const listItemMatch = line.match(/^\s*-\s+name\s*:\s*(.+)/);
    if (listItemMatch) {
      flush();
      current = { name: listItemMatch[1].trim().replace(/^["']|["']$/g, '') };
      continue;
    }

    // Continuation keys inside a list item
    if (current) {
      const kvMatch = line.match(/^\s+(\w[\w_]*)\s*:\s*(.+)/);
      if (kvMatch) {
        const key = kvMatch[1];
        const val = kvMatch[2].trim().replace(/^["']|["']$/g, '');
        if (key === 'expr') current.expr = val;
        else if (key === 'display_name') current.displayName = val;
        else if (key === 'comment') current.comment = val;
        else if (key === 'synonyms') current.synonyms = parseInlineList(val);
        // Tolerate unknown keys
      }
    }
  }

  flush();

  return { measures, dimensions };
}
