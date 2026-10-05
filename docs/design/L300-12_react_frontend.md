# L300-12 — React Frontend (Card UI, Admin, Executive Summary)

## Implementation Spec

**Phase:** 2 (Bundle 2 — App)
**Type:** Genie Code session + manual coding
**Prerequisites:** L300-10 complete (REST API exists)
**References:** L200-C3

---


> See [docs/diagrams/mermaid/08_dual_interface_architecture.md] for how the Card UI connects to the Review Engine.
### Step 1: Set up the React project

**Type:** Manual (terminal)

```bash
cd bundle-app/frontend

# If not already initialized by databricks apps init:
npx create-react-app . --template typescript
# Or if using Vite:
npm create vite@latest . -- --template react-ts

# Install dependencies
npm install framer-motion react-router-dom
npm install @tanstack/react-query  # For API data fetching
```

### Step 2: Create the component library

**Type:** Genie Code session

Prompt:
```
Create React components in bundle-app/frontend/src/components/:

1. ReviewCard/ReviewCard.tsx — The main card component:
   - AssetBadge (Measure|Dimension|Page|Domain|Subdomain)
   - AssetName
   - DescriptionEditor (editable text field)
   - SynonymChips (green toggle chips with add button)
   - Framer-motion swipe gestures (right=approve, left=reject)

2. ReviewCard/Accordion.tsx — Progressive disclosure:
   - LogicView (plain English left, SQL/YAML right)
   - SourceInfo
   - SampleQuery (with "Run" button and result table)

3. ReviewCard/ExampleQuestions.tsx — "Use It in a Sentence":
   - List of example questions with mini approve/reject
   - Add new question input

4. CardStack/CardStack.tsx — Stack of cards with swipe animation:
   - Current card on top
   - Next card peeking behind
   - Swipe animation with spring physics (framer-motion)

5. SwipeActions/SwipeActions.tsx — Approve/Reject/Edit buttons:
   - Keyboard shortcuts (A/R/E)
   - Visual feedback on swipe direction

6. Gamification/Leaderboard.tsx — Top reviewers table
7. Gamification/ProgressBar.tsx — "47 of 120 reviewed"
8. Gamification/StreakBadge.tsx — Current streak indicator
```

### Step 3: Create the page views

**Type:** Genie Code session

Prompt:
```
Create page views in bundle-app/frontend/src/pages/:

1. ReviewPage.tsx — Primary card-swipe experience
   - CardStack + SwipeActions + ProgressBar
   - Campaign selector dropdown
   - Asset type filter

2. LeaderboardPage.tsx — Gamification leaderboard
   - Top reviewers table
   - Personal stats card
   - Team competitions (if configured)

3. AdminPage.tsx — Admin configuration
   - Campaign manager (create, pause, archive)
   - RBAC configuration
   - Threshold configuration
   - Freshness interval settings
   - Gamification rewards configuration

4. StewardPage.tsx — Data Steward triage
   - Feedback queue (pending feature branches)
   - Conflict resolution view
   - Branch review links

5. ExecutiveSummaryPage.tsx — Summary cards
   - Coverage %, Certification %, Active Reviewers (cards)
   - Link to full AI/BI Dashboard
```

### Step 4: Set up routing and auth

**Type:** Genie Code session

Prompt:
```
Create the app shell in bundle-app/frontend/src/App.tsx:

1. AuthProvider — Reads OBO token from AppKit
2. ThemeProvider — Light/dark mode toggle
3. React Router with routes:
   /           → ReviewPage (default)
   /leaderboard → LeaderboardPage
   /admin      → AdminPage (admin role required)
   /steward    → StewardPage (steward role required)
   /executive  → ExecutiveSummaryPage
4. Navigation sidebar with role-based visibility
5. React Query provider for API data fetching
```

### Step 5: Build and verify

**Type:** Manual (terminal)

```bash
cd bundle-app/frontend
npm run build

# Verify the build output
ls -la build/
```

---

### Open Questions

1. **Frontend build integration:** How does the AppKit serve the React build? Is it a static file serve from `frontend/build/`, or does it need a specific configuration in `app.yml`?
