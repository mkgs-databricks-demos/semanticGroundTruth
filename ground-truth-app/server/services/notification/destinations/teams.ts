// server/services/notification/destinations/teams.ts — Microsoft Teams incoming-webhook destination
// Session 08 · Wave 2 · MessageCard-style payload · Never log the URL

import type { Destination } from './types';

export class TeamsDestination implements Destination {
  readonly channel = 'teams' as const;

  enabled(): boolean {
    return !!process.env.TEAMS_WEBHOOK_URL;
  }

  async send(n: { title: string; body?: string; link?: string }): Promise<void> {
    const url = process.env.TEAMS_WEBHOOK_URL;
    if (!url) return;

    const textParts = [n.body, n.link].filter(Boolean);
    const text = textParts.length > 0 ? textParts.join('\n') : n.title;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: n.title, text }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Teams webhook returned ${response.status}`);
    }
  }
}
