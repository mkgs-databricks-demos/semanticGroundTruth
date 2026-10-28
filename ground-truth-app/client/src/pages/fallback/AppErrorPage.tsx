// @a11y-strict
// client/src/pages/fallback/AppErrorPage.tsx — S11 app error (render crash or route error)
// Session 49 · Build 5 · wave 5-1. Port of figma/_code/src/pages/FallbackPages.tsx
// (app-error). Friendly message + Reload; the error and stack stay behind a
// "Technical details" disclosure (native <details>, closed by default), so
// users never see a stack trace unless they ask for it.
//
// <AppError> needs no router: ErrorBoundary (outside the router) renders it.
// <RouteErrorPage> is the router's errorElement; a 404 route response shows
// the not-found page instead.

import { useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Icon } from '../../components/ui/Icon';
import { NotFound } from './NotFoundPage';

export interface AppErrorProps {
  error: unknown;
  /** React component stack from componentDidCatch, when known. */
  componentStack?: string | null;
  /** Reload action (default: window.location.reload; injectable for tests). */
  onReload?: () => void;
}

/** "Error: boom" for an Error, the text of anything else. */
export function errorSummary(error: unknown): string {
  if (error instanceof Error) return error.toString();
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`.trim();
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function technicalDetails(error: unknown, componentStack?: string | null): string {
  const parts = [errorSummary(error)];
  if (error instanceof Error && error.stack) parts.push(error.stack);
  if (componentStack) parts.push(`Component stack:${componentStack}`);
  return parts.join('\n\n');
}

export function AppError({ error, componentStack, onReload = () => window.location.reload() }: AppErrorProps) {
  const [copied, setCopied] = useState(false);
  const details = technicalDetails(error, componentStack);
  const stack = error instanceof Error ? error.stack : undefined;

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(details);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-16 text-foreground">
      <section
        data-testid="app-error-root"
        aria-labelledby="app-error-title"
        className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center text-card-foreground"
      >
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-muted text-destructive">
          <Icon name="danger" size={36} />
        </span>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Application Error</p>
        <h1 id="app-error-title" className="text-2xl font-bold">
          Something went wrong
        </h1>
        <p className="text-muted-foreground">
          Reload the page to try again. If it keeps happening, share the details below with your admin.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            data-testid="app-error-reload"
            onClick={onReload}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Icon name="refresh" size={16} />
            Reload
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-4 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Icon name={copied ? 'check' : 'copy'} size={16} />
            {copied ? 'Details copied' : 'Copy details'}
          </button>
        </div>
        <details data-testid="app-error-details" className="mt-4 w-full rounded-lg border border-border text-left">
          <summary
            data-testid="app-error-details-toggle"
            className="min-h-11 cursor-pointer px-4 py-3 font-bold focus-visible:outline-2 focus-visible:outline-ring"
          >
            Technical details
          </summary>
          <div className="flex flex-col gap-2 border-t border-border p-4">
            <p className="font-mono text-sm">{errorSummary(error)}</p>
            {stack ? (
              <pre className="max-h-72 overflow-auto rounded bg-muted p-3 font-mono text-xs">{stack}</pre>
            ) : null}
            {componentStack ? (
              <pre className="max-h-72 overflow-auto rounded bg-muted p-3 font-mono text-xs">{componentStack.trim()}</pre>
            ) : null}
          </div>
        </details>
        <div role="status" className="sr-only">
          {copied ? 'Technical details copied' : ''}
        </div>
      </section>
    </main>
  );
}

/** Router errorElement: loader/render errors below the root route. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return <AppError error={error} />;
}
