// client/src/components/ui/RadioCardGroup.tsx — single choice shown as cards
// Session 42 · Build 5 · wave 5-0 (reject reasons, share mode, campaign type).
// Native radio inputs inside a fieldset, so arrow keys move the selection, Tab
// enters / leaves the group, and the legend names it. The input is visually
// hidden; the card shows checked and focus-visible states. Selection is shown
// by a border plus a check icon, not color alone.

import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Icon, type IconName } from './Icon';

export interface RadioCardOption<V extends string = string> {
  value: V;
  label: string;
  description?: ReactNode;
  icon?: IconName;
  disabled?: boolean;
}

export interface RadioCardGroupProps<V extends string = string> {
  legend: string;
  options: RadioCardOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  /** Form field name (defaults to a generated id). */
  name?: string;
  disabled?: boolean;
  className?: string;
}

export function RadioCardGroup<V extends string = string>({
  legend,
  options,
  value,
  onChange,
  name,
  disabled = false,
  className,
}: RadioCardGroupProps<V>) {
  const generated = useId();
  const groupName = name ?? `radio-card-${generated}`;
  return (
    <fieldset className={cn('flex flex-col gap-2', className)} disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
      {options.map((option) => {
        const id = `${groupName}-${option.value}`;
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            htmlFor={id}
            data-checked={checked ? 'true' : 'false'}
            className={cn(
              'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 text-card-foreground',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              checked ? 'border-primary' : 'border-input',
              option.disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              id={id}
              type="radio"
              name={groupName}
              value={option.value}
              checked={checked}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon ? <Icon name={option.icon} size={20} className="mt-0.5" /> : null}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{option.label}</span>
              {option.description ? (
                <span className="text-sm text-muted-foreground">{option.description}</span>
              ) : null}
            </span>
            {checked ? <Icon name="check" size={16} className="mt-1 text-primary" /> : null}
          </label>
        );
      })}
    </fieldset>
  );
}
