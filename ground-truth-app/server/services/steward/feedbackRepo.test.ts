// server/services/steward/feedbackRepo.test.ts — FeedbackBranch.htmlUrl inputs
// Build 5 · Session 44 · Vitest

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/databricks', () => ({
  workspaceHost: () => 'https://ws.example.com',
  getAppSpnToken: vi.fn(async () => 'spn-token'),
}));

import { createFeedbackRepoUrlResolver, feedbackBranchHtmlUrl, toRepoWebUrl } from './feedbackRepo';

const REPO = 'https://github.com/example-org/semantic-ground-truth';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toRepoWebUrl', () => {
  it.each([
    [`${REPO}.git`, REPO],
    [`${REPO}/`, REPO],
    [REPO, REPO],
    ['git@github.com:example-org/semantic-ground-truth.git', REPO],
    ['https://user:pat@github.com/example-org/semantic-ground-truth.git', REPO],
  ])('%s -> %s', (input, out) => {
    expect(toRepoWebUrl(input)).toBe(out);
  });

  it.each(['', '   ', 'not a url', 'http://github.com/o/r', 'https://github.com/', 'file:///tmp/repo'])(
    'rejects %j',
    (input) => {
      expect(toRepoWebUrl(input)).toBeNull();
    },
  );
});

describe('feedbackBranchHtmlUrl', () => {
  it('builds <repo>/tree/<branch> and is null when either part is missing', () => {
    expect(feedbackBranchHtmlUrl(REPO, 'mg-genie-feedback-20261027')).toBe(`${REPO}/tree/mg-genie-feedback-20261027`);
    expect(feedbackBranchHtmlUrl(null, 'mg-genie-feedback-20261027')).toBeNull();
    expect(feedbackBranchHtmlUrl(REPO, '')).toBeNull();
  });
});

describe('createFeedbackRepoUrlResolver', () => {
  it('uses GT_FEEDBACK_REPO_URL without any API call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const resolve = createFeedbackRepoUrlResolver({ GT_FEEDBACK_REPO_URL: `${REPO}.git` });
    expect(await resolve()).toBe(REPO);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an invalid GT_FEEDBACK_REPO_URL gives null', async () => {
    expect(await createFeedbackRepoUrlResolver({ GT_FEEDBACK_REPO_URL: 'ssh://nope' })()).toBeNull();
  });

  it('null when neither env var is set', async () => {
    expect(await createFeedbackRepoUrlResolver({})()).toBeNull();
  });

  it('reads the Repos API once for GT_FEEDBACK_REPO_PATH (exact path match, cached)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      repos: [
        { path: '/Users/a@x.com/semanticGroundTruth-old', url: 'https://github.com/other/old.git' },
        { path: '/Users/a@x.com/semanticGroundTruth', url: `${REPO}.git` },
      ],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const resolve = createFeedbackRepoUrlResolver({ GT_FEEDBACK_REPO_PATH: '/Workspace/Users/a@x.com/semanticGroundTruth' });
    expect(await resolve()).toBe(REPO);
    expect(await resolve()).toBe(REPO);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://ws.example.com/api/2.0/repos?path_prefix=${encodeURIComponent('/Users/a@x.com/semanticGroundTruth')}`);
    expect(init.headers).toEqual({ Authorization: 'Bearer spn-token' });
  });

  it('API errors give null and never throw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 403 })));
    expect(await createFeedbackRepoUrlResolver({ GT_FEEDBACK_REPO_PATH: '/Users/a/r' })()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await createFeedbackRepoUrlResolver({ GT_FEEDBACK_REPO_PATH: '/Users/a/r' })()).toBeNull();
  });
});
