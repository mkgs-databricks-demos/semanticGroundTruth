// client/src/App.tsx — router + shell
// Session 12 · Wave 4 · No enum, no namespace, no default export

import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { ReviewPage } from './pages/review/ReviewPage';
import { LeaderboardPage } from './pages/leaderboard/LeaderboardPage';
import { StewardPage } from './pages/steward/StewardPage';
import { AdminPage } from './pages/admin/AdminPage';
import { ExecutivePage } from './pages/executive/ExecutivePage';
import { AgentChat } from './pages/agents/AgentChat';

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
    element: <AppLayout />,
    children: [
      { path: '/', element: <ReviewPage /> },
      { path: '/leaderboard', element: <LeaderboardPage /> },
      { path: '/steward', element: <StewardPage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '/executive', element: <ExecutivePage /> },
      { path: '/assistant', element: <AgentChat /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
