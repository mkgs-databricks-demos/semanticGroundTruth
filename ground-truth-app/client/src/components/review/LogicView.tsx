// client/src/components/review/LogicView.tsx — plain English + SQL/YAML definition tabs
// Session 17 · Wave 1 · DM Mono for definitions, aria-expanded disclosure

import { useCallback, useState } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import { ChevronDown, ChevronUp, Copy, CheckCheck } from 'lucide-react';
import type { Asset } from '../../../../shared/contracts';

interface LogicViewProps {
  asset: Asset;
}

type Tab = 'plain' | 'definition';

export function LogicView({ asset }: LogicViewProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('plain');
  const [copied, setCopied] = useState(false);

  const hasDefinition = Boolean(asset.yamlContent);
  const hasPlainEnglish = Boolean(asset.plainEnglishLogic || asset.description || asset.synonyms?.length);

  // Nothing to show
  if (!hasPlainEnglish && !hasDefinition) return null;

  const definitionText = asset.yamlContent ?? '';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(definitionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [definitionText]);

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-xs"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? 'Hide logic' : 'Show logic'}
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? 'Hide logic' : 'Show logic'}
      </Button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Tab bar — only when both tabs have content */}
          {hasPlainEnglish && hasDefinition && (
            <div className="flex gap-1" role="tablist" aria-label="Logic view">
              <button
                role="tab"
                aria-selected={tab === 'plain'}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  tab === 'plain'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTab('plain')}
              >
                Plain English
              </button>
              <button
                role="tab"
                aria-selected={tab === 'definition'}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  tab === 'definition'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTab('definition')}
              >
                Definition
              </button>
            </div>
          )}

          {/* Plain English tab */}
          {(tab === 'plain' || !hasDefinition) && hasPlainEnglish && (
            <div role="tabpanel" className="space-y-2 text-sm">
              {asset.plainEnglishLogic && (
                <p>{asset.plainEnglishLogic}</p>
              )}
              {asset.description && asset.description !== asset.plainEnglishLogic && (
                <p className="text-muted-foreground">{asset.description}</p>
              )}
              {asset.synonyms && asset.synonyms.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Synonyms:</span>{' '}
                  {asset.synonyms.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Definition tab */}
          {tab === 'definition' && hasDefinition && (
            <div role="tabpanel" className="relative">
              <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto max-h-48">
                {definitionText}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy definition'}
              >
                {copied
                  ? <CheckCheck className="h-3 w-3 text-[var(--success)]" />
                  : <Copy className="h-3 w-3" />
                }
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}