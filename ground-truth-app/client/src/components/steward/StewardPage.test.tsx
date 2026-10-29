// @a11y-strict
// client/src/components/steward/StewardPage.test.tsx — S4 Steward console (ui_test_strategy.md §8 S4 rows)
// Session 54 · Build 5 · wave 5-2 (completed by the owner after the session hit its limit)
//
// loading / populated (tabs by role, campaign rows, assets paging, metric view
// validate result), empty per tab (CTA by name), per-tab error (other tabs
// still usable), forbidden + F4 regression (GET /api/me 500 is an error, not
// forbidden), offline (writes disabled), import wizard (step navigation, scan
// pending, partial failure list, ImportAssetsBody request parse), the asset
// detail `actions` slot (session 56; GET /api/config for Share to Slack); axe light + dark.

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  CatalogEntry,
  ImportAssetsResponse,
  MetricViewDetail,
  ScanSourceResponse,
  SchemaEntry,
} from '../../../../shared/contracts';
import { ImportAssetsBodySchema } from '../../../../shared/contracts';
import { STEWARD_FORBIDDEN_TITLE, StewardPage } from '../../pages/steward/StewardPage';
import type { StewardPageProps } from '../../pages/steward/StewardPage';
import { ACCESS_ERROR_TITLE } from '../access/RoleGate';
import { expectNoAxeViolations } from '../../test/axe';
import {
  assetReadmissionRate,
  campaign,
  IDS,
  meSteward,
  metricViews,
  pagedAssets,
  runtimeConfig,
  sources,
  stewardRoutes,
  TARGET_CATALOG,
  TARGET_SCHEMA,
  validateFailed,
} from '../../test/fixtures';
import { calls, mockApi } from '../../test/mockApi';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import { ASSETS_EMPTY_TITLE, PAGE_SIZE } from './AssetBrowser';
import { CAMPAIGNS_EMPTY_TITLE } from './CampaignList';
import { METRIC_VIEWS_EMPTY_TITLE } from './MetricViewPanel';

const STEWARD = ['reviewer', 'steward'] as const;

// ── Local fixtures (wizard + detail routes are not in stewardRoutes) ───────

const MV = metricViews[0]!;
const MV_SHORT = MV.fullName.split('.').pop()!;
const SOURCE = sources[0]!;

const metricViewDetail: MetricViewDetail = {
  ...MV,
  measures: [{ name: 'readmission_rate_30d', expr: 'SUM(readmit_30d) / COUNT(*)', comment: '30-day readmission share' }],
  dimensions: [{ name: 'discharge_month', expr: "date_trunc('month', discharge_dt)" }],
};

const catalogs: CatalogEntry[] = [{ name: TARGET_CATALOG, comment: null }];
const schemas: SchemaEntry[] = [
  { name: TARGET_SCHEMA, fullName: `${TARGET_CATALOG}.${TARGET_SCHEMA}`, comment: null },
];

const scan: ScanSourceResponse = {
  metricViewFiles: [{ filePath: 'semantics/clinical_quality.metric_view.yml', viewName: MV_SHORT }],
  glossaryTerms: [
    {
      filePath: 'semantics/clinical/readmission.md',
      term: 'Readmission',
      domain: 'Clinical Quality',
      definition: 'An unplanned inpatient admission within 30 days of a discharge.',
    },
  ],
};

const SKIPPED_REF = metricViews[1]!.fullName;
const importPartial: ImportAssetsResponse = {
  created: [IDS.assets.readmissionRate],
  updated: [],
  skipped: [{ ref: SKIPPED_REF, reason: 'Metric view not found in Unity Catalog' }],
};

const wizardRoutes = {
  'GET /api/catalog/catalogs': catalogs,
  'GET /api/catalog/schemas': schemas,
  'GET /api/catalog/metric-views': metricViews,
  'POST /api/sources/:id/scan': scan,
  'POST /api/assets/import': importPartial,
};

function renderPage(options: Parameters<typeof renderWithProviders>[1] = {}, props: StewardPageProps = {}) {
  return renderWithProviders(<StewardPage {...props} />, { route: '/steward', roles: [...STEWARD], ...options });
}

type User = ReturnType<typeof renderPage>['user'];

const panel = () => screen.getByRole('tabpanel');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Loading / populated ──────────────────────────────────────────────────

describe('S4 steward · loading / populated', () => {
  it('shows the title and an access skeleton while GET /api/me is pending, with no steward requests', async () => {
    mockApi.pending('GET /api/me');
    const { container } = renderWithProviders(<StewardPage />, { route: '/steward' });
    expect(screen.getByRole('heading', { level: 1, name: 'Steward' })).toBeInTheDocument();
    expect(screen.getByTestId('steward-access-loading')).toHaveTextContent('Checking your access');
    expect(calls('GET /api/campaigns')).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('shows a campaigns skeleton while GET /api/campaigns is pending', async () => {
    mockApi(stewardRoutes);
    mockApi.pending('GET /api/campaigns');
    renderPage();
    expect(await screen.findByText('Loading campaigns')).toBeInTheDocument();
  });

  it('renders three tabs in a labelled tablist with Campaigns selected', async () => {
    mockApi(stewardRoutes);
    renderPage();
    const tablist = await screen.findByRole('tablist', { name: 'Steward views' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Campaigns', 'Assets', 'Metric views']);
    expect(screen.getByRole('tab', { name: 'Campaigns' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists campaign rows with name, status and progress; the closed wizard sends no requests', async () => {
    mockApi(stewardRoutes);
    renderPage();
    const row = await screen.findByRole('listitem', { name: campaign.name });
    expect(row).toHaveAttribute('data-testid', 'steward-campaign-row');
    expect(row).toHaveTextContent(`${campaign.reviewedAssets} of ${campaign.totalAssets} reviewed`);
    expect(within(row).getByRole('progressbar', { name: `${campaign.name} progress` })).toBeInTheDocument();
    expect(within(row).getByRole('group', { name: `Change status of ${campaign.name}` })).toBeInTheDocument();
    expect(calls('GET /api/catalog/catalogs')).toHaveLength(0);
    expect(calls('GET /api/sources')).toHaveLength(0);
  });

  it('a status button sends PATCH /api/campaigns/:campaignId/status with the target status', async () => {
    mockApi({ ...stewardRoutes, 'PATCH /api/campaigns/:campaignId/status': { ...campaign, status: 'paused' } });
    const { user } = renderPage();
    const row = await screen.findByRole('listitem', { name: campaign.name });
    await user.click(within(row).getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(calls('PATCH /api/campaigns/:campaignId/status')).toHaveLength(1));
    const req = calls('PATCH /api/campaigns/:campaignId/status')[0]!;
    expect(req.params.campaignId).toBe(campaign.id);
    expect(req.body).toEqual({ status: 'paused' });
  });

  it('assets tab pages with Previous / Next and sends the offset', async () => {
    mockApi(stewardRoutes);
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Assets' }));
    expect(await screen.findAllByTestId('steward-assets-row')).toHaveLength(pagedAssets.items.length);
    expect(screen.getByRole('table', { name: 'Assets' })).toBeInTheDocument();
    const pages = screen.getByRole('navigation', { name: 'Asset pages' });
    expect(pages).toHaveTextContent(`1–${PAGE_SIZE} of ${pagedAssets.total}`);
    expect(within(pages).getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.click(within(pages).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(calls('GET /api/assets').some((c) => c.query.offset === String(PAGE_SIZE))).toBe(true));
    expect(await screen.findByText(`${PAGE_SIZE + 1}–${PAGE_SIZE * 2} of ${pagedAssets.total}`)).toBeInTheDocument();
    const next = screen.getByRole('navigation', { name: 'Asset pages' });
    expect(within(next).getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('an asset opens the detail sheet and renders the actions slot (session 56)', async () => {
    mockApi({
      ...stewardRoutes,
      'GET /api/assets/:assetId': assetReadmissionRate,
      'GET /api/assets/:assetId/versions': [],
      // Share to Slack (session 56) reads GET /api/config for stewards in the sheet footer.
      'GET /api/config': runtimeConfig,
    });
    const name = assetReadmissionRate.displayName ?? assetReadmissionRate.name;
    const { user } = renderPage({}, { assetActions: (a) => <button type="button">Share {a.name}</button> });
    await user.click(await screen.findByRole('tab', { name: 'Assets' }));
    await user.click(await screen.findByRole('button', { name }));
    const sheet = await screen.findByRole('dialog', { name });
    expect(await within(sheet).findByText('No versions recorded.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: `Share ${assetReadmissionRate.name}` })).toBeInTheDocument();
    expect(calls('GET /api/assets/:assetId')[0]!.params.assetId).toBe(assetReadmissionRate.id);
  });

  it('metric views tab: validate shows the result (passed, then failed)', async () => {
    mockApi({ ...stewardRoutes, 'GET /api/metric-views/:fullName': metricViewDetail });
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Metric views' }));
    await user.click(await screen.findByRole('button', { name: new RegExp(escapeRe(MV.fullName)) }));
    const card = await screen.findByRole('region', { name: MV.fullName });
    expect(within(card).getByText('readmission_rate_30d')).toBeInTheDocument();
    await user.click(within(card).getByTestId('steward-metric-view-validate'));
    expect(await within(card).findByText('Validation passed')).toBeInTheDocument();
    expect(calls('POST /api/metric-views/:fullName/validate')[0]!.params.fullName).toBe(MV.fullName);

    mockApi({ 'POST /api/metric-views/:fullName/validate': validateFailed });
    await user.click(within(card).getByRole('button', { name: 'Validate' }));
    expect(await within(card).findByText('Validation failed')).toBeInTheDocument();
    expect(card).toHaveTextContent(validateFailed.error ?? '');
  });

  it('has one <h1> and passes axe in light and dark', async () => {
    await renderInBothThemes(async (theme) => {
      mockApi(stewardRoutes);
      const { container } = renderPage({ theme });
      await screen.findByRole('listitem', { name: campaign.name });
      expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      await expectNoAxeViolations(container);
    });
  });
});

// ── Empty (per tab) ──────────────────────────────────────────────────────

describe('S4 steward · empty (per tab)', () => {
  it('campaigns empty shows its CTA "New campaign" that opens the create sheet', async () => {
    mockApi({ ...stewardRoutes, 'GET /api/campaigns': [] });
    const { user, container } = renderPage();
    expect(await screen.findByText(CAMPAIGNS_EMPTY_TITLE)).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.click(within(panel()).getByRole('button', { name: 'New campaign' }));
    expect(await screen.findByRole('dialog', { name: 'New campaign' })).toBeInTheDocument();
  });

  it('assets empty shows its CTA "Import assets" that opens the wizard', async () => {
    mockApi({ ...stewardRoutes, ...wizardRoutes, 'GET /api/assets': { items: [], total: 0, limit: PAGE_SIZE, offset: 0 } });
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Assets' }));
    expect(await screen.findByText(ASSETS_EMPTY_TITLE)).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'Import assets' }));
    expect(await screen.findByRole('dialog', { name: 'Import assets' })).toBeInTheDocument();
  });

  it('metric views empty shows its CTA "Import assets"', async () => {
    mockApi({ ...stewardRoutes, 'GET /api/metric-views': [] });
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Metric views' }));
    expect(await screen.findByText(METRIC_VIEWS_EMPTY_TITLE)).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Import assets' })).toBeEnabled();
  });
});

// ── Error / forbidden / offline ─────────────────────────────────────────

describe('S4 steward · error / forbidden / offline', () => {
  it('a failed campaigns load is a per-tab alert with Retry; the Assets tab still works', async () => {
    mockApi(stewardRoutes);
    mockApi.error('GET /api/campaigns', 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting');
    const { user, container } = renderPage();
    const alert = await within(await screen.findByRole('tabpanel')).findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load campaigns");
    expect(alert).toHaveTextContent('SQL warehouse is starting');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
    expect(screen.getByTestId('steward-actions-new-campaign')).toBeEnabled();
    await user.click(screen.getByRole('tab', { name: 'Assets' }));
    expect(await screen.findAllByTestId('steward-assets-row')).toHaveLength(pagedAssets.items.length);
  });

  it('a failed assets load does not affect the Campaigns tab', async () => {
    mockApi(stewardRoutes);
    mockApi.error('GET /api/assets', 502, 'UPSTREAM_ERROR', 'Lakebase unavailable');
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Assets' }));
    expect(await within(panel()).findByRole('alert')).toHaveTextContent("Couldn't load assets");
    await user.click(screen.getByRole('tab', { name: 'Campaigns' }));
    expect(await screen.findByRole('listitem', { name: campaign.name })).toBeInTheDocument();
  });

  it('a reviewer sees steward-forbidden-root and no steward requests are sent', async () => {
    mockApi(stewardRoutes);
    const { container } = renderPage({ roles: ['reviewer'] });
    const forbidden = await screen.findByTestId('steward-forbidden-root');
    expect(forbidden).toHaveTextContent(STEWARD_FORBIDDEN_TITLE);
    for (const key of ['GET /api/campaigns', 'GET /api/assets', 'GET /api/metric-views', 'GET /api/sources']) {
      expect(calls(key), key).toHaveLength(0);
    }
    await expectNoAxeViolations(container);
  });

  it('F4: GET /api/me 500 shows an error with Retry, not forbidden', async () => {
    mockApi.error('GET /api/me', 500, 'INTERNAL', 'Database unavailable');
    const { user, container } = renderWithProviders(<StewardPage />, { route: '/steward' });
    const err = await screen.findByTestId('steward-access-error');
    expect(err).toHaveTextContent(ACCESS_ERROR_TITLE);
    expect(err).toHaveTextContent('Database unavailable');
    expect(screen.queryByTestId('steward-forbidden-root')).not.toBeInTheDocument();
    expect(calls('GET /api/campaigns')).toHaveLength(0);
    await expectNoAxeViolations(container);
    mockApi(stewardRoutes);
    mockApi({ 'GET /api/me': meSteward });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('listitem', { name: campaign.name })).toBeInTheDocument();
    expect(calls('GET /api/me')).toHaveLength(2);
  });

  it('offline: write buttons are disabled and an offline alert explains why', async () => {
    mockApi(stewardRoutes);
    const { container } = renderPage({ online: false });
    const alert = await screen.findByText("You're offline");
    expect(alert.closest('[role="alert"]')).toHaveAttribute('data-variant', 'offline');
    expect(screen.getByTestId('steward-actions-import')).toBeDisabled();
    expect(screen.getByTestId('steward-actions-new-campaign')).toBeDisabled();
    const row = await screen.findByRole('listitem', { name: campaign.name });
    for (const button of within(row).getAllByRole('button')) expect(button).toBeDisabled();
    await expectNoAxeViolations(container);
  });
});

// ── Import wizard ───────────────────────────────────────────────────────

async function openWizard(user: User) {
  await screen.findByRole('listitem', { name: campaign.name });
  await user.click(screen.getByTestId('steward-actions-import'));
  return screen.findByRole('dialog', { name: 'Import assets' });
}

const currentStep = (dialog: HTMLElement) =>
  within(within(dialog).getByRole('list', { name: 'Import steps' }))
    .getAllByRole('listitem')
    .find((li) => li.getAttribute('aria-current') === 'step')?.textContent;

async function pickMetricView(user: User, dialog: HTMLElement) {
  await user.selectOptions(await within(dialog).findByLabelText('Catalog'), TARGET_CATALOG);
  await user.selectOptions(await within(dialog).findByLabelText('Schema'), TARGET_SCHEMA);
  await user.click(await within(dialog).findByRole('checkbox', { name: new RegExp(MV_SHORT) }));
}

describe('S4 steward · import wizard', () => {
  it('step navigation: Next needs a metric view; Back returns to the previous step', async () => {
    mockApi({ ...stewardRoutes, ...wizardRoutes });
    const { user } = renderPage();
    const dialog = await openWizard(user);
    expect(currentStep(dialog)).toBe('Metric Views');
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(within(dialog).getByTestId('steward-import-next')).toBeDisabled();
    await pickMetricView(user, dialog);
    expect(calls('GET /api/catalog/metric-views')[0]!.query).toEqual({ catalog: TARGET_CATALOG, schema: TARGET_SCHEMA });
    await user.click(within(dialog).getByTestId('steward-import-next'));
    expect(currentStep(dialog)).toMatch(/^Git Source/);
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(currentStep(dialog)).toBe('Metric Views');
    expect(within(dialog).getByRole('checkbox', { name: new RegExp(MV_SHORT) })).toBeChecked();
    await expectNoAxeViolations(document.body);
  });

  it('scan pending shows a status message', async () => {
    mockApi({ ...stewardRoutes, ...wizardRoutes });
    mockApi.pending('POST /api/sources/:id/scan');
    const { user } = renderPage();
    const dialog = await openWizard(user);
    await pickMetricView(user, dialog);
    await user.click(within(dialog).getByTestId('steward-import-next'));
    await user.click(await within(dialog).findByRole('button', { name: new RegExp(escapeRe(SOURCE.workspacePath)) }));
    const scanning = await within(dialog).findByText('Scanning source…');
    expect(scanning.closest('[role="status"]')).not.toBeNull();
    expect(calls('POST /api/sources/:id/scan')[0]!.params.id).toBe(SOURCE.id);
  });

  it('imports with a parseable ImportAssetsBody and lists partial failures', async () => {
    mockApi({ ...stewardRoutes, ...wizardRoutes });
    const { user } = renderPage();
    const dialog = await openWizard(user);
    await pickMetricView(user, dialog);
    await user.click(within(dialog).getByTestId('steward-import-next'));
    const source = await within(dialog).findByRole('button', { name: new RegExp(escapeRe(SOURCE.workspacePath)) });
    await user.click(source);
    expect(await within(dialog).findByText(scan.metricViewFiles[0]!.filePath)).toBeInTheDocument();
    expect(source).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(dialog).getByTestId('steward-import-next'));
    expect(currentStep(dialog)).toMatch(/^Glossary Terms/);
    await user.click(within(dialog).getByRole('checkbox', { name: /Readmission/ }));
    await user.click(within(dialog).getByTestId('steward-import-submit'));

    await waitFor(() => expect(calls('POST /api/assets/import')).toHaveLength(1));
    const body = ImportAssetsBodySchema.parse(calls('POST /api/assets/import')[0]!.body);
    expect(body).toEqual({
      metricViews: [MV.fullName],
      sourceId: SOURCE.id,
      glossaryTerms: [{ sourceId: SOURCE.id, filePath: scan.glossaryTerms[0]!.filePath, term: 'Readmission' }],
    });

    const skipped = await within(dialog).findByRole('list', { name: 'Skipped items' });
    expect(within(skipped).getAllByRole('listitem')).toHaveLength(1);
    expect(skipped).toHaveTextContent(`${SKIPPED_REF}: Metric view not found in Unity Catalog`);
    expect(currentStep(dialog)).toMatch(/^Campaign/);
    expect(within(dialog).getByLabelText('Campaign name')).toBeInTheDocument();
  });

  it('an import error shows an alert in the wizard', async () => {
    mockApi({ ...stewardRoutes, ...wizardRoutes });
    mockApi.error('POST /api/assets/import', 502, 'UPSTREAM_ERROR', 'Unity Catalog timed out');
    const { user } = renderPage();
    const dialog = await openWizard(user);
    await pickMetricView(user, dialog);
    await user.click(within(dialog).getByTestId('steward-import-next'));
    await user.click(within(dialog).getByTestId('steward-import-next'));
    await user.click(within(dialog).getByTestId('steward-import-submit'));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    expect(alert).toHaveTextContent('Unity Catalog timed out');
  });
});
