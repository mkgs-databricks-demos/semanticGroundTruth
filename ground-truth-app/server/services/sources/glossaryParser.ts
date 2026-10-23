// server/services/sources/glossaryParser.ts — pure markdown glossary parser
// Session 09 · Wave 1 · No default export
//
// Supports two formats (build_conventions §5):
//   1. docs/semantics/01_ground_truth_app_core_terms.md  — "## Domain:", "### Term", bullet fields
//   2. wanderBricksSemantics-care/rapid-ontology-standup/semantics/*.md — same structure
//
// Parser rules:
//   * File-level domain: first match of "## Domain: <x>" or "**Domain:** <x>"
//   * Subdomain: "**Subdomain:** <x>"
//   * Each "### <Term>" heading starts a term; ends at next ### / ## or ---
//   * Fields are bullets: "- **<Label>:** <text>"
//   * Required: Definition (skip term without it)

import { computeVersionHash } from '../asset/versionHash';

export interface GlossaryTerm {
  term: string;
  definition: string;
  businessContext: string | null;
  dataUsage: string | null;
  relatedTerms: string[];
  source: string | null;
  domain: string | null;
  subdomain: string | null;
  headingLine: number;
  blockText: string;
  versionHash: string;
}

const DOMAIN_HEADING_RE = /^##\s+Domain:\s*(.+)/;
const DOMAIN_BOLD_RE = /^\*\*Domain:\*\*\s*(.+)/;
const SUBDOMAIN_RE = /^\*\*Subdomain:\*\*\s*(.+)/;
const TERM_HEADING_RE = /^###\s+(.+)/;
const FIELD_RE = /^-\s+\*\*([^*]+):\*\*\s*(.+)/;
const SECTION_END_RE = /^(###\s|##\s|---)/;

export function parseGlossaryMarkdown(content: string, filePath: string): GlossaryTerm[] {
  const lines = content.split('\n');
  const terms: GlossaryTerm[] = [];

  let domain: string | null = null;
  let subdomain: string | null = null;

  let currentTerm: string | null = null;
  let currentLine = 0;
  let fields: Record<string, string> = {};
  let blockLines: string[] = [];

  function flushTerm(): void {
    if (!currentTerm) return;
    const definition = fields['Definition'];
    if (!definition) {
      // Skip terms without a definition
      currentTerm = null;
      fields = {};
      blockLines = [];
      return;
    }

    const blockText = blockLines.join('\n').trim();
    const relatedRaw = fields['Related Terms'] ?? '';
    const relatedTerms = relatedRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    terms.push({
      term: currentTerm,
      definition,
      businessContext: fields['Business Context'] ?? null,
      dataUsage: fields['Data Usage'] ?? null,
      relatedTerms,
      source: fields['Source'] ?? null,
      domain,
      subdomain,
      headingLine: currentLine,
      blockText,
      versionHash: computeVersionHash(blockText),
    });

    currentTerm = null;
    fields = {};
    blockLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Domain (file-level, first match wins)
    if (!domain) {
      const domainHeading = DOMAIN_HEADING_RE.exec(trimmed);
      if (domainHeading) {
        domain = domainHeading[1].trim();
        continue;
      }
      const domainBold = DOMAIN_BOLD_RE.exec(trimmed);
      if (domainBold) {
        domain = domainBold[1].trim();
        continue;
      }
    }

    // Subdomain
    const subdomainMatch = SUBDOMAIN_RE.exec(trimmed);
    if (subdomainMatch) {
      subdomain = subdomainMatch[1].trim();
      continue;
    }

    // Term heading
    const termMatch = TERM_HEADING_RE.exec(trimmed);
    if (termMatch) {
      flushTerm();
      currentTerm = termMatch[1].trim();
      currentLine = i + 1; // 1-indexed
      blockLines = [line];
      continue;
    }

    // Section end (## or --- while inside a term)
    if (currentTerm && SECTION_END_RE.test(trimmed) && !TERM_HEADING_RE.test(trimmed)) {
      flushTerm();
      // Re-process this line for domain detection on next iteration is fine;
      // but ## Domain would already be caught above.
      continue;
    }

    // Field bullet inside a term
    if (currentTerm) {
      blockLines.push(line);
      const fieldMatch = FIELD_RE.exec(trimmed);
      if (fieldMatch) {
        fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
      }
    }
  }

  flushTerm();
  return terms;
}
