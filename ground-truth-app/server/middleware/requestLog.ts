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

      logger.info('request', {
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
