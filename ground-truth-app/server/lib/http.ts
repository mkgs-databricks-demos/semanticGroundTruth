import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { toAppError, badRequest } from './errors';
import { logger } from './logger';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch((err: unknown) => {
      sendError(res, err);
      next();
    });
  };
}

export function sendError(res: Response, err: unknown): void {
  const appErr = toAppError(err);
  const requestId = (res.req?.headers?.['x-request-id'] as string) ?? '';

  if (appErr.status >= 500) {
    // When toAppError wrapped an unknown error, log the original cause so the
    // generic client-facing message does not hide the root cause in telemetry.
    const cause = appErr !== err && err instanceof Error ? err : undefined;
    logger.error(appErr.message, {
      code: appErr.code,
      status: appErr.status,
      'x-request-id': requestId,
      stack: cause?.stack ?? appErr.stack,
      ...(cause
        ? {
            cause: cause.message,
            causeCode: (cause as { code?: unknown }).code,
          }
        : {}),
    });
  }

  const body: ErrorResponse = {
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details ? { details: appErr.details } : {}),
    },
  };

  if (!res.headersSent) {
    res.status(appErr.status).json(body);
  }
}

export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest('Invalid request body', { issues: result.error.issues });
  }
  return result.data as z.infer<S>;
}

export function parseQuery<S extends z.ZodTypeAny>(schema: S, query: unknown): z.infer<S> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw badRequest('Invalid query parameters', { issues: result.error.issues });
  }
  return result.data as z.infer<S>;
}
