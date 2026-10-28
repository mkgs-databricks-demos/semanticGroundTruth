// @a11y-strict
// client/src/components/steward/CreateCampaignSheet.tsx — create campaign form in a sheet
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2 (S4): ui/Sheet (named dialog, focus trap,
// Escape), InlineAlert for create errors.

import { useState } from 'react';
import { Button, Input, Textarea } from '@databricks/appkit-ui/react';
import type { CampaignType, CompletionRule } from '../../../../shared/contracts';
import { useCreateCampaign } from '../../lib/api';
import { InlineAlert } from '../ui';
import { Sheet } from '../ui/Sheet';

const CAMPAIGN_TYPE_OPTIONS: { value: CampaignType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'freshness', label: 'Freshness' },
];

const COMPLETION_RULE_OPTIONS: { value: CompletionRule; label: string }[] = [
  { value: 'reviewed_once', label: 'Reviewed once' },
  { value: 'certified', label: 'Certified' },
];

export function CreateCampaignSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateCampaign();

  const [name, setName] = useState('');
  const [campaignType, setCampaignType] = useState<CampaignType>('manual');
  const [scopeDomain, setScopeDomain] = useState('');
  const [scopeSubdomain, setScopeSubdomain] = useState('');
  const [scopeAssetType, setScopeAssetType] = useState('');
  const [rbacGroups, setRbacGroups] = useState('');
  const [freshnessIntervalDays, setFreshnessIntervalDays] = useState('');
  const [completionRule, setCompletionRule] = useState<CompletionRule>('reviewed_once');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name,
        campaignType,
        scopeDomain: scopeDomain || undefined,
        scopeSubdomain: scopeSubdomain || undefined,
        scopeAssetType: (scopeAssetType || undefined) as Parameters<typeof create.mutate>[0]['scopeAssetType'],
        rbacGroups: rbacGroups ? rbacGroups.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        freshnessIntervalDays: freshnessIntervalDays ? Number(freshnessIntervalDays) : undefined,
        completionRule,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      },
    );
  }

  function resetForm() {
    setName('');
    setCampaignType('manual');
    setScopeDomain('');
    setScopeSubdomain('');
    setScopeAssetType('');
    setRbacGroups('');
    setFreshnessIntervalDays('');
    setCompletionRule('reviewed_once');
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="New campaign"
      description="Group assets for reviewers to work through."
    >
        <form onSubmit={handleSubmit} className="space-y-4 pb-4">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field label="Type">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={campaignType}
              onChange={(e) => setCampaignType(e.target.value as CampaignType)}
            >
              {CAMPAIGN_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Scope — Domain">
            <Input
              value={scopeDomain}
              onChange={(e) => setScopeDomain(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field label="Scope — Subdomain">
            <Input
              value={scopeSubdomain}
              onChange={(e) => setScopeSubdomain(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field label="Scope — Asset Type">
            <Input
              value={scopeAssetType}
              onChange={(e) => setScopeAssetType(e.target.value)}
              placeholder="measure, dimension, page…"
            />
          </Field>

          <Field label="RBAC Groups (comma-separated)">
            <Textarea
              value={rbacGroups}
              onChange={(e) => setRbacGroups(e.target.value)}
              placeholder="group-a, group-b"
              rows={2}
            />
          </Field>

          {campaignType === 'freshness' && (
            <Field label="Freshness Interval (days)">
              <Input
                type="number"
                min={1}
                value={freshnessIntervalDays}
                onChange={(e) => setFreshnessIntervalDays(e.target.value)}
                placeholder="180"
              />
            </Field>
          )}

          <Field label="Completion Rule">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={completionRule}
              onChange={(e) => setCompletionRule(e.target.value as CompletionRule)}
            >
              {COMPLETION_RULE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          {create.isError ? (
            <InlineAlert title="Couldn't create the campaign">{create.error.message}</InlineAlert>
          ) : null}

          <Button type="submit" className="min-h-[44px]" disabled={!name || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create campaign'}
          </Button>
        </form>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
