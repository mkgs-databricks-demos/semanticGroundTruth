# Session 64: Manual acceptance (owner checks recorded)

**Build 5 · wave `5-11` · edit (alone)** · owner decision D-B5-2: manual checks are the final wave.

## How this wave runs

The wave has a manual prerequisite `M5`: the owner fills every `result` cell in `docs/sessions/build-5_manual_checks.md` (written by session 63) and pushes it to `mg-genie-build-5`. On the first build run this prerequisite is normally `missing`, so the wave fails by design and the build stops here. After the owner records the results, start a **new run** of the build job with `only` = the `w5-11_*` task keys (a repair does not re-run a finished iteration; see the genie-build-waves README "Why not repair?").

## Steps

1. Read `docs/sessions/build-5_manual_checks.md`. If any `result` is blank, stop with `status: "blocked"`, `blocking: ["M5: manual checks not recorded"]`.
2. For each row with `result = fail`: if the fix is client-only and small (copy, focus ring, contrast within existing tokens, missing label), fix it in `ground-truth-app/client/**`, run vitest + both `tsc -b` in `/tmp/gt-64/`, and note that a redeploy is needed (this edit session does not deploy). Otherwise add it to `docs/requests/<today>_build-5-follow-ups.md`.
3. Append a "Manual acceptance" section to the build-5 summary: pass/fail counts per check, Lighthouse scores, fixes made, follow-ups.
4. Set the final status: `pass` only if every row is `pass` or has a fix committed here or a follow-up filed with the owner's `accept` note in the worksheet.

## Owned paths

* `ground-truth-app/client/**`
* `docs/sessions/**`, `docs/requests/**`

## Dependencies

63
