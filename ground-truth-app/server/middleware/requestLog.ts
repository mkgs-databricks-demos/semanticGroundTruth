import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger';

export function requestLogMiddleware(): RequestHandler {
  return (req, res, next) => {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    res.locals.requestId = requestId;

    const start = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const user = res.locals.user;
      const otelAttributes = res.locals.otelAttributes ?? {};

      // 5xx responses log at level "error" so the build-waves runtime gate's
      // `"level":"error"` error_pattern counts them (docs/plans/waves.json).
      const log = res.statusCode >= 500 ? logger.error : logger.info;
      log('request', {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
        requestId,
        userId: user?.userId,
        source: user?.source,
        ...otelAttributes,
      });
    });

    next();
  };
}
