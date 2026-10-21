import type { UserContext } from '../lib/context';

declare global {
  namespace Express {
    interface Locals {
      user?: UserContext;
      requestId?: string;
      otelAttributes?: Record<string, string | number | boolean>;
    }
  }
}

export {};
