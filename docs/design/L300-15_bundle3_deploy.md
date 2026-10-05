# L300-15 — Bundle 3 Deploy + Post-Deploy Validation

## Implementation Spec

**Phase:** 3 (Bundle 3 — Genie Agent)
**Type:** Manual CLI
**Prerequisites:** L300-14 complete
**References:** L100 § Deployment Architecture (Bundle 3)

---

### Step 1: Verify the Genie Agent

**Type:** Manual (Genie Agent UI)

1. Open the "Ground Truth Operations" Genie Agent
2. Ask: "Who are the top reviewers?"
3. Verify it generates correct SQL against the metric views
4. Ask: "What's the coverage % for all domains?"
5. Verify results are accurate

### Step 2: Configure OBO access

**Type:** Manual (Genie Agent settings)

1. Ensure the agent uses OBO (agent mode)
2. Verify that admin users can query all data
3. Verify that non-admin users see appropriate results based on their UC permissions

### Step 3: Benchmark the agent

**Type:** Genie Code session

Prompt:
```
Run the following benchmark questions against the Ground Truth Operations Genie Agent
and verify the SQL generated is correct:

1. "Who are our top 10 reviewers this month?"
2. "What's the coverage % for the Claims domain?"
3. "How long does it take on average from first review to certification?"
4. "Show me the approval rate trend over the last 30 days"
5. "Which domains have the most stale assets?"
6. "What's our feedback pipeline success rate this week?"

For each question, verify:
- SQL is syntactically correct
- SQL uses MEASURE() syntax for metric view measures
- Results are accurate against known test data
- Response time is < 10 seconds
```

---

### Open Questions

None — this is a procedural step.
