// client/src/components/steward/ImportWizard.tsx — multi-step import-from-assets wizard
// Session 10 · Wave 1 · No enum, no namespace, no default export

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Badge,
} from '@databricks/appkit-ui/react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
  FolderGit2,
  Database,
  FileText,
  Import,
} from 'lucide-react';
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
    const source = await registerSourceM.mutateAsync(body);
    setSourceId(source.id);
    setShowNewSource(false);
    setNewSourcePath('');
    await handleScan(source.id);
  }

  async function handleScan(sid: string) {
    const result = await scanSourceM.mutateAsync(sid);
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
    const result = await importM.mutateAsync(body);
    setImportResult(result);
    setStep(STEP_CAMPAIGN);
  }

  async function handleCreateCampaign() {
    if (!campaignName.trim() || !importResult) return;
    const assetIds = [...importResult.created, ...importResult.updated];
    await createCampaignM.mutateAsync({
      name: campaignName.trim(),
      campaignType: 'manual',
      scopeAssetIds: assetIds,
    });
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

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Campaign from Assets</SheetTitle>
        </SheetHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 my-4">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div
                className={`h-2 w-2 rounded-full ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
              <span
                className={`text-xs ${
                  i === step ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">Importing assets…</span>
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
        {(importM.error || registerSourceM.error || scanSourceM.error) && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {((importM.error ?? registerSourceM.error ?? scanSourceM.error) as ApiError | Error)?.message ?? 'An error occurred'}
            </span>
          </div>
        )}

        {/* Navigation */}
        {step < STEP_CAMPAIGN && step !== STEP_IMPORT && (
          <div className="flex justify-between mt-6">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === STEP_METRIC_VIEWS}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canGoNext() || importM.isPending}
            >
              {step === STEP_GLOSSARY ? (
                <>
                  <Import className="h-4 w-4 mr-1" /> Import
                </>
              ) : (
                <>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
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
        <label className="text-sm font-medium">Catalog</label>
        {catalogsQ.isLoading ? (
          <Skeleton className="h-9 w-full mt-1" />
        ) : (
          <select
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
          <label className="text-sm font-medium">Schema</label>
          {schemasQ.isLoading ? (
            <Skeleton className="h-9 w-full mt-1" />
          ) : (
            <select
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
                  className={`cursor-pointer transition-colors ${
                    sourceId === src.id ? 'ring-2 ring-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => onSelectExisting(src.id)}
                >
                  <CardContent className="p-3 flex items-center gap-2">
                    <FolderGit2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {src.displayName ?? src.workspacePath}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {src.workspacePath}
                      </p>
                    </div>
                    {sourceId === src.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!showNewSource ? (
            <Button variant="outline" size="sm" onClick={onShowNew}>
              <FolderGit2 className="h-4 w-4 mr-1" /> Register new source
            </Button>
          ) : (
            <Card>
              <CardContent className="p-3 space-y-2">
                <label className="text-sm font-medium">Workspace path</label>
                <div className="flex gap-2">
                  <Input
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
                    {isRegistering ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Register'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Scan results */}
      {isScanning && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning source…
        </div>
      )}

      {sourceId && !isScanning && scannedMvFiles.length > 0 && (
        <div>
          <label className="text-sm font-medium">Matched YAML files</label>
          <div className="mt-1 max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
            {scannedMvFiles.map((f) => (
              <div key={f.filePath} className="flex items-center gap-2 text-sm">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
        <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
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
            <div className="mt-2 border rounded-md p-2 max-h-24 overflow-y-auto">
              {result.skipped.map((s) => (
                <p key={s.ref} className="text-xs text-muted-foreground">
                  <span className="font-medium">{s.ref}</span>: {s.reason}
                </p>
              ))}
            </div>
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
            <label className="text-sm font-medium">Campaign name</label>
            <Input
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
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Database className="h-4 w-4 mr-1" />
              )}
              Create Campaign
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
