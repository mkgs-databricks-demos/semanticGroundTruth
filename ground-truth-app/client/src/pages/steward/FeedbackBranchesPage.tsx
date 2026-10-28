// @a11y-strict
// client/src/pages/steward/FeedbackBranchesPage.tsx — S10 Feedback branches `/steward/feedback-branches` (placeholder)
// Session 49 · Build 5 · wave 5-1: route + lazy chunk + final export name.
// Session 55 replaces the body with the real screen (screen_inventory.md S10).

export function FeedbackBranchesPage() {
  return (
    <section data-testid="steward-branches-placeholder-root" className="mx-auto flex max-w-5xl flex-col gap-2">
      <h1 className="text-2xl font-bold">Feedback branches</h1>
      <p className="text-muted-foreground">Branches opened by the feedback pipeline will appear here.</p>
    </section>
  );
}

export default FeedbackBranchesPage;
