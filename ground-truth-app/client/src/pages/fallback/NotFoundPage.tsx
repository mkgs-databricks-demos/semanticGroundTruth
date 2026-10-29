// @a11y-strict
// client/src/pages/fallback/NotFoundPage.tsx — S11 not found (route `*`)
// Session 49 · Build 5 · wave 5-1. Port of figma/_code/src/pages/FallbackPages.tsx
// (not-found): Databricks icon, "Page not found", link back to Review.
// Rendered inside the shell for unknown routes, so it is a <section>, not <main>.

import { Link } from 'react-router';
import { Icon } from '../../components/ui/Icon';

export function NotFound() {
  return (
    <section
      data-testid="not-found-root"
      aria-labelledby="not-found-title"
      className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-border bg-card px-8 py-12 text-center text-card-foreground"
    >
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-muted text-foreground">
        <Icon name="search" size={32} />
      </span>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">404</p>
      <h1 id="not-found-title" className="text-2xl font-bold">
        Page not found
      </h1>
      <p className="text-muted-foreground">The page you're looking for doesn't exist or moved.</p>
      <Link
        to="/"
        data-testid="not-found-home-link"
        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Icon name="checklist" size={16} />
        Back to Review
      </Link>
    </section>
  );
}
