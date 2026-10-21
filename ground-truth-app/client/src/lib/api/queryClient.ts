// client/src/lib/api/queryClient.ts — QueryClient factory
// Session 10 · Wave 3 · No enum, no namespace, no default export

import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './http';

/**
 * Create a configured `QueryClient`:
 * - No retry on 4xx errors (client mistakes should surface immediately).
 * - Up to 2 retries for other errors (server/network issues).
 * - Default `staleTime` of 30 s to reduce redundant fetches.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
