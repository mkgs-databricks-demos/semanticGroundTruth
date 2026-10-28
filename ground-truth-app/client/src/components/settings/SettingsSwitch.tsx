// @a11y-strict
// client/src/components/settings/SettingsSwitch.tsx — on/off switch (role="switch")
// Session 52 · Build 5 · wave 5-2 (S7 keyboard hints, notification channels)
//
// A <button role="switch" aria-checked>: Space / Enter toggle it. `label` is
// the accessible name; with `hideLabel` it is not shown (table cells, where
// the column header carries the visible text). State is shown by the thumb
// position and an "On" / "Off" text, not color alone.

import { cn } from '../../lib/utils';

export interface SettingsSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  description?: string;
  testId?: string;
}

export function SettingsSwitch({
  label,
  checked,
  onChange,
  disabled = false,
  hideLabel = false,
  description,
  testId,
}: SettingsSwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-block h-6 w-11 rounded-full border transition-colors',
          checked ? 'border-primary bg-primary' : 'border-input bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform',
            checked ? 'left-0.5 translate-x-5' : 'left-0.5',
          )}
        />
      </span>
      <span aria-hidden="true" className="w-7 text-left text-xs text-muted-foreground">
        {checked ? 'On' : 'Off'}
      </span>
    </button>
  );

  if (hideLabel) return control;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span aria-hidden="true" className="text-sm font-medium text-foreground">
          {label}
        </span>
        {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      </div>
      {control}
    </div>
  );
}
