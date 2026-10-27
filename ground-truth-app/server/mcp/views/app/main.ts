/// <reference lib="dom" />
// server/mcp/views/app/main.ts — connects the ext-apps App client to the review card view
// Session 34 · Wave 4-2 · No enum, no namespace, no default export
//
// Lifecycle (design L300-17 §4): create App -> register handlers -> connect
// (PostMessageTransport to the host by default) -> apply host theme -> render
// each ui/notifications/tool-result -> user actions go through
// app.callServerTool. The view never sees tokens and never calls fetch.

import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ReviewCardView } from './view';

export const APP_INFO = { name: 'ground-truth-review-card', version: '1.0.0' } as const;

export interface StartOptions {
  /** Defaults to PostMessageTransport(window.parent) inside App.connect. */
  transport?: Transport;
  /** Report the card height to the host (default true). */
  autoResize?: boolean;
  timeoutMs?: number;
}

/** Apply host theme, style variables, fonts and container width. */
export function applyHostContext(ctx: McpUiHostContext, view?: ReviewCardView): void {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  const dims = ctx.containerDimensions as { width?: number; maxWidth?: number } | undefined;
  view?.setContainerWidth(dims?.width ?? dims?.maxWidth);
}

export async function startReviewCardApp(
  root: HTMLElement,
  options: StartOptions = {},
): Promise<{ app: App; view: ReviewCardView }> {
  const app = new App({ ...APP_INFO }, {}, { autoResize: options.autoResize ?? true });
  const view = new ReviewCardView(
    root,
    { callServerTool: (params) => app.callServerTool(params) },
    {
      timeoutMs: options.timeoutMs,
      // Tell the model when the card keeps failing, so it can fall back to text.
      onPersistentError: (message) => {
        app
          .updateModelContext({ content: [{ type: 'text', text: `The review card could not reach the server: ${message}` }] })
          .catch(() => undefined);
      },
    },
  );

  app.ontoolresult = (params) => view.showToolResult(params);
  app.onhostcontextchanged = (ctx) => applyHostContext(ctx, view);
  app.onteardown = () => Promise.resolve({});

  await app.connect(options.transport);
  const ctx = app.getHostContext();
  if (ctx) applyHostContext(ctx, view);
  return { app, view };
}
