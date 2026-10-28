// @a11y-strict
// client/src/pages/settings/SettingsPage.tsx — S7 Settings `/settings` (placeholder)
// Session 49 · Build 5 · wave 5-1: route + lazy chunk + final export name.
// Session 52 replaces the body with the real screen (screen_inventory.md S7).

export function SettingsPage() {
  return (
    <section data-testid="settings-placeholder-root" className="mx-auto flex max-w-3xl flex-col gap-2">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Appearance, review and notification settings will appear here.</p>
    </section>
  );
}

export default SettingsPage;
