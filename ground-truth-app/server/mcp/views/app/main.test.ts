// @vitest-environment jsdom
// server/mcp/views/app/main.test.ts — ext-apps App lifecycle against a fake MCP Apps host
// Session 34 · Wave 4-2 · The SDK's InMemoryTransport stands in for PostMessageTransport (design L300-17 §6)

import { describe, expect, it } from 'vitest';
import { InMemoryTransport, type JSONRPCMessage } from '@modelcontextprotocol/client';
import { APP_INFO, startReviewCardApp } from './main';
import { ASSET_ID, NEXT_ASSET_ID, makeCard, makeVoteResult } from '../../testFixtures';

type Msg = JSONRPCMessage & { id?: string | number; method?: string; params?: Record<string, unknown> };
type ToolCallHandler = (params: Record<string, unknown>) => Record<string, unknown>;

/** Minimal host side of the MCP Apps protocol: initialize, tools/call, update-model-context. */
class FakeHost {
  readonly received: Msg[] = [];
  onToolCall: ToolCallHandler = () => ({ content: [] });

  constructor(
    private readonly transport: InMemoryTransport,
    private readonly hostContext: Record<string, unknown>,
  ) {
    transport.onmessage = (msg) => void this.handle(msg as Msg);
  }

  private async handle(msg: Msg): Promise<void> {
    this.received.push(msg);
    if (msg.id === undefined || !msg.method) return;
    const reply = (result: Record<string, unknown>) => this.transport.send({ jsonrpc: '2.0', id: msg.id!, result });
    if (msg.method === 'ui/initialize') {
      await reply({
        protocolVersion: msg.params?.protocolVersion,
        hostInfo: { name: 'fake-host', version: '1.0.0' },
        hostCapabilities: { serverTools: {}, updateModelContext: {} },
        hostContext: this.hostContext,
      });
    } else if (msg.method === 'tools/call') {
      await reply(this.onToolCall(msg.params ?? {}));
    } else {
      await reply({});
    }
  }

  notify(method: string, params: Record<string, unknown>): Promise<void> {
    return this.transport.send({ jsonrpc: '2.0', method, params });
  }

  methods(): string[] {
    return this.received.map((m) => m.method ?? '(response)');
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function start(hostContext: Record<string, unknown> = {}) {
  document.documentElement.removeAttribute('data-theme');
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const host = new FakeHost(hostTransport, hostContext);
  await hostTransport.start();
  const { app, view } = await startReviewCardApp(root, { transport: appTransport, autoResize: false });
  return { root, host, app, view };
}

describe('review card App lifecycle', () => {
  it('initializes with the design app info and sends initialized', async () => {
    const { host } = await start();
    const init = host.received.find((m) => m.method === 'ui/initialize')!;
    expect(init.params?.appInfo).toEqual(APP_INFO);
    expect(APP_INFO).toEqual({ name: 'ground-truth-review-card', version: '1.0.0' });
    expect(host.methods()).toContain('ui/notifications/initialized');
  });

  it('applies the host theme, style variables and container width', async () => {
    const { root, host } = await start({
      theme: 'dark',
      styles: { variables: { '--color-background-primary': '#000000' } },
      containerDimensions: { maxWidth: 300 },
    });
    const html = document.documentElement;
    expect(html.getAttribute('data-theme')).toBe('dark');
    expect(html.style.getPropertyValue('--color-background-primary')).toBe('#000000');
    expect(root.classList.contains('narrow')).toBe(true);

    await host.notify('ui/notifications/host-context-changed', { theme: 'light' });
    await tick();
    expect(html.getAttribute('data-theme')).toBe('light');
  });

  it('renders the card from ui/notifications/tool-result structuredContent', async () => {
    const { root, host } = await start();
    await host.notify('ui/notifications/tool-result', {
      content: [{ type: 'text', text: 'card' }],
      structuredContent: makeCard(),
    });
    await tick();
    expect(root.querySelector<HTMLElement>('section.card')?.dataset.assetId).toBe(ASSET_ID);
  });

  it('Approve goes to the server through tools/call and renders structuredContent.next', async () => {
    const { root, host } = await start();
    await host.notify('ui/notifications/tool-result', { content: [], structuredContent: makeCard() });
    await tick();
    const calls: Record<string, unknown>[] = [];
    host.onToolCall = (params) => {
      calls.push(params);
      return { content: [{ type: 'text', text: 'Vote recorded' }], structuredContent: makeVoteResult(makeCard(NEXT_ASSET_ID)) };
    };
    root.querySelector<HTMLButtonElement>('button[data-action="approve"]')!.click();
    for (let i = 0; i < 5; i++) await tick();
    expect(calls).toEqual([
      expect.objectContaining({ name: 'review_submit_vote', arguments: { asset_id: ASSET_ID, vote_type: 'approve' } }),
    ]);
    expect(root.querySelector<HTMLElement>('section.card')?.dataset.assetId).toBe(NEXT_ASSET_ID);
  });

  it('repeated tool errors are reported to the model with ui/update-model-context', async () => {
    const { root, host } = await start();
    await host.notify('ui/notifications/tool-result', { content: [], structuredContent: makeCard() });
    await tick();
    host.onToolCall = () => ({ isError: true, content: [{ type: 'text', text: 'Error [INTERNAL]: boom' }] });
    for (let n = 0; n < 2; n++) {
      root.querySelector<HTMLButtonElement>('button[data-action="approve"]')!.click();
      for (let i = 0; i < 5; i++) await tick();
    }
    const update = host.received.find((m) => m.method === 'ui/update-model-context');
    expect(update).toBeDefined();
    expect(JSON.stringify(update?.params)).toContain('Error [INTERNAL]: boom');
  });
});
