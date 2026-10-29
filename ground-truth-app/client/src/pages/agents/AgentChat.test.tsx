// @a11y-strict
// client/src/pages/agents/AgentChat.test.tsx — S3 Assistant (ui_test_strategy.md §8 S3 rows)
// Session 53 · Build 5 · wave 5-2
//
// empty (3 starter prompts; clicking one sends it), populated / streaming
// (role="log" with data-role messages; input disabled while streaming),
// error / no-agent / offline (alert + Try again; no-agent copy; input
// disabled), F10 reviewer-facing copy, keyboard (Enter sends, Shift+Enter new
// line, focus returns to the input). axe in every state, light and dark.
//
// The agents hook is mocked at module level: components/assistant/agentClient
// is replaced by a stateful fake driven by `chat` (no network, no SSE). The
// fake lives in this file and imports nothing from the mocked module.

import { act, screen, waitFor, within } from '@testing-library/react';
import { useCallback, useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentChatEvent,
  AgentsClientConfig,
  UseAgentChatOptions,
  UseAgentChatResult,
} from '../../components/assistant/agentClient';
import { STARTER_PROMPTS } from '../../components/assistant/ConversationLog';
import { expectNoAxeViolations } from '../../test/axe';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import type { RenderWithProvidersOptions } from '../../test/render';
import { AgentChat } from './AgentChat';

interface Turn {
  reply?: string;
  error?: string;
  events?: AgentChatEvent[];
  /** Keep the stream open until `chat.release()`. */
  hold?: boolean;
}

const chat = vi.hoisted(() => ({
  config: { agents: ['review-assistant'], defaultAgent: 'review-assistant' } as {
    agents: string[];
    defaultAgent: string | null;
    skills?: Record<string, { name: string; description: string }[]>;
  },
  turns: [] as unknown[],
  sent: [] as string[],
  agentOption: [] as string[],
  release: null as null | (() => void),
  impl: null as null | ((opts: unknown) => unknown),
}));

vi.mock('../../components/assistant/agentClient', () => ({
  AGENTS_PLUGIN: 'agents',
  usePluginClientConfig: () => chat.config,
  useAgentChat: (opts: unknown) => chat.impl!(opts),
}));

function useFakeAgentChat(opts: UseAgentChatOptions): UseAgentChatResult {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  chat.agentOption.push(opts.agent);
  const send = useCallback(async (message: string) => {
    chat.sent.push(message);
    setContent('');
    setError(null);
    setIsStreaming(true);
    const turn = (chat.turns.shift() as Turn | undefined) ?? { reply: 'Done.' };
    for (const event of turn.events ?? []) optsRef.current.onEvent?.(event);
    if (turn.hold) {
      await new Promise<void>((resolve) => {
        chat.release = resolve;
      });
    }
    if (turn.error) setError(turn.error);
    else setContent(turn.reply ?? '');
    setIsStreaming(false);
  }, []);
  return { content, events: [], threadId: null, isStreaming, error, send, reset: () => undefined };
}

const DEFAULT_CONFIG: AgentsClientConfig = { agents: ['review-assistant'], defaultAgent: 'review-assistant' };

beforeEach(() => {
  chat.impl = useFakeAgentChat as (opts: unknown) => unknown;
  chat.config = { ...DEFAULT_CONFIG };
  chat.turns = [];
  chat.sent = [];
  chat.agentOption = [];
  chat.release = null;
});

function renderChat(options: RenderWithProvidersOptions = {}) {
  return renderWithProviders(<AgentChat />, { route: '/assistant', ...options });
}

const log = () => screen.getByRole('log', { name: 'Conversation' });
const input = () => screen.getByRole('textbox', { name: 'Message the assistant' });
const sendButton = () => screen.getByTestId('assistant-composer-send');
const messagesOf = (role: string) =>
  within(log())
    .queryAllByTestId('assistant-chat-message')
    .filter((m) => m.getAttribute('data-role') === role);

const LEADERBOARD_TOOL: AgentChatEvent = {
  type: 'response.output_item.added',
  item: { type: 'function_call', name: 'get_leaderboard', arguments: '{"period":"7d"}' },
};

describe('S3 assistant · empty', () => {
  it('renders one h1, reviewer-facing intro and 3 starter prompt buttons', async () => {
    const { container } = renderChat();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Assistant' })).toBeInTheDocument();
    expect(screen.getByText(/Ask about any asset, its confidence score/)).toBeInTheDocument();
    const starters = within(log()).getAllByTestId('assistant-starter-prompt');
    expect(starters.map((b) => b.textContent)).toEqual([...STARTER_PROMPTS]);
    for (const b of starters) expect(b).toHaveRole('button');
    expect(screen.getByTestId('assistant-chat-root')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('clicking a starter prompt sends it and shows the exchange', async () => {
    chat.turns.push({ reply: 'Readmission Rate (30-day) is at 71% confidence.' });
    const { user } = renderChat();
    await user.click(screen.getByRole('button', { name: STARTER_PROMPTS[0] }));
    expect(chat.sent).toEqual([STARTER_PROMPTS[0]]);
    await waitFor(() => expect(messagesOf('assistant')).toHaveLength(1));
    expect(messagesOf('user')[0]).toHaveTextContent(STARTER_PROMPTS[0]);
    expect(messagesOf('assistant')[0]).toHaveTextContent('71% confidence');
    expect(screen.queryAllByTestId('assistant-starter-prompt')).toHaveLength(0);
  });

  it('talks to the default agent', () => {
    renderChat();
    expect(chat.agentOption.at(-1)).toBe('review-assistant');
  });
});

describe('S3 assistant · F10 copy', () => {
  it('shows no file paths or agent ids anywhere on the page', async () => {
    chat.turns.push({ reply: 'Here you go.', events: [LEADERBOARD_TOOL] });
    const { container, user } = renderChat();
    const text = () => container.textContent ?? '';
    expect(text()).not.toMatch(/server\/agents|agent\.md|agent\.ts|review-assistant|review-worker|agent-review-worker/);
    await user.type(input(), 'Show me the leaderboard{Enter}');
    await waitFor(() => expect(messagesOf('assistant')).toHaveLength(1));
    expect(text()).not.toMatch(/server\/agents|agent\.md|agent\.ts|review-assistant|review-worker|get_leaderboard|\{"period"/);
  });
});

describe('S3 assistant · populated', () => {
  it('role="log" holds user, tool and assistant messages with data-role', async () => {
    chat.turns.push({ reply: 'Jordan Lee leads with 412 votes.', events: [LEADERBOARD_TOOL] });
    const { container, user } = renderChat();
    expect(log()).toHaveAttribute('aria-live', 'polite');
    await user.type(input(), "Show me this week's leaderboard{Enter}");
    await waitFor(() => expect(messagesOf('assistant')).toHaveLength(1));
    const roles = within(log())
      .getAllByTestId('assistant-chat-message')
      .map((m) => m.getAttribute('data-role'));
    expect(roles).toEqual(['user', 'tool', 'assistant']);
    expect(messagesOf('tool')[0]).toHaveTextContent('Looked up: leaderboard (7 days)');
    expect(messagesOf('assistant')[0]).toHaveTextContent('Jordan Lee leads with 412 votes.');
    await expectNoAxeViolations(container);
  });

  it('Enter sends, Shift+Enter adds a new line, focus returns to the input', async () => {
    const { user } = renderChat();
    await user.click(input());
    await user.keyboard('First line{Shift>}{Enter}{/Shift}second line');
    expect(input()).toHaveValue('First line\nsecond line');
    expect(chat.sent).toEqual([]);
    await user.keyboard('{Enter}');
    expect(chat.sent).toEqual(['First line\nsecond line']);
    await waitFor(() => expect(messagesOf('assistant')).toHaveLength(1));
    expect(input()).toHaveValue('');
    await waitFor(() => expect(input()).toHaveFocus());
  });

  it('Send is disabled for an empty message and sends with a click', async () => {
    const { user } = renderChat();
    expect(sendButton()).toBeDisabled();
    await user.type(input(), '   ');
    expect(sendButton()).toBeDisabled();
    await user.type(input(), 'What is coverage?');
    await user.click(sendButton());
    expect(chat.sent).toEqual(['What is coverage?']);
  });

  it('the skill picker prefixes the /skill sugar', async () => {
    chat.config = {
      ...DEFAULT_CONFIG,
      skills: { 'review-assistant': [{ name: 'scoring', description: 'Explain confidence scoring' }] },
    };
    const { user } = renderChat();
    await user.type(input(), 'why 71%?');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Choose a skill' }), 'scoring');
    expect(input()).toHaveValue('/scoring why 71%?');
  });

  it('passes axe in light and dark', async () => {
    await renderInBothThemes(async (theme) => {
      chat.turns.push({ reply: 'Sure.', events: [LEADERBOARD_TOOL] });
      const { container, user } = renderChat({ theme });
      await user.type(input(), 'Hi{Enter}');
      await waitFor(() => expect(messagesOf('assistant')).toHaveLength(1));
      expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
      await expectNoAxeViolations(container);
    });
  });
});

describe('S3 assistant · streaming', () => {
  it('shows the typing indicator and disables the input while streaming', async () => {
    chat.turns.push({ reply: 'All done.', hold: true });
    const { container, user } = renderChat();
    await user.type(input(), 'Explain confidence{Enter}');
    expect(await screen.findByText('Assistant is typing')).toBeInTheDocument();
    const streaming = messagesOf('assistant')[0];
    expect(streaming).toHaveAttribute('data-streaming', 'true');
    expect(input()).toBeDisabled();
    expect(sendButton()).toBeDisabled();
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
    await act(async () => chat.release!());
    await waitFor(() => expect(input()).toBeEnabled());
    expect(messagesOf('assistant')[0]).toHaveTextContent('All done.');
    expect(screen.queryByText('Assistant is typing')).not.toBeInTheDocument();
    await waitFor(() => expect(input()).toHaveFocus());
  });
});

describe('S3 assistant · error', () => {
  it('shows an alert with Try again, which resends the last prompt', async () => {
    chat.turns.push({ error: 'Chat stream failed' }, { reply: 'Second time lucky.' });
    const { container, user } = renderChat();
    await user.type(input(), 'Coverage summary please{Enter}');
    const alert = await within(log()).findByRole('alert');
    expect(alert).toHaveTextContent("The assistant couldn't answer. Try again.");
    expect(alert).not.toHaveTextContent('Chat stream failed');
    expect(messagesOf('assistant')).toHaveLength(0);
    await expectNoAxeViolations(container);
    await user.click(screen.getByTestId('assistant-error-retry'));
    expect(chat.sent).toEqual(['Coverage summary please', 'Coverage summary please']);
    await waitFor(() => expect(messagesOf('assistant')).toHaveLength(1));
    expect(messagesOf('user')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('S3 assistant · no-agent', () => {
  it('explains the assistant is not set up and offers no input', async () => {
    chat.config = { agents: [], defaultAgent: null };
    const { container } = renderChat();
    const root = screen.getByTestId('assistant-no-agent-root');
    expect(within(root).getByRole('heading', { name: "The assistant isn't set up for this app yet." })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await expectNoAxeViolations(container);
  });
});

describe('S3 assistant · offline', () => {
  it('disables the input, Send and the starter prompts', async () => {
    const { container } = renderChat({ online: false });
    expect(input()).toBeDisabled();
    expect(sendButton()).toBeDisabled();
    for (const b of screen.getAllByTestId('assistant-starter-prompt')) expect(b).toBeDisabled();
    expect(screen.getByText(/You're offline\. Reconnect to message the assistant\./)).toBeInTheDocument();
    await expectNoAxeViolations(container);
    expect(chat.sent).toEqual([]);
  });
});
