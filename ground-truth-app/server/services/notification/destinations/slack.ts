// server/services/notification/destinations/slack.ts — Slack incoming-webhook destination
// Session 08 · Wave 2 · Never log the URL

import type { Destination } from './types';

export class SlackDestination implements Destination {
  readonly channel = 'slack' as const;

  enabled(): boolean {
    return !!process.env.SLACK_WEBHOOK_URL;
  }

  async send(n: { title: string; body?: string; link?: string }): Promise<void> {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return;

    const parts = [`*${n.title}*`];
    if (n.body) parts.push(n.body);
    if (n.link) parts.push(n.link);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: parts.join('\n') }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}`);
    }
  }
}
