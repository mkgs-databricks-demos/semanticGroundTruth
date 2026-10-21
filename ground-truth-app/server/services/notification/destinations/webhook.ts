// server/services/notification/destinations/webhook.ts — generic JSON webhook destination
// Session 08 · Wave 2 · Raw JSON payload · Never log the URL

import type { Destination } from './types';

export class WebhookDestination implements Destination {
  readonly channel = 'webhook' as const;

  enabled(): boolean {
    return !!process.env.GENERIC_WEBHOOK_URL;
  }

  async send(n: { title: string; body?: string; link?: string }): Promise<void> {
    const url = process.env.GENERIC_WEBHOOK_URL;
    if (!url) return;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  }
}
