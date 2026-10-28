// @a11y-strict
// client/src/pages/steward/FeedbackQueuePage.tsx — S8 Feedback queue `/steward/feedback-queue` (placeholder)
// Session 49 · Build 5 · wave 5-1: route + lazy chunk + final export name.
// Session 55 replaces the body with the real screen (screen_inventory.md S8).

export function FeedbackQueuePage() {
  return (
    <section data-testid="steward-queue-placeholder-root" className="mx-auto flex max-w-5xl flex-col gap-2">
      <h1 className="text-2xl font-bold">Feedback queue</h1>
      <p className="text-muted-foreground">Assets waiting for steward triage will appear here.</p>
    </section>
  );
}

export default FeedbackQueuePage;
