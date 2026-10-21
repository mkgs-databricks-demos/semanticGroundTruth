# Session 17: Fix ErrorCode casts and UPSTREAM mismatch (Wave 6)

**Date:** 2026-10-21  
**Run ID:** 294202284707072  
**Mode:** edit  
**Status:** pass  

## Problem

`server/lib/errors.ts` contained 7 `as ErrorCode` type-assertion casts (lines 25–30 and 80) that were added as workarounds before `shared/contracts/errors.ts` existed. These casts hid a real bug: line 30 used the string `'UPSTREAM'`, which is not a member of the `ErrorCode` union — the contract defines `'UPSTREAM_ERROR'`. This caused `ERROR_STATUS['UPSTREAM']` to return `undefined`, falling through to the `?? 500` default instead of the intended HTTP 502.

## Root Cause

Session 02 (server foundation) was written before session 01 (shared contracts) completed in the original build. The `as ErrorCode` casts suppressed type errors at the cost of hiding the `UPSTREAM` vs `UPSTREAM_ERROR` mismatch.

## Changes

| File | Change |
| --- | --- |
| `server/lib/errors.ts` | Removed `as ErrorCode` from 6 factory calls (lines 25–30) and 1 `new AppError()` call (line 80). Changed `'UPSTREAM'` to `'UPSTREAM_ERROR'` on line 30. |

## Decisions

* Left the `as ZodError` and `as PgError` type guards untouched — those are correct narrowing patterns, not workaround casts.
* Left the lines 1–2 comments about session 01 untouched — they are outside the scope of this session and serve as historical context.

## Checks

| Check | Result |
| --- | --- |
| No `as ErrorCode` cast in `server/lib/errors.ts` | pass |
| No bare `'UPSTREAM'` string (only `'UPSTREAM_ERROR'`) | pass |
| All factory literals are valid `ErrorCode` members | pass |
| `bundle validate --strict --target dev` | pass |

## Requests

None.
