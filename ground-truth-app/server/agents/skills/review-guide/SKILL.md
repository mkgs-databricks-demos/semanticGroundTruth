---
name: review-guide
description: How to judge semantic ground truth definitions — when to approve, reject, or edit a measure or dimension, and what makes a good synonym or example question.
---

# Reviewing Definitions

When a reviewer opens a card in the Review tab, they see a metric view
definition (YAML), a plain-English description, synonyms, and example
questions. Use this guide to help them decide.

## Approve

Approve when:

- The YAML definition matches the plain-English description.
- The description is clear enough that a business user could explain it
  without reading the YAML.
- Synonyms are genuine alternative names used in conversation or reports.
- Example questions could appear in a natural Genie or search query.

## Reject

Reject when:

- The YAML definition is wrong (e.g. wrong join, wrong filter, wrong
  aggregation).
- The description contradicts the YAML.
- The name is misleading or ambiguous to a business user.

When rejecting, write specific feedback — cite the line or clause that is
wrong and what the correct version would be. A rejection without actionable
feedback does not help the steward fix it.

## Edit

Edit when:

- The definition is mostly right but could be tighter — a missing filter,
  a confusing description, or a synonym that is really a different concept.
- Edits are proposals, not direct changes. They are logged and shown to
  stewards for review.

An edit vote counts as half an approval in the confidence model, reflecting
that the reviewer believes the asset is on the right track.

## Synonym Quality Bar

A synonym should be a name someone would actually type when searching for
this metric. "Revenue" vs "Sales" is a valid synonym pair. "Revenue" vs
"Money coming in" is better as an example question.

- Avoid duplicates that differ only in casing or spacing.
- Avoid overly generic terms that would match too many assets.
- Acronyms and abbreviations count (e.g. "MRR" for "Monthly Recurring Revenue").

## Example Question Quality Bar

An example question should be a realistic natural-language query that a
business user would ask Genie or a search bar.

- Good: "What was total revenue in Q4?"
- Good: "Show me monthly recurring revenue by region."
- Bad: "SELECT SUM(revenue)" (that is SQL, not a question)
- Bad: "Revenue?" (too vague to be useful for training)

Aim for questions that use the metric in context — with a time range, a
filter, or a comparison. These help Genie learn the mapping from natural
language to the metric definition.
