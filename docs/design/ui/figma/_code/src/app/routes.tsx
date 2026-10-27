import { createBrowserRouter, Navigate } from 'react-router'
import ReviewPage from '../pages/ReviewPage'
import LeaderboardPage from '../pages/LeaderboardPage'
import AssistantPage from '../pages/AssistantPage'
import StewardPage from '../pages/StewardPage'
import FeedbackQueuePage from '../pages/FeedbackQueuePage'
import ConflictsPage from '../pages/ConflictsPage'
import FeedbackBranchesPage from '../pages/FeedbackBranchesPage'
import ExecutivePage from '../pages/ExecutivePage'
import AdminPage from '../pages/AdminPage'
import SettingsPage from '../pages/SettingsPage'
import DesignSystemPage from '../pages/DesignSystemPage'
import FallbackPages from '../pages/FallbackPages'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/review" replace /> },
  { path: '/review', Component: ReviewPage },
  { path: '/leaderboard', Component: LeaderboardPage },
  { path: '/assistant', Component: AssistantPage },
  { path: '/steward', Component: StewardPage },
  { path: '/steward/feedback-queue', Component: FeedbackQueuePage },
  { path: '/steward/conflicts', Component: ConflictsPage },
  { path: '/steward/feedback-branches', Component: FeedbackBranchesPage },
  { path: '/executive', Component: ExecutivePage },
  { path: '/admin', Component: AdminPage },
  { path: '/settings', Component: SettingsPage },
  { path: '/design-system', Component: DesignSystemPage },
  { path: '/app-error', element: <FallbackPages initialPage="app-error" /> },
  { path: '*', element: <FallbackPages initialPage="not-found" /> },
])
