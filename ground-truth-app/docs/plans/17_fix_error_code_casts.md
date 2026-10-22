# Session 17: Fix ErrorCode casts and UPSTREAM mismatch (Wave 6)

## Scope
Remove all `as ErrorCode` type-assertion casts in `server/lib/errors.ts` that were added as workarounds before `shared/contracts/errors.ts` existed. Fix the real bug they hide: `'UPSTREAM'` is not a valid `ErrorCode` — the contract defines `'UPSTREAM_ERROR'`.

## Context
* `shared/contracts/errors.ts` (session 01) defines `ErrorCode` as a union of 7 literal strings: `BAD_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UPSTREAM_ERROR`, `INTERNAL`.
* `server/lib/errors.ts` (session 02) was written before session 01 completed. It imports `ErrorCode` and `ERROR_STATUS` from the contract, but lines 25–30 use `as ErrorCode` casts on the factory calls to suppress errors. Line 30 uses `'UPSTREAM'` instead of `'UPSTREAM_ERROR'`. Line 79–80 in `toAppError` has another cast on `'INTERNAL'`.
* Both files exist on main (PR #4 merged). The casts now hide a real bug: `'UPSTREAM'` is not in the `ERROR_CODES` array, so `ERROR_STATUS['UPSTREAM']` returns `undefined` and falls through to the `?? 500` default — the intent was HTTP 502.

## Known issues
* 7 `as ErrorCode` casts total: lines 25, 26, 27, 28, 29, 30, 80.
* Line 30: `'UPSTREAM' as ErrorCode` → must become `'UPSTREAM_ERROR'`.
* Lines 25–29, 80: cast is unnecessary now that the contract exists — remove the cast, leave the string literal. These are already valid `ErrorCode` values.
* Verify the file still compiles in isolation after fixes: all 6 factory string literals must be members of `ErrorCode`, and `'INTERNAL'` on line 80 must also be valid.

## Tasks
1. Read `shared/contracts/errors.ts` — confirm `ErrorCode` includes all 7 values.
2. Read `server/lib/errors.ts` — confirm the `as ErrorCode` locations.
3. Remove `as ErrorCode` from lines 25–30 (factory calls) and line 80 (`toAppError`).
4. Change `'UPSTREAM'` to `'UPSTREAM_ERROR'` on line 30.
5. Verify every string literal passed to `factory()` or `new AppError()` is a member of `ErrorCode`.
6. Run `bundle validate --strict --target dev`.

## Acceptance Criteria
- [ ] No `as ErrorCode` cast remains in `server/lib/errors.ts`.
- [ ] The string `'UPSTREAM'` does not appear anywhere in the file; `'UPSTREAM_ERROR'` is used instead.
- [ ] Every `factory()` call uses a string literal that is a member of the `ErrorCode` union.
- [ ] `bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/lib/errors.ts`

## Dependencies
- Session 01 (shared/contracts/errors.ts — already on main).
- Session 02 (server/lib/errors.ts — already on main).
