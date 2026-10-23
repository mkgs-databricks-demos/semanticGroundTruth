// client/src/lib/api/keys.ts — query key factory for React Query v5
// Session 10 · Wave 3 · No enum, no namespace, no default export

export const queryKeys = {
  me: ['me'] as const,
  nextCard: (params?: Record<string, unknown>) =>
    ['review', 'next', params] as const,
  userStats: ['review', 'stats', 'me'] as const,
  leaderboard: (params?: Record<string, unknown>) =>
    ['leaderboard', params] as const,
  assets: (params?: Record<string, unknown>) =>
    ['assets', params] as const,
  asset: (id: string) => ['assets', id] as const,
  assetVersions: (id: string) => ['assets', id, 'versions'] as const,
  campaigns: (params?: Record<string, unknown>) =>
    ['campaigns', params] as const,
  campaign: (id: string) => ['campaigns', id] as const,
  notifications: (params?: Record<string, unknown>) =>
    ['notifications', params] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  preferences: ['notifications', 'preferences'] as const,
  adminConfig: ['admin', 'config'] as const,
  executiveSummary: ['admin', 'summary'] as const,
  metricViews: (params?: Record<string, unknown>) =>
    ['metric-views', params] as const,
  metricView: (name: string) => ['metric-views', name] as const,

  // Catalog browse
  catalogs: ['catalog', 'catalogs'] as const,
  catalogSchemas: (catalog: string) => ['catalog', 'schemas', catalog] as const,
  catalogMetricViews: (catalog: string, schema: string) =>
    ['catalog', 'metric-views', catalog, schema] as const,

  // Asset sources
  sources: ['sources'] as const,

  // Admin groups
  adminGroups: ['admin', 'groups'] as const,
} as const;
