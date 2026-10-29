// @a11y-strict
// client/src/pages/settings/SettingsPage.tsx — S7 Settings `/settings`
// Session 49 · Build 5 · wave 5-1: route + lazy chunk + final export name.
// Session 52 · Build 5 · wave 5-2: the real screen (screen_inventory.md S7, F8, F9;
// figma/_code/src/pages/SettingsPage.tsx; ui_test_strategy.md §8 S7, KB K5).
//
// Data: GET /api/me/settings (UserSettings, defaults when no row),
// GET /api/notifications/preferences (moved here from Admin, F8),
// GET /api/campaigns (default-campaign select), GET /api/me (About).
// Saving: PUT /api/me/settings with only the changed fields, and
// PUT /api/notifications/preferences with only the changed rows.
//
// Behaviour:
// * Theme applies at once through next-themes (the provider ThemeSync seeds,
//   F9) and is saved with the other fields on "Save changes" / Ctrl+S.
// * Every other field marks the form dirty; a sticky footer offers Save /
//   Discard. Discard also puts the saved theme back.
// * Cards per session outside 5-100 shows an inline error; Save then focuses
//   the field and sends nothing.
// * Offline: the form is disabled and nothing is sent; the theme still
//   switches on this device.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { ASSET_TYPES, CARDS_PER_SESSION_MAX, CARDS_PER_SESSION_MIN } from '../../../../shared/contracts';
import type { AssetType, Density, MotionPref, NotificationChannel, NotificationEventType, Theme, UserSettings } from '../../../../shared/contracts';
import {
  useCampaigns,
  useMe,
  useMySettings,
  useNotificationPreferences,
  useUpdateMySettings,
  useUpdateNotificationPreferences,
} from '../../lib/api/hooks';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { ShellGlyph } from '../../components/layout/ShellIcons';
import {
  NotificationPrefsTable,
  SegmentedControl,
  SettingsFooter,
  SettingsIndex,
  SettingsSection,
  SettingsSkeleton,
  SettingsSwitch,
  changedPreferences,
  diffSettings,
  isSettingsDirty,
  isUsingDefaults,
  mergePreferences,
  preferencesBody,
  toDraft,
  toggleChannel,
  toggleDigest,
  validateCardsPerSession,
  type PrefRow,
  type SegmentedOption,
  type SettingsDraft,
} from '../../components/settings';
import { Icon } from '../../components/ui/Icon';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { SkeletonGroup } from '../../components/ui/Skeleton';
import { ToastRegion, useToasts } from '../../components/ui/Toast';

const THEME_OPTIONS: readonly SegmentedOption<Theme>[] = [
  { value: 'light', label: 'Light', icon: <ShellGlyph name="sun" size={16} />, testId: 'settings-theme-light' },
  { value: 'dark', label: 'Dark', icon: <ShellGlyph name="moon" size={16} />, testId: 'settings-theme-dark' },
  { value: 'system', label: 'System', icon: <ShellGlyph name="monitor" size={16} />, testId: 'settings-theme-system' },
];

const DENSITY_OPTIONS: readonly SegmentedOption<Density>[] = [
  { value: 'comfortable', label: 'Comfortable', testId: 'settings-density-comfortable' },
  { value: 'compact', label: 'Compact', testId: 'settings-density-compact' },
];

const MOTION_OPTIONS: readonly SegmentedOption<MotionPref>[] = [
  { value: 'system', label: 'System', testId: 'settings-motion-system' },
  { value: 'reduce', label: 'Reduce', testId: 'settings-motion-reduce' },
  { value: 'full', label: 'Full', testId: 'settings-motion-full' },
];

const ASSET_TYPE_LABELS: Readonly<Record<AssetType, string>> = {
  measure: 'Measure',
  dimension: 'Dimension',
  page: 'Page',
  domain: 'Domain',
  subdomain: 'Subdomain',
};

const FIELD_CLASS =
  'min-h-[44px] w-full max-w-md rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong.';
}

export function SettingsPage() {
  const settingsQuery = useMySettings();
  const prefsQuery = useNotificationPreferences();
  const campaignsQuery = useCampaigns();
  const meQuery = useMe();
  const updateSettings = useUpdateMySettings();
  const updatePrefs = useUpdateNotificationPreferences();
  const online = useOnlineStatus();
  const { setTheme } = useTheme();
  const { toasts, push, dismiss } = useToasts();

  const [baseline, setBaseline] = useState<UserSettings | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [prefBaseline, setPrefBaseline] = useState<PrefRow[] | null>(null);
  const [prefDraft, setPrefDraft] = useState<PrefRow[] | null>(null);
  const [showCardsError, setShowCardsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const cardsRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const cardsId = `${ids}-cards`;
  const cardsHelpId = `${ids}-cards-help`;
  const cardsErrorId = `${ids}-cards-error`;
  const campaignId = `${ids}-campaign`;
  const assetTypeId = `${ids}-asset-type`;

  // Keep the latest values for the sync effects and the Ctrl+S handler.
  const latest = useRef({ baseline, draft, prefBaseline, prefDraft });
  latest.current = { baseline, draft, prefBaseline, prefDraft };

  // Adopt server data. A clean form follows it (e.g. the header theme toggle);
  // a dirty form keeps the user's edits and compares them with the new data.
  const settingsData = settingsQuery.data;
  useEffect(() => {
    if (!settingsData) return;
    const { baseline: b, draft: d } = latest.current;
    if (!b || !d || !isSettingsDirty(b, d)) setDraft(toDraft(settingsData));
    setBaseline(settingsData);
  }, [settingsData]);

  const prefsData = prefsQuery.data;
  useEffect(() => {
    if (!prefsData) return;
    const rows = mergePreferences(prefsData);
    const { prefBaseline: b, prefDraft: d } = latest.current;
    if (!b || !d || changedPreferences(b, d).length === 0) setPrefDraft(rows);
    setPrefBaseline(rows);
  }, [prefsData]);

  const settingsDirty = baseline !== null && draft !== null && isSettingsDirty(baseline, draft);
  const prefsDirty = prefBaseline !== null && prefDraft !== null && changedPreferences(prefBaseline, prefDraft).length > 0;
  const dirty = settingsDirty || prefsDirty;
  const cardsError = draft ? validateCardsPerSession(draft.cardsPerSession) : null;
  const offline = !online;

  const edit = (patch: Partial<SettingsDraft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setSaveError(null);
  };

  const changeTheme = (theme: Theme) => {
    setTheme(theme);
    edit({ theme });
  };

  const save = useCallback(async () => {
    const { baseline: b, draft: d, prefBaseline: pb, prefDraft: pd } = latest.current;
    if (!b || !d || saving || !navigator.onLine) return;
    if (validateCardsPerSession(d.cardsPerSession)) {
      setShowCardsError(true);
      cardsRef.current?.focus();
      return;
    }
    const settingsBody = diffSettings(b, d);
    const prefsBody = pb && pd ? preferencesBody(pb, pd) : null;
    const sendSettings = Object.keys(settingsBody).length > 0;
    if (!sendSettings && !prefsBody) return;

    setSaving(true);
    setSaveError(null);
    try {
      const [savedSettings, savedPrefs] = await Promise.all([
        sendSettings ? updateSettings.mutateAsync(settingsBody) : Promise.resolve(null),
        prefsBody ? updatePrefs.mutateAsync(prefsBody) : Promise.resolve(null),
      ]);
      if (savedSettings) {
        setBaseline(savedSettings);
        setDraft(toDraft(savedSettings));
      }
      if (savedPrefs) {
        const rows = mergePreferences(savedPrefs);
        setPrefBaseline(rows);
        setPrefDraft(rows);
      }
      setShowCardsError(false);
      push({ title: 'Settings saved', tone: 'success' });
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [saving, updateSettings, updatePrefs, push]);

  const discard = () => {
    const { baseline: b, prefBaseline: pb, draft: d } = latest.current;
    if (b) {
      if (d && d.theme !== b.theme) setTheme(b.theme);
      setDraft(toDraft(b));
    }
    if (pb) setPrefDraft(pb);
    setShowCardsError(false);
    setSaveError(null);
  };

  // Ctrl/Cmd+S saves (KB K5).
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Unsaved-changes guard when leaving the app (reload, close tab).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const campaigns = campaignsQuery.data ?? [];
  const savedCampaignMissing =
    draft?.defaultCampaignId != null && !campaigns.some((c) => c.id === draft.defaultCampaignId);
  const cardsNumber = draft ? Number.parseInt(draft.cardsPerSession, 10) : NaN;
  const sliderValue = Number.isFinite(cardsNumber)
    ? Math.min(CARDS_PER_SESSION_MAX, Math.max(CARDS_PER_SESSION_MIN, cardsNumber))
    : baseline?.cardsPerSession ?? CARDS_PER_SESSION_MIN;
  const cardsInvalid = cardsError !== null && showCardsError;

  let body: ReactNode;
  if (settingsQuery.isError && !baseline) {
    body = (
      <InlineAlert
        title="We couldn't load your settings"
        onRetry={() => void settingsQuery.refetch()}
        retrying={settingsQuery.isFetching}
      >
        Your saved preferences haven't changed. {errorMessage(settingsQuery.error)}
      </InlineAlert>
    );
  } else if (!baseline || !draft) {
    body = <SettingsSkeleton />;
  } else {
    body = (
      <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <SettingsIndex />
        <div data-testid="settings-form-root" className="flex min-w-0 flex-col gap-6">
          {offline ? (
            <p data-testid="settings-offline-note" className="flex items-start gap-2 rounded-lg border border-border bg-card p-4 text-sm">
              <Icon name="cloudOff" size={20} />
              <span>
                <strong>You're offline.</strong> Settings are read-only, but theme changes still apply on this device.
              </span>
            </p>
          ) : null}
          {isUsingDefaults(baseline) ? (
            <p data-testid="settings-defaults-note" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="info" size={16} />
              Using defaults. You haven't saved any settings yet.
            </p>
          ) : null}
          {saveError ? (
            <InlineAlert title="We couldn't save your settings" onRetry={() => void save()} retrying={saving}>
              {saveError} Your changes are still here.
            </InlineAlert>
          ) : null}

          <SettingsSection
            id="settings-appearance"
            title="Appearance"
            description="Choose how the app looks and how much content fits on screen."
          >
            <SegmentedControl
              label="Theme"
              options={THEME_OPTIONS}
              value={draft.theme}
              onChange={changeTheme}
              description="Applies right away. System follows your device's light or dark setting."
            />
            <SegmentedControl
              label="Density"
              options={DENSITY_OPTIONS}
              value={draft.density}
              onChange={(density) => edit({ density })}
              disabled={offline}
            />
          </SettingsSection>

          <SettingsSection id="settings-motion" title="Motion" description="Control animation and state transitions.">
            <SegmentedControl
              label="Motion"
              options={MOTION_OPTIONS}
              value={draft.motion}
              onChange={(motion) => edit({ motion })}
              disabled={offline}
              description="System follows your device's reduced-motion setting. Full never overrides a device that asks for reduced motion."
            />
          </SettingsSection>

          <SettingsSection id="settings-review" title="Review" description="Set defaults for your review sessions.">
            <fieldset disabled={offline} className="flex flex-col gap-4">
              <legend className="sr-only">Review defaults</legend>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={campaignId} className="text-sm font-medium">
                  Default campaign
                </label>
                <select
                  id={campaignId}
                  data-testid="settings-review-default-campaign"
                  className={FIELD_CLASS}
                  value={draft.defaultCampaignId ?? ''}
                  onChange={(e) => edit({ defaultCampaignId: e.target.value === '' ? null : e.target.value })}
                >
                  <option value="">No default campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {savedCampaignMissing ? (
                    <option value={draft.defaultCampaignId ?? ''}>
                      {campaignsQuery.isPending ? 'Loading campaigns…' : 'Saved campaign (no longer listed)'}
                    </option>
                  ) : null}
                </select>
                {campaignsQuery.isError ? (
                  <p className="text-sm text-muted-foreground">Campaigns couldn't be loaded. Your saved default is kept.</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={assetTypeId} className="text-sm font-medium">
                  Default asset type
                </label>
                <select
                  id={assetTypeId}
                  data-testid="settings-review-default-asset-type"
                  className={FIELD_CLASS}
                  value={draft.defaultAssetType ?? ''}
                  onChange={(e) =>
                    edit({ defaultAssetType: e.target.value === '' ? null : (e.target.value as AssetType) })
                  }
                >
                  <option value="">All types</option>
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ASSET_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={cardsId} className="text-sm font-medium">
                  Cards per session
                </label>
                <div className="flex max-w-md items-center gap-3">
                  <input
                    ref={cardsRef}
                    id={cardsId}
                    type="number"
                    inputMode="numeric"
                    min={CARDS_PER_SESSION_MIN}
                    max={CARDS_PER_SESSION_MAX}
                    step={1}
                    data-testid="settings-review-cards-per-session"
                    className={`${FIELD_CLASS} w-24 shrink-0`}
                    value={draft.cardsPerSession}
                    aria-invalid={cardsInvalid}
                    aria-describedby={cardsInvalid ? `${cardsHelpId} ${cardsErrorId}` : cardsHelpId}
                    onChange={(e) => edit({ cardsPerSession: e.target.value })}
                    onBlur={() => setShowCardsError(true)}
                  />
                  <input
                    type="range"
                    aria-label="Cards per session slider"
                    min={CARDS_PER_SESSION_MIN}
                    max={CARDS_PER_SESSION_MAX}
                    step={1}
                    value={sliderValue}
                    onChange={(e) => edit({ cardsPerSession: e.target.value })}
                    className="min-h-[44px] flex-1 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </div>
                <p id={cardsHelpId} className="text-sm text-muted-foreground">
                  Choose {CARDS_PER_SESSION_MIN} to {CARDS_PER_SESSION_MAX} cards per session.
                </p>
                {cardsInvalid ? (
                  <p id={cardsErrorId} data-testid="settings-review-cards-error" className="text-sm font-medium text-destructive">
                    {cardsError}
                  </p>
                ) : null}
              </div>

              <SettingsSwitch
                label="Show keyboard hints"
                description="Show shortcut keys on review cards."
                checked={draft.showKeyboardHints}
                disabled={offline}
                testId="settings-review-keyboard-hints"
                onChange={(showKeyboardHints) => edit({ showKeyboardHints })}
              />
            </fieldset>
          </SettingsSection>

          <SettingsSection
            id="settings-notifications"
            title="Notifications"
            description="Choose which events you hear about. Slack, Teams and webhook delivery are coming later."
          >
            {prefsQuery.isError && !prefDraft ? (
              <InlineAlert
                title="We couldn't load your notification preferences"
                onRetry={() => void prefsQuery.refetch()}
                retrying={prefsQuery.isFetching}
              >
                {errorMessage(prefsQuery.error)}
              </InlineAlert>
            ) : prefDraft ? (
              <NotificationPrefsTable
                rows={prefDraft}
                disabled={offline}
                onToggleChannel={(eventType: NotificationEventType, channel: NotificationChannel) => {
                  setPrefDraft((rows) => (rows ? toggleChannel(rows, eventType, channel) : rows));
                  setSaveError(null);
                }}
                onToggleDigest={(eventType: NotificationEventType) => {
                  setPrefDraft((rows) => (rows ? toggleDigest(rows, eventType) : rows));
                  setSaveError(null);
                }}
              />
            ) : (
              <SkeletonGroup label="Loading notification preferences" lines={4} />
            )}
          </SettingsSection>

          <SettingsSection id="settings-about" title="About" description="Your account and access.">
            {meQuery.data ? (
              <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted-foreground">Signed in as</dt>
                <dd>
                  <span className="font-medium">{meQuery.data.displayName}</span>{' '}
                  <span className="text-muted-foreground">({meQuery.data.email})</span>
                </dd>
                <dt className="text-muted-foreground">Roles</dt>
                <dd data-testid="settings-about-roles">{meQuery.data.roles.join(', ') || 'None'}</dd>
              </dl>
            ) : meQuery.isError ? (
              <p className="text-sm text-muted-foreground">Account details are unavailable.</p>
            ) : (
              <SkeletonGroup label="Loading account" lines={2} />
            )}
          </SettingsSection>

          {dirty ? (
            <SettingsFooter saving={saving} offline={offline} onSave={() => void save()} onDiscard={discard} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section data-testid="settings-page-root" aria-labelledby={`${ids}-title`} className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Your preferences</p>
        <h1 id={`${ids}-title`} className="text-2xl font-bold">
          Settings
        </h1>
        <p className="text-muted-foreground">Make Semantic Ground Truth work the way you do.</p>
      </header>
      {body}
      <ToastRegion toasts={toasts} onDismiss={dismiss} label="Settings status" />
    </section>
  );
}

export default SettingsPage;
