// @a11y-strict
// client/src/components/settings/SegmentedControl.tsx — single choice as a segmented radiogroup
// Session 52 · Build 5 · wave 5-2 (S7 Theme / Density / Motion; KB K5)
//
// WAI-ARIA radio group pattern: one tab stop (the checked option), arrow keys
// move the selection and focus together (wrapping), Home / End jump to the
// ends. Selection is shown by fill plus a check icon, not color alone.

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/Icon';

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
  /** data-testid of the option button (ui_test_strategy.md §3). */
  testId: string;
}

export interface SegmentedControlProps<V extends string> {
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  disabled?: boolean;
  /** Helper text under the control (linked with aria-describedby). */
  description?: ReactNode;
}

const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];
const PREV_KEYS = ['ArrowLeft', 'ArrowUp'];

export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  description,
}: SegmentedControlProps<V>) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = description ? `${id}-description` : undefined;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (option.value !== value) onChange(option.value);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const n = options.length;
    if (NEXT_KEYS.includes(event.key)) select((index + 1) % n);
    else if (PREV_KEYS.includes(event.key)) select((index + n - 1) % n);
    else if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(n - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-foreground">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        aria-disabled={disabled || undefined}
        className="inline-flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-muted p-1"
      >
        {options.map((option, index) => {
          const checked = index === checkedIndex;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              data-testid={option.testId}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm font-medium',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'disabled:cursor-not-allowed disabled:opacity-60',
                checked
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.icon}
              <span>{option.label}</span>
              {checked ? <Icon name="check" size={16} className="text-primary" /> : null}
            </button>
          );
        })}
      </div>
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
