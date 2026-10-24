// client/src/test/smoke.test.tsx — proves the jsdom component-test setup
// Session 26 · Build 4 · wave 4-0. Renders ErrorBoundary in both states and
// runs an axe check on each.

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ErrorBoundary } from '../ErrorBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('client test setup (smoke)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', async () => {
    const { container } = render(
      <ErrorBoundary>
        <main>
          <h1>Semantic Ground Truth</h1>
        </main>
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: 'Semantic Ground Truth' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the error card when a child throws', async () => {
    // React and ErrorBoundary.componentDidCatch both log the caught error.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByText('Application Error')).toBeInTheDocument();
    expect(screen.getByText('Error: boom')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
