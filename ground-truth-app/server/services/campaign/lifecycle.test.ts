// server/services/campaign/lifecycle.test.ts — vitest tests for lifecycle helpers
// Session 07 · Wave 2 · Written (not run — no Node toolchain in Genie Code)

import { describe, it, expect } from 'vitest';
import { ALLOWED_TRANSITIONS, assertTransition } from './lifecycle';

describe('ALLOWED_TRANSITIONS', () => {
  it('allows active → paused', () => {
    expect(ALLOWED_TRANSITIONS.active).toContain('paused');
  });

  it('allows active → completed', () => {
    expect(ALLOWED_TRANSITIONS.active).toContain('completed');
  });

  it('allows active → archived', () => {
    expect(ALLOWED_TRANSITIONS.active).toContain('archived');
  });

  it('allows paused → active', () => {
    expect(ALLOWED_TRANSITIONS.paused).toContain('active');
  });

  it('allows paused → archived', () => {
    expect(ALLOWED_TRANSITIONS.paused).toContain('archived');
  });

  it('allows completed → archived', () => {
    expect(ALLOWED_TRANSITIONS.completed).toContain('archived');
  });

  it('does not allow archived → anything', () => {
    expect(ALLOWED_TRANSITIONS.archived).toHaveLength(0);
  });
});

describe('assertTransition', () => {
  it('does not throw for valid transitions', () => {
    expect(() => assertTransition('active', 'paused')).not.toThrow();
    expect(() => assertTransition('active', 'completed')).not.toThrow();
    expect(() => assertTransition('paused', 'active')).not.toThrow();
    expect(() => assertTransition('completed', 'archived')).not.toThrow();
  });

  it('throws conflict for invalid transitions', () => {
    expect(() => assertTransition('completed', 'active')).toThrow(
      /Cannot transition/,
    );
    expect(() => assertTransition('archived', 'active')).toThrow(
      /Cannot transition/,
    );
    expect(() => assertTransition('paused', 'completed')).toThrow(
      /Cannot transition/,
    );
  });

  it('throws conflict for self-transitions', () => {
    expect(() => assertTransition('active', 'active')).toThrow(
      /Cannot transition/,
    );
  });
});
