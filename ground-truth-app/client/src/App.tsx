// client/src/App.tsx — router + shell
// Session 16 · Wave 0 · Per-route document.title via loader

import { useEffect } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  useMatches,
} from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { ReviewPage } from './pages/review/ReviewPage';
import { LeaderboardPage } from './pages/leaderboard/LeaderboardPage';
import { StewardPage } from './pages/steward/StewardPage';
import { AdminPage } from './pages/admin/AdminPage';
import { ExecutivePage } from './pages/executive/ExecutivePage';
import { AgentChat } from './pages/agents/AgentChat';

const APP_TITLE = 'Semantic Ground Truth';

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

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-2xl font-bold text-foreground">404</h2>
      <p className="text-muted-foreground mt-2">Page not found.</p>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: (
      <>
        <PageTitle />
        <AppLayout />
      </>
    ),
    children: [
      { path: '/', element: <ReviewPage />, handle: { title: 'Review' } },
      { path: '/leaderboard', element: <LeaderboardPage />, handle: { title: 'Leaderboard' } },
      { path: '/steward', element: <StewardPage />, handle: { title: 'Steward' } },
      { path: '/admin', element: <AdminPage />, handle: { title: 'Admin' } },
      { path: '/executive', element: <ExecutivePage />, handle: { title: 'Executive' } },
      { path: '/assistant', element: <AgentChat />, handle: { title: 'Assistant' } },
      { path: '*', element: <NotFound />, handle: { title: '404' } },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
