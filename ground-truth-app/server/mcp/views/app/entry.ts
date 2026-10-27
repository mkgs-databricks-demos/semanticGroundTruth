/// <reference lib="dom" />
// server/mcp/views/app/entry.ts — bundle entry for the review card MCP App (build.ts)
// Session 34 · Wave 4-2 · No enum, no namespace, no default export

import { startReviewCardApp } from './main';
import { REVIEW_CARD_ROOT_ID } from './template';

const root = document.getElementById(REVIEW_CARD_ROOT_ID);
if (root) {
  startReviewCardApp(root).catch((err: unknown) => {
    root.textContent = 'The review card could not connect to the host. Use the text reply instead.';
    console.error('[review-card] connect failed', err);
  });
}
