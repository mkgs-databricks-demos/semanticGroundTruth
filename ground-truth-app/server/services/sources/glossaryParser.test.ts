// server/services/sources/glossaryParser.test.ts — unit tests for glossary parser
// Session 09 · Wave 1

import { describe, it, expect } from 'vitest';
import { parseGlossaryMarkdown } from './glossaryParser';

// ── Format 1: docs/semantics style (## Domain:, ### Term, bullet fields) ──────

const FORMAT_1 = `# Semantics: Ground Truth App — Core Terminology

## Domain: Semantic Validation Platform

These terms are specific to the Semantic Ground Truth App.

---

### Ground Truth
- **Definition:** The verified, organization-specific meaning of a UC semantic asset as validated by business subject matter experts through crowdsourced voting.
- **Business Context:** Organizations need their UC Semantics to reflect how the business actually thinks about its data.
- **Related Terms:** Confidence Score, Certification, Wilson Score
- **Source:** Project ideation (2026-09-28)

### Review Card
- **Definition:** The atomic unit of work presented to a business user for validation.
- **Business Context:** Cards are designed to be judged in seconds.
- **Data Usage:** Stored in app.votes via the REST API.
- **Related Terms:** Card Swipe, Progressive Disclosure
- **Source:** Project ideation (2026-09-28)

---

## Tagging Strategy
- Priority 1 (deploy immediately)
`;

// ── Format 2: wanderBricks style (**Domain:**, optional **Subdomain:**) ───────

const FORMAT_2 = `# WanderBricks Semantics

**Domain:** Travel & Hospitality

**Subdomain:** Bookings

### Booking Confirmation Rate
- **Definition:** Percentage of initiated bookings that reach confirmed status within 24 hours.
- **Business Context:** Key conversion metric for the booking funnel.
- **Related Terms:** Conversion Rate, Funnel Drop-off

### Average Stay Duration
- **Definition:** Mean number of nights per confirmed booking.
- **Business Context:** Drives revenue-per-booking calculations.

**Subdomain:** Guest Engagement

### Net Promoter Score
- **Definition:** Customer loyalty metric derived from post-stay survey responses.
- **Related Terms:** CSAT, Guest Satisfaction
`;

describe('parseGlossaryMarkdown', () => {
  describe('format 1: docs/semantics style', () => {
    const terms = parseGlossaryMarkdown(FORMAT_1, 'docs/semantics/01_core.md');

    it('extracts all terms with definitions', () => {
      expect(terms).toHaveLength(2);
      expect(terms.map((t) => t.term)).toEqual(['Ground Truth', 'Review Card']);
    });

    it('parses domain from ## Domain: heading', () => {
      expect(terms[0].domain).toBe('Semantic Validation Platform');
      expect(terms[1].domain).toBe('Semantic Validation Platform');
    });

    it('parses definition', () => {
      expect(terms[0].definition).toContain('verified, organization-specific');
    });

    it('parses business context', () => {
      expect(terms[0].businessContext).toContain('Organizations need');
    });

    it('parses data usage', () => {
      expect(terms[0].dataUsage).toBeNull();
      expect(terms[1].dataUsage).toContain('Stored in app.votes');
    });

    it('parses related terms as comma-separated list', () => {
      expect(terms[0].relatedTerms).toEqual(['Confidence Score', 'Certification', 'Wilson Score']);
    });

    it('parses source', () => {
      expect(terms[0].source).toBe('Project ideation (2026-09-28)');
    });

    it('sets subdomain to null when not specified', () => {
      expect(terms[0].subdomain).toBeNull();
    });

    it('records heading line number (1-indexed)', () => {
      expect(terms[0].headingLine).toBeGreaterThan(0);
    });

    it('generates a non-empty version hash', () => {
      expect(terms[0].versionHash).toBeTruthy();
      expect(terms[0].versionHash).toHaveLength(64); // SHA-256 hex
    });
  });

  describe('format 2: wanderBricks style', () => {
    const terms = parseGlossaryMarkdown(FORMAT_2, 'semantics/bookings.md');

    it('extracts all terms', () => {
      expect(terms).toHaveLength(3);
      expect(terms.map((t) => t.term)).toEqual([
        'Booking Confirmation Rate',
        'Average Stay Duration',
        'Net Promoter Score',
      ]);
    });

    it('parses domain from **Domain:** bold', () => {
      expect(terms[0].domain).toBe('Travel & Hospitality');
    });

    it('parses subdomain and tracks changes', () => {
      expect(terms[0].subdomain).toBe('Bookings');
      expect(terms[1].subdomain).toBe('Bookings');
      expect(terms[2].subdomain).toBe('Guest Engagement');
    });

    it('handles missing optional fields', () => {
      expect(terms[1].source).toBeNull();
      expect(terms[1].relatedTerms).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('skips terms without a definition', () => {
      const md = `## Domain: Test

### No Definition Term
- **Business Context:** Some context but no definition.

### Has Definition
- **Definition:** This one counts.
`;
      const terms = parseGlossaryMarkdown(md, 'test.md');
      expect(terms).toHaveLength(1);
      expect(terms[0].term).toBe('Has Definition');
    });

    it('returns empty array for non-glossary markdown', () => {
      const terms = parseGlossaryMarkdown('# Just a title\n\nSome text.', 'readme.md');
      expect(terms).toHaveLength(0);
    });

    it('handles empty input', () => {
      expect(parseGlossaryMarkdown('', 'empty.md')).toEqual([]);
    });
  });
});
