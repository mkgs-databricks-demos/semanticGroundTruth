# Session 17: Fix ErrorCode casts and UPSTREAM mismatch (Wave 6)

**Date:** 2026-10-21  
**Run ID:** 963652240700815  
**Prior Run:** 294202284707072 (originally applied the fixes)  
**Mode:** edit  
**Status:** pass (already completed)  

## Problem

`server/lib/errors.ts` contained 7 `as ErrorCode` type-assertion casts (lines 25–30 and 80) that were added as workarounds before `shared/contracts/errors.ts` existed. These casts hid a real bug: line 30 used the string `'UPSTREAM'`, which is not a member of the `ErrorCode` union — the contract defines `'UPSTREAM_ERROR'`. This caused `ERROR_STATUS['UPSTREAM']` to return `undefined`, falling through to the `?? 500` default instead of the intended HTTP 502.

## Root Cause

Session 02 (server foundation) was written before session 01 (shared contracts) completed in the original build. The `as ErrorCode` casts suppressed type errors at the cost of hiding the `UPSTREAM` vs `UPSTREAM_ERROR` mismatch.

## Changes

No changes needed — fixes were already applied in run 294202284707072 and merged via PR #4. Re-validated the file in its current state.

## Decisions

* File already in desired state; no edits required.
* Re-ran all acceptance criteria checks to confirm.

## Checks

| Check | Result |
| --- | --- |
| No `as ErrorCode` cast in `server/lib/errors.ts` | pass |
| No bare `'UPSTREAM'` string (only `'UPSTREAM_ERROR'`) | pass |
| All factory literals are valid `ErrorCode` members | pass |
| `bundle validate --strict --target dev` | pass |

## Requests

None.
