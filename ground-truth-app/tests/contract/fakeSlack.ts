// tests/contract/fakeSlack.ts — fake system.ai.slack for the contract suite
// Build 5 · Session 50 · test-only · No default export
//
// routes.contract.test.ts mocks SlackMcpClient with createFakeSlackClient();
// cases switch `fakeSlack.mode` in setup (reset after each test). No server
// imports here: the vi.mock factory loads this file while slackMcp is mocked.

export const FAKE_SLACK_CHANNELS = [{ id: 'C0123ABCD', name: 'data-stewards' }];
export const FAKE_SLACK_LOGIN_URL = 'https://example.cloud.databricks.com/slack/login';
export const FAKE_SLACK_PERMALINK = 'https://acme.slack.com/archives/C0123ABCD/p1761600000000100';

export const fakeSlack: { mode: 'ok' | 'login' | 'rate_limited' | 'down' } = { mode: 'ok' };

interface Errors {
  login: (url: string) => Error;
  rateLimited: () => Error;
  down: () => Error;
}

/** A SlackMcpClient stand-in class; `errors` builds the real error types. */
export function createFakeSlackClient(errors: Errors) {
  return class FakeSlackMcpClient {
    constructor(opts: { token: string }) {
      if (!opts.token) throw new Error('FakeSlackMcpClient: no OBO token');
    }
    private check(): void {
      if (fakeSlack.mode === 'login') throw errors.login(FAKE_SLACK_LOGIN_URL);
      if (fakeSlack.mode === 'rate_limited') throw errors.rateLimited();
      if (fakeSlack.mode === 'down') throw errors.down();
    }
    async searchChannels() { this.check(); return FAKE_SLACK_CHANNELS.map((c) => ({ ...c })); }
    async send() { this.check(); return { permalink: FAKE_SLACK_PERMALINK }; }
    async draft() { this.check(); return {}; }
  };
}
