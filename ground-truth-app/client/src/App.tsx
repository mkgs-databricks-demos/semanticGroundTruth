// @a11y-strict
// client/src/App.tsx — router + shell
// Session 16 · Wave 0 · Per-route document.title via loader
// Session 49 · Build 5 · wave 5-1: /settings and the three steward triage
// routes (placeholders until sessions 52 / 55); /steward/**, /executive,
// /admin and /settings are lazy chunks behind a page skeleton; S11 not-found
// and app-error (router errorElement); ThemeSync in the router root.

import { lazy, Suspense, useEffect } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  useMatches,
} from 'react-router';
import type { RouteObject } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { RouteFallback } from './components/layout/RouteFallback';
import { ThemeSync } from './lib/settings/ThemeSync';
import { ReviewPage } from './pages/review/ReviewPage';
import { LeaderboardPage } from './pages/leaderboard/LeaderboardPage';
import { AgentChat } from './pages/agents/AgentChat';
import { NotFound } from './pages/fallback/NotFoundPage';
import { RouteErrorPage } from './pages/fallback/AppErrorPage';

export const APP_TITLE = 'Semantic Ground Truth';

// Lazy chunks: steward, executive, admin and settings are not on the reviewer path.
const StewardPage = lazy(() => import('./pages/steward/StewardPage').then((m) => ({ default: m.StewardPage })));
const FeedbackQueuePage = lazy(() =>
  import('./pages/steward/FeedbackQueuePage').then((m) => ({ default: m.FeedbackQueuePage })),
);
const ConflictsPage = lazy(() => import('./pages/steward/ConflictsPage').then((m) => ({ default: m.ConflictsPage })));
const FeedbackBranchesPage = lazy(() =>
  import('./pages/steward/FeedbackBranchesPage').then((m) => ({ default: m.FeedbackBranchesPage })),
);
const ExecutivePage = lazy(() => import('./pages/executive/ExecutivePage').then((m) => ({ default: m.ExecutivePage })));
const AdminPage = lazy(() => import('./pages/admin/AdminPage').then((m) => ({ default: m.AdminPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function lazyPage(Page: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Page />
    </Suspense>
  );
}

/** Sets document.title based on the deepest matched route's handle.title. */
function PageTitle() {
  const matches = useMatches();
  useEffect(() => {
    const last = [...matches].reverse().find(
      (m) => (m.handle as { title?: string } | undefined)?.title,
    );
    const page = (last?.handle as { title?: string } | undefined)?.title;
    document.title = page ? `${page} \u00b7 ${APP_TITLE}` : APP_TITLE;
  }, [matches]);
  return null;
}

/** Route table (exported so tests can mount it in a memory router). */
export const appRoutes: RouteObject[] = [
  {
    element: (
      <>
        <PageTitle />
        <ThemeSync />
        <AppLayout />
      </>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <ReviewPage />, handle: { title: 'Review' } },
      { path: '/leaderboard', element: <LeaderboardPage />, handle: { title: 'Leaderboard' } },
      { path: '/assistant', element: <AgentChat />, handle: { title: 'Assistant' } },
      { path: '/steward', element: lazyPage(StewardPage), handle: { title: 'Steward' } },
      { path: '/steward/feedback-queue', element: lazyPage(FeedbackQueuePage), handle: { title: 'Feedback queue' } },
      { path: '/steward/conflicts', element: lazyPage(ConflictsPage), handle: { title: 'Conflicts' } },
      { path: '/steward/feedback-branches', element: lazyPage(FeedbackBranchesPage), handle: { title: 'Feedback branches' } },
      { path: '/executive', element: lazyPage(ExecutivePage), handle: { title: 'Executive' } },
      { path: '/admin', element: lazyPage(AdminPage), handle: { title: 'Admin' } },
      { path: '/settings', element: lazyPage(SettingsPage), handle: { title: 'Settings' } },
      { path: '*', element: <NotFound />, handle: { title: 'Page not found' } },
    ],
  },
];

const router = createBrowserRouter(appRoutes);

export default function App() {
  return <RouterProvider router={router} />;
}
