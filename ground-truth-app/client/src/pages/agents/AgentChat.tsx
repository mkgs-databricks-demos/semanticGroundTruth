// @a11y-strict
// client/src/pages/agents/AgentChat.tsx — S3 Assistant (route /assistant)
// Session 53 · Build 5 · wave 5-2 (screen_inventory S3 + F10,
// figma_make_brief S3, ui_test_strategy §8 S3 rows). Reviewer-facing copy
// (no file paths or agent ids). States: empty (3 starter prompts that send
// on click), populated, streaming (typing indicator, input disabled; the
// hook has no Stop, so there is no Stop button), error (alert + Try again),
// no-agent, offline (input disabled). Enter sends, Shift+Enter new line,
// focus returns to the input when the reply ends.
//
// The app's coordinator agent (review-assistant) delegates data lookups to
// its review-worker sub-agent; both arrive here as tool-call events and
// render as one plain-language activity line (components/assistant/toolActivity.ts).
// Agent chat traces are recorded server-side (session 45).

import { useEffect, useRef, useState } from 'react';
import { Composer } from '../../components/assistant/Composer';
import { ConversationLog, GENIE_ICON_URL, type ChatMessage } from '../../components/assistant/ConversationLog';
import {
  AGENTS_PLUGIN,
  useAgentChat,
  usePluginClientConfig,
  type AgentChatEvent,
  type AgentsClientConfig,
} from '../../components/assistant/agentClient';
import { toolActivityLabel } from '../../components/assistant/toolActivity';
import { EmptyPanel } from '../../components/ui';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

let nextId = 0;
const newId = (prefix: string) => `${prefix}-${Date.now()}-${(nextId += 1)}`;

function PageHeading() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <img src={GENIE_ICON_URL} alt="" className="h-8 w-8" />
        <h1 className="text-2xl font-bold">Assistant</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Ask about any asset, its confidence score, campaigns or the leaderboard. Answers are read-only.
      </p>
    </div>
  );
}

export function AgentChat() {
  const config = usePluginClientConfig<AgentsClientConfig>(AGENTS_PLUGIN);
  const activeAgent = config?.defaultAgent ?? config?.agents?.[0] ?? null;
  const activeSkills = (activeAgent && config?.skills?.[activeAgent]) || [];
  const online = useOnlineStatus();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const lastPromptRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // The streaming bubble's id for the event handler (state is stale inside the stream).
  const pendingIdRef = useRef<string | null>(null);
  pendingIdRef.current = pendingId;

  const handleEvent = (event: AgentChatEvent) => {
    if (event.type === 'response.output_item.added' && event.item?.type === 'function_call' && event.item.name) {
      const label = toolActivityLabel(event.item.name, event.item.arguments);
      setMessages((prev) => {
        // The tool row goes before the assistant bubble being streamed.
        const at = prev.findIndex((m) => m.id === pendingIdRef.current);
        const row: ChatMessage = { id: newId('t'), role: 'tool', content: label };
        return at < 0 ? [...prev, row] : [...prev.slice(0, at), row, ...prev.slice(at)];
      });
    }
  };

  const { content, isStreaming, error, send } = useAgentChat({
    agent: activeAgent ?? '',
    onEvent: handleEvent,
    // Gate `/skill` sugar on the real catalog so a stray `/word` isn't parsed as a skill.
    skills: activeSkills.map((s) => s.name),
  });

  // Mirror the streamed text into the latest assistant bubble. Keyed on a ref,
  // not on pendingId: the last delta and the end of the stream can land in the
  // same render as pendingId -> null, and that text must not be lost. `send`
  // resets `content` in the same batch that starts a new bubble.
  const replyIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = replyIdRef.current;
    if (!id) return;
    setMessages((prev) => prev.map((m) => (m.id === id && m.content !== content ? { ...m, content } : m)));
  }, [content, pendingId]);

  // Keep the newest line in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight });
  }, [messages]);

  const busy = isStreaming || pendingId !== null;

  // Focus returns to the input when a reply ends (the input is disabled while busy).
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) inputRef.current?.focus();
    wasBusy.current = busy;
  }, [busy]);

  const run = async (prompt: string, addUserMessage: boolean) => {
    const assistantId = newId('a');
    lastPromptRef.current = prompt;
    setMessages((prev) => [
      ...prev,
      ...(addUserMessage ? [{ id: newId('u'), role: 'user' as const, content: prompt }] : []),
      { id: assistantId, role: 'assistant' as const, content: '' },
    ]);
    setPendingId(assistantId);
    pendingIdRef.current = assistantId;
    replyIdRef.current = assistantId;
    try {
      await send(prompt);
    } finally {
      setPendingId(null);
      pendingIdRef.current = null;
    }
  };

  const submit = (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy || !online || !activeAgent) return;
    setInput('');
    void run(prompt, true);
  };

  const retry = () => {
    const prompt = lastPromptRef.current;
    if (!prompt || busy || !online || !activeAgent) return;
    void run(prompt, false);
  };

  if (!activeAgent) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeading />
        <div data-testid="assistant-no-agent-root">
          <EmptyPanel
            illustration="chat"
            title="The assistant isn't set up for this app yet."
            description="Ask an admin to connect an assistant before starting a conversation."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeading />
      <section
        aria-label="Chat with the assistant"
        data-testid="assistant-chat-root"
        className="flex h-[70vh] min-h-[420px] flex-col rounded-xl border border-border bg-card text-card-foreground"
      >
        <ConversationLog
          messages={messages}
          streamingId={isStreaming || pendingId ? pendingId : null}
          error={Boolean(error) && !busy}
          disabled={busy || !online}
          onStarter={submit}
          onRetry={retry}
          scrollRef={scrollRef}
        />
        <Composer
          value={input}
          onChange={setInput}
          onSend={() => submit(input)}
          disabled={busy}
          offline={!online}
          skills={activeSkills}
          inputRef={inputRef}
        />
      </section>
    </div>
  );
}
