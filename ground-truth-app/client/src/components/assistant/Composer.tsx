// @a11y-strict
// client/src/components/assistant/Composer.tsx — S3 message composer
// Session 53 · Build 5 · wave 5-2 (figma_make_brief S3). Optional skill
// select (prepends the `/skill` sugar useAgentChat parses), a multi-line
// input labelled "Message the assistant", and Send. Enter sends,
// Shift+Enter is a new line. Disabled while streaming and offline.

import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import { Icon } from '../ui';

export interface ComposerSkill {
  name: string;
  description: string;
}

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  offline: boolean;
  skills: ComposerSkill[];
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

/** Replace a leading `/skill ` token with `/name `, keeping the rest of the draft. */
export function withSkill(draft: string, name: string): string {
  return `/${name} ${draft.replace(/^\/\S+\s*/, '')}`;
}

export function Composer({ value, onChange, onSend, disabled, offline, skills, inputRef }: ComposerProps) {
  const blocked = disabled || offline;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSend();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border p-3">
      {offline ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Icon name="cloudOff" size={16} />
          You&apos;re offline. Reconnect to message the assistant.
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        {skills.length > 0 ? (
          <select
            aria-label="Choose a skill"
            className="min-h-[44px] shrink-0 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            value=""
            disabled={blocked}
            onChange={(e) => {
              const name = e.target.value;
              if (!name) return;
              onChange(withSkill(value, name));
              inputRef.current?.focus();
            }}
          >
            <option value="">+ Skill</option>
            {skills.map((s) => (
              <option key={s.name} value={s.name} title={s.description}>
                {s.name}
              </option>
            ))}
          </select>
        ) : null}
        <textarea
          ref={inputRef}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={blocked}
          aria-label="Message the assistant"
          placeholder="Ask a question…"
          data-testid="assistant-composer-input"
          className="min-h-[44px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <Button
          type="submit"
          data-testid="assistant-composer-send"
          disabled={blocked || !value.trim()}
          className="min-h-[44px] gap-1.5"
        >
          <Icon name="send" size={16} />
          Send
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Answers may be incomplete. Verify important definitions with a steward.
      </p>
    </form>
  );
}
