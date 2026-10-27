// Types for the vitest-axe matcher registered in setup.ts.
// vitest-axe 0.1.0 ships its augmentation for the old global `Vi` namespace,
// so declare it for the vitest 4 `Assertion` interface here. Declaration
// merging requires the same type parameter (`T`) as vitest's own interface,
// and an empty body, hence the narrow lint disables.
import type { AxeMatchers } from 'vitest-axe/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
