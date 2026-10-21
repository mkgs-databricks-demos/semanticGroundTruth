// ErrorCode and ERROR_STATUS are defined in shared/contracts/errors.ts (session 01).
// Session 01 did not complete in this run; these imports will resolve once it does.
import type { ErrorCode } from '../../shared/contracts/errors';
import { ERROR_STATUS } from '../../shared/contracts/errors';

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code] ?? 500;
    this.details = details;
  }
}

function factory(code: ErrorCode) {
  return (message: string, details?: Record<string, unknown>): AppError =>
    new AppError(code, message, details);
}

export const badRequest = factory('BAD_REQUEST' as ErrorCode);
export const unauthenticated = factory('UNAUTHENTICATED' as ErrorCode);
export const forbidden = factory('FORBIDDEN' as ErrorCode);
export const notFound = factory('NOT_FOUND' as ErrorCode);
export const conflict = factory('CONFLICT' as ErrorCode);
export const upstream = factory('UPSTREAM' as ErrorCode);

interface ZodIssue {
  path: (string | number)[];
  message: string;
}

interface ZodError {
  name: string;
  issues: ZodIssue[];
}

interface PgError {
  code?: string;
  message?: string;
}

function isZodError(err: unknown): err is ZodError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as ZodError).name === 'ZodError' &&
    Array.isArray((err as ZodError).issues)
  );
}

function isPgError(err: unknown): err is PgError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as PgError).code === 'string'
  );
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }
  if (isZodError(err)) {
    return badRequest('Validation failed', { issues: err.issues });
  }
  if (isPgError(err)) {
    if (err.code === '23505') {
      return conflict(err.message ?? 'Unique constraint violation');
    }
    if (err.code === '23503') {
      return badRequest(err.message ?? 'Foreign key constraint violation');
    }
  }
  return new AppError(
    'INTERNAL' as ErrorCode,
    'An unexpected error occurred',
  );
}
