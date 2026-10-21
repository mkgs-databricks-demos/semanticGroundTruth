// client/src/lib/api/index.ts — barrel re-export
// Session 10 · Wave 3 · No enum, no namespace, no default export

export { ApiError, apiGet, apiSend } from './http';
export { queryKeys } from './keys';
export * from './endpoints';
export * from './hooks';
export { createQueryClient } from './queryClient';
export { hasRole } from './roles';
