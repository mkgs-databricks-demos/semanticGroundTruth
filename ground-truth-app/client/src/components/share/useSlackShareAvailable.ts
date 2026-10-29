// @a11y-strict
// client/src/components/share/useSlackShareAvailable.ts — may this user share to Slack?
// Session 56 · Build 5 · wave 5-3 (G5 Option A, plan 56 step 2)
//
// True only for steward/admin when GET /api/config reports slackShareEnabled.
// The config query waits for GET /api/me, so a reviewer never asks for it, and
// it shares the runtimeConfig cache entry with useRuntimeConfig (same key and
// queryFn). Call it where an action is rendered (per item), not at the shell
// level, so nothing is fetched until an item that could be shared is shown.

import { useQuery } from '@tanstack/react-query';
import { getRuntimeConfig } from '../../lib/api/endpoints';
import { useMe } from '../../lib/api/hooks';
import { queryKeys } from '../../lib/api/keys';
import { hasRole } from '../../lib/api/roles';

export function useSlackShareAvailable(): boolean {
  const me = useMe();
  const steward = hasRole(me.data, 'steward');
  const config = useQuery({
    queryKey: queryKeys.runtimeConfig,
    queryFn: getRuntimeConfig,
    staleTime: 5 * 60_000, // same as useRuntimeConfig
    enabled: steward,
  });
  return steward && config.data?.slackShareEnabled === true;
}
