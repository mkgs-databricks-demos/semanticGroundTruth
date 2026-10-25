// server/lib/validate.ts — request validation middleware (plan 33, task 1)
// Session 33 · Wave 4-1 · No default export
//
// Every route is registered as
//   app.<method>(path, requireRoleMiddleware(role), validate(SPEC), asyncRoute(handler))
// where SPEC holds the zod schemas from shared/contracts (the same objects that
// ROUTE_CONTRACTS references). The handler reads the parsed input with
// validated(res, SPEC); no route parses req.body / req.query / req.params itself.
// server/routes/contracts.test.ts walks ROUTE_CONTRACTS against the Express
// router and checks the schemas and roles match.

import type { RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { badRequest } from './errors';
import { sendError } from './http';

export interface ValidationSpec {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

type Infer<T> = T extends z.ZodType ? z.output<T> : undefined;

/** Parsed request input for a spec (fields without a schema are undefined). */
export interface Validated<S extends ValidationSpec> {
  body: Infer<S['body']>;
  query: Infer<S['query']>;
  params: Infer<S['params']>;
}

/** The middleware carries its spec so tests can compare it with ROUTE_CONTRACTS. */
export type ValidateMiddleware = RequestHandler & { validation: ValidationSpec };

const PARTS = [
  ['params', 'Invalid path parameters'],
  ['query', 'Invalid query parameters'],
  ['body', 'Invalid request body'],
] as const;

const LOCALS_KEY = 'validated';

/**
 * Validate path params, query and body (in that order) against the spec.
 * On the first failure respond 400 `{error: {code: 'BAD_REQUEST', message,
 * details: {issues}}}` (the contract's error envelope; ERROR_CODES has no
 * separate VALIDATION code). Parsed values (with zod defaults and coercions
 * applied) are stored on res.locals for validated().
 */
export function validate<S extends ValidationSpec>(spec: S): ValidateMiddleware {
  const middleware: RequestHandler = (req, res, next) => {
    const parsed: Record<string, unknown> = {};
    for (const [part, message] of PARTS) {
      const schema = spec[part];
      if (!schema) continue;
      const input: unknown = req[part];
      const result = schema.safeParse(input ?? (part === 'body' ? {} : input));
      if (!result.success) {
        sendError(res, badRequest(message, { issues: result.error.issues }));
        return;
      }
      parsed[part] = result.data;
    }
    (res.locals as Record<string, unknown>)[LOCALS_KEY] = parsed;
    next();
  };
  return Object.assign(middleware, { validation: spec });
}

/** Parsed input stored by validate(spec). Pass the same spec object for typing. */
export function validated<S extends ValidationSpec>(res: Response, _spec: S): Validated<S> {
  const parsed = (res.locals as Record<string, unknown>)[LOCALS_KEY] as
    | Record<string, unknown>
    | undefined;
  return {
    body: parsed?.body,
    query: parsed?.query,
    params: parsed?.params,
  } as Validated<S>;
}

export function isValidateMiddleware(fn: unknown): fn is ValidateMiddleware {
  return typeof fn === 'function' && 'validation' in fn;
}
