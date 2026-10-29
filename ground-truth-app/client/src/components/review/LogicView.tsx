// @a11y-strict
// client/src/components/review/LogicView.tsx — "Logic" disclosure: plain-English logic, then YAML
// Session 17 · Wave 1 · DM Mono for definitions, aria-expanded disclosure
// Session 51 · Build 5 · wave 5-2 · controlled by the page (L shortcut), nested YAML disclosure with
// copy button (brief S1), Databricks icons, test id review-card-logic-toggle.

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import type { Asset } from '../../../../shared/contracts';
import { Icon } from '../ui';

interface LogicViewProps {
  asset: Asset;
  open: boolean;
  onToggle: () => void;
}

export function LogicView({ asset, open, onToggle }: LogicViewProps) {
  const panelId = useId();
  const yamlId = useId();
  const [yamlOpen, setYamlOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  useEffect(() => {
    if (!open) setYamlOpen(false);
  }, [open]);

  const yaml = asset.yamlContent ?? '';

  const copyYaml = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context): the YAML stays selectable.
    }
  };

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-2">
      <button
        type="button"
        data-testid="review-card-logic-toggle"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? 'Hide logic' : 'Show logic'}
        onClick={onToggle}
        className="flex min-h-[44px] w-full items-center justify-between rounded-md text-sm font-bold focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span>Logic</span>
        <Icon name={open ? 'arrowUp' : 'arrowDown'} size={16} />
      </button>
      {open ? (
        <div id={panelId} className="flex flex-col gap-2 text-sm">
          {asset.plainEnglishLogic ? (
            <p>{asset.plainEnglishLogic}</p>
          ) : (
            <p className="text-muted-foreground">No plain-English logic yet.</p>
          )}
          {yaml ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={yamlOpen}
                aria-controls={yamlOpen ? yamlId : undefined}
                onClick={() => setYamlOpen((v) => !v)}
                className="flex min-h-[44px] items-center justify-between rounded-md text-xs font-bold text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span>YAML definition</span>
                <Icon name={yamlOpen ? 'arrowUp' : 'arrowDown'} size={14} />
              </button>
              {yamlOpen ? (
                <div id={yamlId} className="relative">
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 pr-12 font-mono text-xs" role="region" tabIndex={0} aria-label="YAML definition">
                    <code>{yaml}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 min-h-[44px] min-w-[44px]"
                    onClick={() => void copyYaml()}
                    aria-label={copied ? 'Copied' : 'Copy YAML'}
                  >
                    <Icon name={copied ? 'check' : 'copy'} size={16} />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
