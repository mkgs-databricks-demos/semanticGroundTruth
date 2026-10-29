// client/src/components/ui/ui-primitives.test.tsx — build-5 UI primitives
// Session 42 · Build 5 · wave 5-0. Each primitive renders in light and dark
// (`.dark` wrapper), passes axe, and interactive ones are driven by keyboard.

import { useState, type ReactElement } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import {
  Badge,
  DiffText,
  EmptyPanel,
  Icon,
  InlineAlert,
  KeyHint,
  RadioCardGroup,
  Sheet,
  SkeletonGroup,
  STATUS_SPEC,
  StatusBadge,
  ToastRegion,
  diffWords,
  useToasts,
  type Status,
} from './index';

const MODES = ['light', 'dark'] as const;

function renderIn(mode: (typeof MODES)[number], ui: ReactElement) {
  return render(
    <div className={mode === 'dark' ? 'dark' : undefined} data-testid="mode-root">
      <main>{ui}</main>
    </div>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe.each(MODES)('UI primitives (%s mode)', (mode) => {
  describe('Icon', () => {
    it('is decorative without a label and uses the brand mask', async () => {
      const { container } = renderIn(mode, <Icon name="check" />);
      const icon = container.querySelector('[data-icon="check"]') as HTMLElement;
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveClass('brand-icon');
      expect(icon.style.maskImage || icon.style.getPropertyValue('mask-image')).toContain('/brand/icons/checkIcon.svg');
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has role img and a name with a label', async () => {
      const { container } = renderIn(mode, <Icon name="warning" label="Warning" size={20} />);
      const icon = screen.getByRole('img', { name: 'Warning' });
      expect(icon).not.toHaveAttribute('aria-hidden');
      expect(icon.style.width).toBe('20px');
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Badge', () => {
    it('renders every tone with its text', async () => {
      const { container } = renderIn(
        mode,
        <p>
          {(['default', 'outline', 'info', 'success', 'warning', 'danger'] as const).map((tone) => (
            <Badge key={tone} tone={tone}>{tone}</Badge>
          ))}
        </p>,
      );
      expect(screen.getByText('warning')).toHaveAttribute('data-tone', 'warning');
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('StatusBadge', () => {
    it('shows text and an icon for every status (never color only)', async () => {
      const statuses = Object.keys(STATUS_SPEC) as Status[];
      const { container } = renderIn(mode, <p>{statuses.map((s) => <StatusBadge key={s} status={s} />)}</p>);
      for (const s of statuses) {
        const badge = container.querySelector(`[data-status="${s}"]`) as HTMLElement;
        expect(badge).toHaveTextContent(STATUS_SPEC[s].label);
        expect(badge.querySelector(`[data-icon="${STATUS_SPEC[s].icon}"]`)).not.toBeNull();
      }
      expect(await axe(container)).toHaveNoViolations();
    });

    it('accepts a custom label', () => {
      renderIn(mode, <StatusBadge status="merged" label="Merged to main" />);
      expect(screen.getByText('Merged to main')).toBeInTheDocument();
    });
  });

  describe('SkeletonGroup', () => {
    it('announces one loading label and hides the blocks', async () => {
      const { container } = renderIn(mode, <SkeletonGroup label="Loading review queue" lines={4} />);
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Loading review queue');
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(container.querySelectorAll('[data-slot="skeleton"][aria-hidden="true"]')).toHaveLength(4);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('InlineAlert', () => {
    it('is an alert and Retry works from the keyboard', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const { container } = renderIn(
        mode,
        <InlineAlert title="Could not load the queue" onRetry={onRetry}>
          The server did not answer.
        </InlineAlert>,
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Could not load the queue');
      expect(await axe(container)).toHaveNoViolations();

      await user.tab();
      const retry = within(alert).getByRole('button', { name: 'Retry' });
      expect(retry).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('has no Retry button without onRetry and disables it while retrying', () => {
      const { rerender } = renderIn(mode, <InlineAlert title="Forbidden" variant="forbidden" />);
      expect(screen.queryByRole('button')).toBeNull();
      rerender(
        <main>
          <InlineAlert title="Offline" variant="offline" onRetry={() => {}} retrying />
        </main>,
      );
      expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
    });
  });

  describe('EmptyPanel', () => {
    it('renders a heading, the navy + white illustration and the action', async () => {
      const { container } = renderIn(
        mode,
        <EmptyPanel
          title="Nothing to review"
          description="New definitions appear here."
          illustration="data-quality-3"
          action={<button type="button">Refresh</button>}
        />,
      );
      expect(screen.getByRole('heading', { level: 2, name: 'Nothing to review' })).toBeInTheDocument();
      const srcs = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
      expect(srcs).toEqual([
        '/brand/icons/primary-icon-navy-data-quality-3.svg',
        '/brand/icons/primary-icon-white-data-quality-3.svg',
      ]);
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('ToastRegion', () => {
    function Harness() {
      const { toasts, push, dismiss } = useToasts(1000);
      return (
        <>
          <button type="button" onClick={() => push({ title: 'Vote saved', tone: 'success' })}>
            Save
          </button>
          <ToastRegion toasts={toasts} onDismiss={dismiss} />
        </>
      );
    }

    it('is an always-mounted status region; toasts dismiss by keyboard', async () => {
      const user = userEvent.setup();
      const { container } = renderIn(mode, <Harness />);
      const region = screen.getByRole('status', { name: 'Notifications' });
      expect(region).toBeEmptyDOMElement();

      await user.tab();
      await user.keyboard('{Enter}');
      expect(region).toHaveTextContent('Vote saved');
      expect(await axe(container)).toHaveNoViolations();

      await user.tab();
      expect(screen.getByRole('button', { name: 'Dismiss: Vote saved' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(region).toBeEmptyDOMElement();
    });

    it('auto-dismisses after the duration', () => {
      vi.useFakeTimers();
      renderIn(mode, <Harness />);
      act(() => {
        screen.getByRole('button', { name: 'Save' }).click();
      });
      expect(screen.getByRole('status')).toHaveTextContent('Vote saved');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });
  });

  describe('Sheet', () => {
    function Harness({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
      const [open, setOpen] = useState(true);
      return (
        <Sheet
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
          title="Edit definition"
          description="Suggest a clearer description."
          footer={<button type="button">Submit edit</button>}
        >
          <label>
            Description
            <textarea />
          </label>
        </Sheet>
      );
    }

    it('is a named dialog and closes on Escape', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const { baseElement } = renderIn(mode, <Harness onOpenChange={onOpenChange} />);
      const dialog = screen.getByRole('dialog', { name: 'Edit definition' });
      expect(dialog).toHaveAccessibleDescription('Suggest a clearer description.');
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(await axe(baseElement)).toHaveNoViolations();

      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('RadioCardGroup', () => {
    const options = [
      { value: 'unclear', label: 'Unclear description', icon: 'info' as const },
      { value: 'wrong', label: 'Wrong logic', description: 'The SQL does not match.' },
      { value: 'duplicate', label: 'Duplicate' },
    ];

    function Harness({ onChange }: { onChange: (v: string) => void }) {
      const [value, setValue] = useState<string | null>(null);
      return (
        <RadioCardGroup
          legend="Reject reason"
          options={options}
          value={value}
          onChange={(v) => {
            onChange(v);
            setValue(v);
          }}
        />
      );
    }

    it('is a labelled group of radios driven by arrow keys', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = renderIn(mode, <Harness onChange={onChange} />);
      expect(screen.getByRole('group', { name: 'Reject reason' })).toBeInTheDocument();
      expect(screen.getAllByRole('radio')).toHaveLength(3);
      expect(await axe(container)).toHaveNoViolations();

      await user.tab();
      const first = screen.getByRole('radio', { name: 'Unclear description' });
      expect(first).toHaveFocus();
      await user.keyboard(' ');
      expect(first).toBeChecked();
      await user.keyboard('{ArrowDown}');
      const second = screen.getByRole('radio', { name: /Wrong logic/ });
      expect(second).toBeChecked();
      expect(onChange).toHaveBeenLastCalledWith('wrong');
      expect(container.querySelector('label[data-checked="true"] [data-icon="check"]')).not.toBeNull();
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('DiffText', () => {
    it('marks insertions with <ins> and deletions with <del>', async () => {
      const { container } = renderIn(
        mode,
        <DiffText before="Total revenue per month" after="Total net revenue per quarter" />,
      );
      const ins = Array.from(container.querySelectorAll('ins')).map((n) => n.textContent);
      const del = Array.from(container.querySelectorAll('del')).map((n) => n.textContent);
      expect(ins.join('|')).toContain('net');
      expect(ins.join('|')).toContain('quarter');
      expect(del.join('|')).toContain('month');
      expect(container.querySelector('ins')).toHaveTextContent('[inserted:');
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('KeyHint', () => {
    it('renders <kbd> keys with spoken names for arrows', async () => {
      const { container } = renderIn(mode, <p>Approve <KeyHint keys={['→']} /> or <KeyHint keys={['Shift', '?']} /></p>);
      const kbds = container.querySelectorAll('kbd');
      expect(kbds).toHaveLength(3);
      expect(kbds[0]).toHaveTextContent('Right arrow');
      expect(kbds[0].querySelector('[aria-hidden="true"]')).toHaveTextContent('→');
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe('diffWords', () => {
  it('returns one same part for equal text', () => {
    expect(diffWords('a b', 'a b')).toEqual([{ type: 'same', text: 'a b' }]);
  });

  it('finds a replaced word', () => {
    expect(diffWords('per month', 'per quarter')).toEqual([
      { type: 'same', text: 'per ' },
      { type: 'del', text: 'month' },
      { type: 'ins', text: 'quarter' },
    ]);
  });

  it('handles empty before / after', () => {
    expect(diffWords('', 'new text')).toEqual([{ type: 'ins', text: 'new text' }]);
    expect(diffWords('old', '')).toEqual([{ type: 'del', text: 'old' }]);
  });
});
