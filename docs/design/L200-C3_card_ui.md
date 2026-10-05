# L200-C3 — Card UI

## Component Design Document

**Component:** C3 — Card UI
**Type:** React components
**Owner:** TBD
**References:** L100 § UX Pattern: Tinder-Style Card Swipe, § Dual Interface Architecture

---

### Overview

The Card UI is the React frontend for the standalone Databricks App. It implements the Tinder-style card-swipe interaction pattern with progressive disclosure, synonym chips, "Use It in a Sentence" examples, gamification elements, and admin/executive views.

### Dependencies

| Dependency | Type | Description |
|---|---|---|
| C2 Review Engine | API | All data flows through the Review Engine REST API |
| React | Framework | Component library and rendering |
| Databricks AppKit | Runtime | App hosting, auth token forwarding |

### Design

#### Component Hierarchy

```
<App>
  <AuthProvider>           // OBO token management
  <ThemeProvider>           // Light/dark mode
  <Router>
    <ReviewView>           // Primary card-swipe experience
      <CardStack>
        <ReviewCard>
          <AssetBadge />       // Measure | Dimension | Page | Domain | Subdomain
          <AssetName />
          <DescriptionEditor />
          <SynonymChips />     // Green toggle chips + add button
          <Accordion>          // Progressive disclosure
            <LogicView />      // Plain English + SQL side-by-side
            <SourceInfo />
            <SampleQuery />    // "Run a common aggregation" button
          </Accordion>
          <ExampleQuestions />  // "Use It in a Sentence" section
        </ReviewCard>
      </CardStack>
      <SwipeActions />         // Approve ✅ | Reject ❌ | Edit ✏️
      <ProgressBar />          // "47 of 120 reviewed"
    </ReviewView>
    <LeaderboardView>        // Gamification
    <AdminView>              // Campaign config, RBAC, thresholds
      <CampaignManager />
      <RBACConfig />
      <ThresholdConfig />
      <FreshnessConfig />
    </AdminView>
    <StewardView>            // Triage queue, conflict resolution
      <FeedbackQueue />
      <ConflictResolver />
      <BranchReview />
    </StewardView>
    <ExecutiveView>          // Dashboards
      <CoverageDashboard />
      <ConfidenceTrends />
      <ParticipationMetrics />
    </ExecutiveView>
  </Router>
```

#### Card Swipe Interaction

- **Swipe right / tap ✅:** Approve — records approval vote
- **Swipe left / tap ❌:** Reject — opens feedback text input (required), then records rejection
- **Tap ✏️:** Edit mode — description becomes editable, synonym chips become interactive, then approve with edits
- **Swipe animation:** Card slides off-screen with spring physics; next card slides in from below

#### Synonym Chips

```
[Admin PMPM ✓] [Administrative Cost ✓] [Admin Per Member ✓] [+ Add]
```

- Green = active (approved by default)
- Gray = deselected by this user
- Tap to toggle
- "+" opens a text input to add a new synonym

#### Progressive Disclosure (Accordion)

Default: collapsed. User taps to expand.

**Logic View:**
- Left panel: Plain English explanation (AI-generated, editable by technical users)
- Right panel: Actual SQL/YAML expression (read-only for most users, editable for technical users who self-select)

**Sample Query:**
- Button: "Run a common aggregation"
- Shows loading spinner while query executes (< 30s)
- Displays result table (max 100 rows) with column headers
- Error state if warehouse unavailable (card still functional)

#### "Use It in a Sentence"

```
Example questions for "Admin PMPM":
  [✅ ❌] "What was the Admin PMPM for Q3 across all commercial plans?"
  [✅ ❌] "Compare Admin PMPM by region for the last 12 months"
  [+ Add your own example question]
```

- Pre-seeded examples shown first
- User-contributed examples shown below
- Each example has its own approve/reject mini-vote
- Add button opens text input

### Non-Functional Requirements

| NFR | Target | Notes |
|---|---|---|
| First contentful paint | < 1.5s | App shell renders immediately |
| Card render | < 500ms p95 | After API response received |
| Swipe animation | 60fps | Spring physics, no jank |
| Mobile responsive | Yes | Card-swipe is inherently mobile-friendly |
| Accessibility | WCAG 2.1 AA | Keyboard navigation, screen reader support |
| Bundle size | < 500KB gzipped | Code splitting for admin/executive views |

### Testing

- **Component tests:** Each React component renders correctly with mock data
- **Interaction tests:** Swipe gestures, chip toggles, accordion expand/collapse, form submissions
- **Responsive tests:** Card layout at mobile, tablet, desktop breakpoints
- **Accessibility tests:** Keyboard navigation through all interactive elements
- **Visual regression tests:** Screenshot comparison for card states (approve, reject, edit, loading, error)

### Deployment

- Bundled as part of Bundle 2 (App) — React frontend served by Node.js AppKit
- Static assets served from the app's `/frontend` directory
- Code-split: admin and executive views loaded on demand

### Resolved Questions

1. ✅ **Swipe library: framer-motion.** Best DX for card-swipe animations, built-in gesture support. Bundle size mitigated by code-splitting (admin/executive views lazy-loaded).
2. ✅ **No offline support for V1.** OBO auth + Lakebase writes require network. Defer to V2 if mobile/field use cases emerge.
3. ✅ **Keyboard shortcuts ship with V1:** `A` = Approve, `R` = Reject (opens feedback), `E` = Edit mode, `→`/`←` = Swipe right/left, `Space` = Toggle accordion, `Tab` = Next synonym chip.
4. ✅ **Fixed direction:** Right = approve, left = reject. Universal Tinder convention — no configuration needed. ✅/❌ buttons always available as alternative.

> See [docs/diagrams/mermaid/08_dual_interface_architecture.md] for how the Card UI shares the Review Engine with the MCP Server.
