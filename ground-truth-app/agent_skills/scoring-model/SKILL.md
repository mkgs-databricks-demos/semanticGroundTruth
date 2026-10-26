---
name: scoring-model
description: How confidence scores are computed using the Wilson lower bound, industry prior, and certification threshold. Includes a worked example.
---

# Scoring Model

Every asset in the Ground Truth catalogue has a **confidence score**
reflecting how much the crowd trusts its definition. The score is the
lower bound of a Wilson score interval — a statistical measure that
accounts for sample size.

## Wilson Lower Bound

Given `p` (observed approval rate) and `n` (total votes), the Wilson
lower bound at confidence level z (default 1.96 for 95%) is:

    lower = (p + z²/2n − z × √(p(1−p)/n + z²/4n²)) / (1 + z²/n)

This yields a conservative estimate that rises as votes accumulate
and the approval rate stays high. It protects against small-sample
overconfidence: even 100% approval among 3 voters produces a modest
score.

## Edits Count as Half-Approvals

An "edit" vote means "this is mostly right". The scoring model counts
each edit as 0.5 approvals:

    effective_positives = approvals + 0.5 × edits

## Industry Prior and Decay

To avoid wild swings early on, a configurable industry prior (default 0.5)
adds virtual votes that bias the score towards the prior rate:

    w = prior_weight × (1 − total / decay_threshold)

Defaults: `prior_weight = 4`, `decay_threshold = 30`.

When `total ≥ decay_threshold`, w = 0 and the prior vanishes entirely.
Otherwise the prior blends in:

    adjusted_positives = effective_positives + industry_prior × w
    adjusted_total     = total + w

The Wilson bound is then computed on (adjusted_positives, adjusted_total).

## Certification

An asset becomes **CERTIFIED** when both conditions hold:

1. `wilson_lower_bound ≥ certification_threshold` (default 0.80)
2. `total_votes ≥ min_votes_for_certification` (default 5)

Below that, it is **REVIEWED** (≥ 1 vote) or **PENDING** (no votes).

## Worked Example: 8 Approvals, 2 Rejections

- Total = 10, edits = 0.
- effective_positives = 8.

**Before prior** (raw Wilson, z = 1.96):

- p = 0.8, n = 10
- lower ≈ **0.4902**
- Even with 80% approval, the lower bound is below 0.50 because
  the sample is small.

**After prior** (default settings):

- w = 4 × (1 − 10/30) ≈ 2.667
- adjusted_positives = 8 + 0.5 × 2.667 ≈ 9.333
- adjusted_total = 12.667
- lower ≈ **0.4622** — the prior (0.5) pulls the score slightly down
  since the observed rate (0.8) is above the prior.

**Status:** REVIEWED (0.4902 < 0.80 threshold).

**To certify:** this asset needs many more approvals. Reaching the 0.80
Wilson bound typically requires ~20 unanimous approvals, or ~50+ votes
with a sustained 95%+ approval rate. The bound is intentionally
conservative — certification should mean real consensus, not a lucky
streak.
