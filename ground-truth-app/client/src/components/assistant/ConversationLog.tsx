// @a11y-strict
// client/src/components/assistant/ConversationLog.tsx — S3 conversation region
// Session 53 · Build 5 · wave 5-2 (screen_inventory S3, figma_make_brief S3).
// A role="log" (aria-live polite) named "Conversation". Empty: 3 starter
// prompt buttons that send on click. Messages carry data-role
// (user | assistant | tool); tool rows are one muted line with SparkleIcon.
// Streaming with no text yet shows a typing indicator. The error alert
// ("Try again") sits at the end of the log.

import type { RefObject } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import { cn } from '../../lib/utils';
import { Icon, InlineAlert } from '../ui';

export type ChatRole = 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

/** figma_make_brief S3 / screen_inventory S3 starter prompts, in order. */
export const STARTER_PROMPTS = [
  'Explain the confidence score for Readmission Rate (30-day)',
  "Show me this week's leaderboard",
  "What's our coverage summary?",
] as const;

export const GENIE_ICON_URL = '/brand/icons/genie-icon-full-color-container.svg';

export interface ConversationLogProps {
  messages: ChatMessage[];
  /** id of the assistant message being streamed, if any. */
  streamingId: string | null;
  error: boolean;
  /** Starter prompts and Try again are disabled (streaming or offline). */
  disabled: boolean;
  onStarter: (prompt: string) => void;
  onRetry: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

function GenieAvatar() {
  return <img src={GENIE_ICON_URL} alt="" className="h-7 w-7 shrink-0" />;
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="sr-only">Assistant is typing</span>
      {[0, 1, 2].map((i) => (
        <span key={i} aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
      ))}
    </span>
  );
}

export function ConversationLog({
  messages,
  streamingId,
  error,
  disabled,
  onStarter,
  onRetry,
  scrollRef,
}: ConversationLogProps) {
  // An assistant turn that ended with no text (error or empty reply) is not shown.
  const shown = messages.filter((m) => m.role !== 'assistant' || m.content !== '' || m.id === streamingId);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      tabIndex={0}
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {messages.length === 0 ? (
        <div className="m-auto flex max-w-md flex-col items-center gap-3 text-center">
          <GenieAvatar />
          <h2 className="text-lg font-bold">What would you like to know?</h2>
          <p className="text-sm text-muted-foreground">
            I can explain definitions, confidence, campaign progress and reviewer activity.
          </p>
          <div className="flex w-full flex-col gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                data-testid="assistant-starter-prompt"
                disabled={disabled}
                onClick={() => onStarter(prompt)}
                className="h-auto min-h-[44px] justify-start whitespace-normal text-left"
              >
                {prompt}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {shown.map((m) => {
        if (m.role === 'tool') {
          return (
            <div
              key={m.id}
              data-testid="assistant-chat-message"
              data-role="tool"
              className="flex items-center gap-1.5 pl-9 text-xs text-muted-foreground"
            >
              <Icon name="sparkle" size={14} />
              {m.content}
            </div>
          );
        }
        const isUser = m.role === 'user';
        const typing = m.id === streamingId && m.content === '';
        return (
          <div
            key={m.id}
            data-testid="assistant-chat-message"
            data-role={m.role}
            data-streaming={m.id === streamingId ? 'true' : undefined}
            className={cn('flex items-start gap-2', isUser ? 'justify-end' : 'justify-start')}
          >
            {isUser ? null : <GenieAvatar />}
            <div
              className={cn(
                'max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm',
                isUser ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground',
              )}
            >
              <span className="sr-only">{isUser ? 'You said: ' : 'Assistant: '}</span>
              {typing ? <TypingIndicator /> : m.content}
            </div>
          </div>
        );
      })}

      {error ? (
        <InlineAlert title="The assistant couldn't answer. Try again.">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="assistant-error-retry"
            disabled={disabled}
            onClick={onRetry}
            className="mt-1 min-h-[44px] gap-1.5"
          >
            <Icon name="refresh" size={16} />
            Try again
          </Button>
        </InlineAlert>
      ) : null}
    </div>
  );
}
