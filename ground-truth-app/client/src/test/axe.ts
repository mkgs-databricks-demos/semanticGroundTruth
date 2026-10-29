// client/src/test/axe.ts — the one axe configuration every component test uses
// Session 43 · Build 5 · wave 5-0 (ui_test_strategy.md §1, §4)
//
// vitest-axe 0.1.0 works with vitest 4.1.9 (session 26 smoke test), so this
// wraps its `configureAxe` rather than a local matcher. Rules: WCAG 2.0/2.1
// A and AA only. `color-contrast` is off in jsdom (no CSS cascade or canvas);
// contrast is covered by theme/contrast.test.ts and the Chromium visual job.
//
//   await expectNoAxeViolations(container);
//   // one rule off for one test: comment why + list it as a suppression
//   await expectNoAxeViolations(container, { disableRules: ['aria-allowed-role'] });

import { expect } from 'vitest';
import { configureAxe } from 'vitest-axe';

/** axe tags that define the gate (WCAG 2.1 A/AA, which includes 2.0 A/AA). */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/** Rules disabled for every test, with the reason. Keep this list short. */
export const AXE_GLOBALLY_DISABLED_RULES: Readonly<Record<string, string>> = {
  'color-contrast': 'jsdom computes no CSS; covered by contrast.test.ts and the Chromium job',
};

function rulesOff(names: readonly string[]): Record<string, { enabled: false }> {
  return Object.fromEntries(names.map((n) => [n, { enabled: false as const }]));
}

/** Configured axe runner: `expect(await axe(container)).toHaveNoViolations()`. */
export const axe = configureAxe({
  runOnly: { type: 'tag', values: [...AXE_TAGS] },
  rules: rulesOff(Object.keys(AXE_GLOBALLY_DISABLED_RULES)),
});

export interface AxeCheckOptions {
  /**
   * Rules to disable for this check only. Each one needs a code comment with
   * the reason and a `suppressions` entry in the session status file.
   */
  disableRules?: readonly string[];
}

/** Run axe on `container` and fail with the violation list if there is any. */
export async function expectNoAxeViolations(
  container: Element,
  options: AxeCheckOptions = {},
): Promise<void> {
  const results = await axe(container, {
    rules: rulesOff([...Object.keys(AXE_GLOBALLY_DISABLED_RULES), ...(options.disableRules ?? [])]),
  });
  expect(results).toHaveNoViolations();
}
