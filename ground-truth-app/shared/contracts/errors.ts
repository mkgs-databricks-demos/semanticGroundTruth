// shared/contracts/errors.ts — error codes, HTTP status map, and response shape
// Session 01 · Wave 0 · No enum, no namespace, no default export

export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'SOURCE_ACCESS_DENIED',
  'UPSTREAM_ERROR',
  'INTERNAL',
  // Build 5 (session 44): Share to Slack. RATE_LIMITED = Unity Gateway / Slack 429
  // (session 50); NOT_IMPLEMENTED = a contracted route whose handler is a stub.
  'RATE_LIMITED',
  'NOT_IMPLEMENTED',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SOURCE_ACCESS_DENIED: 403,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
  RATE_LIMITED: 429,
  NOT_IMPLEMENTED: 501,
};

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}
