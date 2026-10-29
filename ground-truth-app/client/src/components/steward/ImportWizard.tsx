// @a11y-strict
// client/src/components/steward/ImportWizard.tsx — multi-step import-from-assets wizard
// Session 10 · Wave 1 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2 (S4): ui/Sheet ("Import assets"), ordered
// stepper with aria-current="step", Databricks icons instead of lucide,
// role="status" for scan / import progress, InlineAlert for errors, a
// labelled skipped-items list for partial failures, writes disabled offline.

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  Badge,
} from '@databricks/appkit-ui/react';
import { Icon, InlineAlert } from '../ui';
import { Sheet } from '../ui/Sheet';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import type {
  CatalogMetricViewsQuery,
  CatalogSchemasQuery,
  ImportAssetsBody,
  ImportAssetsResponse,
  RegisterSourceBody,
  ScanGlossaryTerm,
  ScanMetricViewFile,
} from '../../../../shared/contracts';
import type { MetricViewSummary } from '../../../../shared/contracts';
import {
  useCatalogs,
  useCatalogSchemas,
  useCatalogMetricViews,
  useSources,
  useRegisterSource,
  useScanSource,
  useImportAssets,
  useCreateCampaign,
} from '../../lib/api/hooks';
import type { ApiError } from '../../lib/api/http';

// ── Step indices ────────────────────────────────────────────────────────

const STEP_METRIC_VIEWS = 0;
const STEP_SOURCE = 1;
const STEP_GLOSSARY = 2;
const STEP_IMPORT = 3;
const STEP_CAMPAIGN = 4;

const STEP_LABELS = [
  'Metric Views',
  'Git Source',
  'Glossary Terms',
  'Import',
  'Campaign',
] as const;

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportWizard({ open, onOpenChange }: ImportWizardProps) {
  const online = useOnlineStatus();
  const [step, setStep] = useState(STEP_METRIC_VIEWS);

  // Step 1: metric view selection
  const [catalog, setCatalog] = useState('');
  const [schema, setSchema] = useState('');
  const [selectedViews, setSelectedViews] = useState<string[]>([]);

  // Step 2: source
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [newSourcePath, setNewSourcePath] = useState('');
  const [showNewSource, setShowNewSource] = useState(false);
  const [scannedMvFiles, setScannedMvFiles] = useState<ScanMetricViewFile[]>([]);
  const [scannedTerms, setScannedTerms] = useState<ScanGlossaryTerm[]>([]);

  // Step 3: glossary selection
  const [selectedTerms, setSelectedTerms] = useState<ScanGlossaryTerm[]>([]);

  // Step 4: import result
  const [importResult, setImportResult] = useState<ImportAssetsResponse | null>(null);

  // Step 5: campaign
  const [campaignName, setCampaignName] = useState('');

  // ── Queries ─────────────────────────────────────────────────────────

  const catalogsQ = useCatalogs();
  const schemasQ = useCatalogSchemas(
    { catalog } as CatalogSchemasQuery,
  );
  const viewsQ = useCatalogMetricViews(
    { catalog, schema } as CatalogMetricViewsQuery,
  );
  const sourcesQ = useSources();
  const registerSourceM = useRegisterSource();
  const scanSourceM = useScanSource();
  const importM = useImportAssets();
  const createCampaignM = useCreateCampaign();

  // ── Handlers ────────────────────────────────────────────────────────

  function toggleView(fqn: string) {
    setSelectedViews((prev) =>
      prev.includes(fqn) ? prev.filter((v) => v !== fqn) : [...prev, fqn],
    );
  }

  function toggleTerm(term: ScanGlossaryTerm) {
    setSelectedTerms((prev) => {
      const key = `${term.filePath}:${term.term}`;
      const exists = prev.some((t) => `${t.filePath}:${t.term}` === key);
      return exists
        ? prev.filter((t) => `${t.filePath}:${t.term}` !== key)
        : [...prev, term];
    });
  }

  async function handleRegisterSource() {
    if (!newSourcePath.trim()) return;
    const body: RegisterSourceBody = { workspacePath: newSourcePath.trim() };
    // Mutation errors surface through `wizardError`; swallow the rejection so
    // the `void` call sites do not raise an unhandled promise rejection.
    const source = await registerSourceM.mutateAsync(body).catch(() => null);
    if (!source) return;
    setSourceId(source.id);
    setShowNewSource(false);
    setNewSourcePath('');
    await handleScan(source.id);
  }

  async function handleScan(sid: string) {
    const result = await scanSourceM.mutateAsync(sid).catch(() => null);
    if (!result) return;
    setScannedMvFiles(result.metricViewFiles);
    setScannedTerms(result.glossaryTerms);
  }

  async function handleSelectExistingSource(sid: string) {
    setSourceId(sid);
    await handleScan(sid);
  }

  async function handleImport() {
    const body: ImportAssetsBody = {};
    if (selectedViews.length > 0) {
      body.metricViews = selectedViews;
    }
    if (sourceId) {
      body.sourceId = sourceId;
    }
    if (selectedTerms.length > 0 && sourceId) {
      body.glossaryTerms = selectedTerms.map((t) => ({
        sourceId: sourceId!,
        filePath: t.filePath,
        term: t.term,
      }));
    }
    const result = await importM.mutateAsync(body).catch(() => null);
    if (!result) return;
    setImportResult(result);
    setStep(STEP_CAMPAIGN);
  }

  async function handleCreateCampaign() {
    if (!campaignName.trim() || !importResult) return;
    const assetIds = [...importResult.created, ...importResult.updated];
    const created = await createCampaignM
      .mutateAsync({
        name: campaignName.trim(),
        campaignType: 'manual',
        scopeAssetIds: assetIds,
      })
      .catch(() => null);
    if (!created) return;
    handleClose();
  }

  function handleClose() {
    setStep(STEP_METRIC_VIEWS);
    setCatalog('');
    setSchema('');
    setSelectedViews([]);
    setSourceId(null);
    setNewSourcePath('');
    setShowNewSource(false);
    setScannedMvFiles([]);
    setScannedTerms([]);
    setSelectedTerms([]);
    setImportResult(null);
    setCampaignName('');
    onOpenChange(false);
  }

  const canGoNext = () => {
    if (step === STEP_METRIC_VIEWS) return selectedViews.length > 0;
    if (step === STEP_SOURCE) return true; // optional
    if (step === STEP_GLOSSARY) return true; // optional
    if (step === STEP_IMPORT) return true;
    return false;
  };

  const handleNext = () => {
    if (step === STEP_GLOSSARY) {
      void handleImport();
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_CAMPAIGN));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  // ── Render ──────────────────────────────────────────────────────────

  const wizardError = importM.error ?? registerSourceM.error ?? scanSourceM.error ?? createCampaignM.error;

  return (
    <Sheet
      open={open}
      onOpenChange={handleClose}
      title="Import assets"
      description={`Step ${step + 1} of ${STEP_LABELS.length}: ${STEP_LABELS[step]}`}
      className="w-full sm:max-w-xl"
      footer={
        step < STEP_CAMPAIGN && step !== STEP_IMPORT ? (
          <div className="flex justify-between gap-2">
            <Button variant="ghost" className="min-h-[44px] gap-1.5" onClick={handleBack} disabled={step === STEP_METRIC_VIEWS}>
              <Icon name="arrowUp" className="-rotate-90" />
              Back
            </Button>
            {step === STEP_GLOSSARY ? (
              <Button
                className="min-h-[44px]"
                onClick={handleNext}
                disabled={!online || !canGoNext() || importM.isPending}
                data-testid="steward-import-submit"
              >
                Import
              </Button>
            ) : (
              <Button
                className="min-h-[44px] gap-1.5"
                onClick={handleNext}
                disabled={!canGoNext() || importM.isPending}
                data-testid="steward-import-next"
              >
                Next
                <Icon name="arrowUp" className="rotate-90" />
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
        {/* Step indicator */}
        <ol aria-label="Import steps" className="my-2 flex flex-wrap items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={`flex items-center gap-1 text-xs ${
                i === step ? 'font-bold text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
              {label}
              {i < step ? <span className="sr-only"> (done)</span> : null}
            </li>
          ))}
        </ol>

        {/* Step content */}
        <div className="space-y-4 mt-4">
          {step === STEP_METRIC_VIEWS && (
            <StepMetricViews
              catalogsQ={catalogsQ}
              schemasQ={schemasQ}
              viewsQ={viewsQ}
              catalog={catalog}
              schema={schema}
              selectedViews={selectedViews}
              onCatalogChange={(c) => { setCatalog(c); setSchema(''); setSelectedViews([]); }}
              onSchemaChange={(s) => { setSchema(s); setSelectedViews([]); }}
              onToggleView={toggleView}
            />
          )}

          {step === STEP_SOURCE && (
            <StepSource
              sourcesQ={sourcesQ}
              sourceId={sourceId}
              showNewSource={showNewSource}
              newSourcePath={newSourcePath}
              scannedMvFiles={scannedMvFiles}
              isRegistering={registerSourceM.isPending}
              isScanning={scanSourceM.isPending}
              onShowNew={() => setShowNewSource(true)}
              onNewSourcePathChange={setNewSourcePath}
              onRegister={() => void handleRegisterSource()}
              onSelectExisting={(sid) => void handleSelectExistingSource(sid)}
            />
          )}

          {step === STEP_GLOSSARY && (
            <StepGlossary
              terms={scannedTerms}
              selectedTerms={selectedTerms}
              onToggle={toggleTerm}
            />
          )}

          {step === STEP_IMPORT && (
            <div role="status" className="flex items-center justify-center py-12">
              <span className="text-sm text-muted-foreground">Importing assets…</span>
            </div>
          )}

          {step === STEP_CAMPAIGN && importResult && (
            <StepCampaign
              result={importResult}
              campaignName={campaignName}
              onNameChange={setCampaignName}
              isCreating={createCampaignM.isPending}
              onCreate={() => void handleCreateCampaign()}
              onSkip={handleClose}
            />
          )}
        </div>

        {/* Error display */}
        {wizardError ? (
          <div className="mt-4">
            <InlineAlert title="Something went wrong">
              {(wizardError as ApiError | Error).message || 'An error occurred'}
            </InlineAlert>
          </div>
        ) : null}
    </Sheet>
  );
}

// ── Sub-components (step content) ─────────────────────────────────────

interface StepMetricViewsProps {
  catalogsQ: ReturnType<typeof useCatalogs>;
  schemasQ: ReturnType<typeof useCatalogSchemas>;
  viewsQ: ReturnType<typeof useCatalogMetricViews>;
  catalog: string;
  schema: string;
  selectedViews: string[];
  onCatalogChange: (c: string) => void;
  onSchemaChange: (s: string) => void;
  onToggleView: (fqn: string) => void;
}

function StepMetricViews({
  catalogsQ,
  schemasQ,
  viewsQ,
  catalog,
  schema,
  selectedViews,
  onCatalogChange,
  onSchemaChange,
  onToggleView,
}: StepMetricViewsProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a catalog and schema, then pick the metric views to import.
      </p>

      {/* Catalog picker */}
      <div>
        <label htmlFor="import-wizard-catalog" className="text-sm font-medium">Catalog</label>
        {catalogsQ.isLoading ? (
          <Skeleton className="h-9 w-full mt-1" />
        ) : (
          <select
            id="import-wizard-catalog"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={catalog}
            onChange={(e) => onCatalogChange(e.target.value)}
          >
            <option value="">Select a catalog…</option>
            {catalogsQ.data?.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}{c.comment ? ` — ${c.comment}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Schema picker */}
      {catalog && (
        <div>
          <label htmlFor="import-wizard-schema" className="text-sm font-medium">Schema</label>
          {schemasQ.isLoading ? (
            <Skeleton className="h-9 w-full mt-1" />
          ) : (
            <select
              id="import-wizard-schema"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={schema}
              onChange={(e) => onSchemaChange(e.target.value)}
            >
              <option value="">Select a schema…</option>
              {schemasQ.data?.map((s) => (
                <option key={s.fullName} value={s.name}>
                  {s.name}{s.comment ? ` — ${s.comment}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Metric view multi-select */}
      {catalog && schema && (
        <div>
          <label className="text-sm font-medium">
            Metric Views{' '}
            <Badge variant="secondary" className="ml-1">
              {selectedViews.length} selected
            </Badge>
          </label>
          {viewsQ.isLoading ? (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : viewsQ.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">
              No metric views found in {catalog}.{schema}.
            </p>
          ) : (
            <div className="mt-2 max-h-64 overflow-y-auto space-y-1 border rounded-md p-2">
              {viewsQ.data?.map((mv: MetricViewSummary) => {
                const fqn = mv.fullName;
                const checked = selectedViews.includes(fqn);
                return (
                  <label
                    key={fqn}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                      checked ? 'bg-primary/10' : 'hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleView(fqn)}
                      className="rounded border-input"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{fqn.split('.').pop()}</span>
                      {mv.comment && (
                        <span className="text-muted-foreground ml-2 truncate">
                          {mv.comment}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {mv.measureCount}m / {mv.dimensionCount}d
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StepSourceProps {
  sourcesQ: ReturnType<typeof useSources>;
  sourceId: string | null;
  showNewSource: boolean;
  newSourcePath: string;
  scannedMvFiles: ScanMetricViewFile[];
  isRegistering: boolean;
  isScanning: boolean;
  onShowNew: () => void;
  onNewSourcePathChange: (v: string) => void;
  onRegister: () => void;
  onSelectExisting: (sid: string) => void;
}

function StepSource({
  sourcesQ,
  sourceId,
  showNewSource,
  newSourcePath,
  scannedMvFiles,
  isRegistering,
  isScanning,
  onShowNew,
  onNewSourcePathChange,
  onRegister,
  onSelectExisting,
}: StepSourceProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Optionally link a Git folder source. The scan will find metric view YAML files and glossary terms.
      </p>

      {/* Existing sources */}
      {sourcesQ.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <>
          {(sourcesQ.data ?? []).length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Existing sources</label>
              {sourcesQ.data!.map((src) => (
                <Card
                  key={src.id}
                  className={`transition-colors ${
                    sourceId === src.id ? 'ring-2 ring-primary' : 'hover:bg-muted'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={sourceId === src.id}
                    onClick={() => onSelectExisting(src.id)}
                    className="block min-h-[44px] w-full rounded-[inherit] text-left"
                  >
                  <CardContent className="p-3 flex items-center gap-2">
                    <Icon name="folderBranch" className="shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {src.displayName ?? src.workspacePath}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {src.workspacePath}
                      </p>
                    </div>
                    {sourceId === src.id && (
                      <Icon name="check" className="shrink-0 text-primary" />
                    )}
                  </CardContent>
                  </button>
                </Card>
              ))}
            </div>
          )}

          {!showNewSource ? (
            <Button variant="outline" size="sm" onClick={onShowNew}>
              <Icon name="folderBranch" className="mr-1" /> Register new source
            </Button>
          ) : (
            <Card>
              <CardContent className="p-3 space-y-2">
                <label htmlFor="import-wizard-source-path" className="text-sm font-medium">Workspace path</label>
                <div className="flex gap-2">
                  <Input
                    id="import-wizard-source-path"
                    value={newSourcePath}
                    onChange={(e) => onNewSourcePathChange(e.target.value)}
                    placeholder="/Workspace/Users/.../my-repo"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={onRegister}
                    disabled={!newSourcePath.trim() || isRegistering}
                  >
                    {isRegistering ? 'Registering…' : 'Register'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Scan results */}
      {isScanning && (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          Scanning source…
        </div>
      )}

      {sourceId && !isScanning && scannedMvFiles.length > 0 && (
        <div>
          <label className="text-sm font-medium">Matched YAML files</label>
          <div className="mt-1 max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
            {scannedMvFiles.map((f) => (
              <div key={f.filePath} className="flex items-center gap-2 text-sm">
                <Icon name="fileCode" className="shrink-0 text-muted-foreground" />
                <span className="truncate">{f.filePath}</span>
                <Badge variant="secondary" className="shrink-0">{f.viewName}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StepGlossaryProps {
  terms: ScanGlossaryTerm[];
  selectedTerms: ScanGlossaryTerm[];
  onToggle: (term: ScanGlossaryTerm) => void;
}

function StepGlossary({ terms, selectedTerms, onToggle }: StepGlossaryProps) {
  if (terms.length === 0) {
    return (
      <div className="text-center py-8">
        <Icon name="fileCode" size={32} className="mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">
          No glossary terms found from the source scan. You can skip this step.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select glossary terms to import as page assets.
        <Badge variant="secondary" className="ml-2">
          {selectedTerms.length} selected
        </Badge>
      </p>

      <div className="max-h-72 overflow-y-auto border rounded-md p-2 space-y-1">
        {terms.map((t) => {
          const key = `${t.filePath}:${t.term}`;
          const checked = selectedTerms.some(
            (st) => `${st.filePath}:${st.term}` === key,
          );
          return (
            <label
              key={key}
              className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                checked ? 'bg-primary/10' : 'hover:bg-muted'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(t)}
                className="rounded border-input mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{t.term}</span>
                {t.domain && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {t.domain}{t.subdomain ? ` / ${t.subdomain}` : ''}
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {t.definition}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface StepCampaignProps {
  result: ImportAssetsResponse;
  campaignName: string;
  onNameChange: (v: string) => void;
  isCreating: boolean;
  onCreate: () => void;
  onSkip: () => void;
}

function StepCampaign({
  result,
  campaignName,
  onNameChange,
  isCreating,
  onCreate,
  onSkip,
}: StepCampaignProps) {
  return (
    <div className="space-y-4">
      {/* Import summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Import Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Created</span>
            <Badge variant="default">{result.created.length}</Badge>
          </div>
          <div className="flex justify-between">
            <span>Updated</span>
            <Badge variant="secondary">{result.updated.length}</Badge>
          </div>
          {result.skipped.length > 0 && (
            <div className="flex justify-between">
              <span>Skipped</span>
              <Badge variant="outline">{result.skipped.length}</Badge>
            </div>
          )}
          {result.skipped.length > 0 && (
            <ul aria-label="Skipped items" className="mt-2 border rounded-md p-2 max-h-24 overflow-y-auto">
              {result.skipped.map((s) => (
                <li key={s.ref} className="text-xs text-muted-foreground">
                  <span className="font-medium">{s.ref}</span>: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Campaign creation */}
      {(result.created.length + result.updated.length) > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Create a campaign for the imported assets, or skip to finish.
          </p>
          <div>
            <label htmlFor="import-wizard-campaign-name" className="text-sm font-medium">Campaign name</label>
            <Input
              id="import-wizard-campaign-name"
              value={campaignName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Q4 Metric View Review"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onCreate}
              disabled={!campaignName.trim() || isCreating}
              className="flex-1"
            >
              <Icon name="plus" className="mr-1" />
              {isCreating ? 'Creating…' : 'Create campaign'}
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              Skip
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No assets were imported.</p>
          <Button variant="ghost" onClick={onSkip} className="mt-2">
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
