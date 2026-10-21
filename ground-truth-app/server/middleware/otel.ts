import type { RequestHandler, Response } from 'express';

export function otelAttributesMiddleware(): RequestHandler {
  return (req, res, next) => {
    res.locals.otelAttributes = {
      'gt.user_id': '',
      'gt.source': '',
      'http.route': req.route?.path ?? req.path,
    };
    next();
  };
}

export function addSpanAttributes(
  res: Response,
  attrs: Record<string, string | number | boolean>,
): void {
  if (!res.locals.otelAttributes) {
    res.locals.otelAttributes = {};
  }
  Object.assign(res.locals.otelAttributes, attrs);
}
