# L300-08 — Bundle 1 Deploy + Post-Deploy Validation

## Implementation Spec

**Phase:** 1 (Bundle 1 — Infra)
**Type:** Manual CLI
**Prerequisites:** L300-01 through L300-07 complete
**References:** L100 § Deployment Architecture, § CI/CD Orchestration

---


> See [docs/diagrams/mermaid/03_deployment_architecture.md] for the deployment architecture.
### Step 1: Validate Bundle 1

**Type:** Manual (CLI)

```bash
cd bundle-infra
databricks bundle validate -t dev
```

Fix any validation errors before proceeding.

### Step 2: Deploy Bundle 1

**Type:** Manual (CLI)

```bash
databricks bundle deploy -t dev --auto-approve
```

### Step 3: Run post-deploy validation

**Type:** Manual (CLI)

```bash
databricks bundle run -t dev post_deploy_validation
```

The post-deploy validation notebook checks:
- [ ] Lakebase project accessible
- [ ] All migration scripts applied
- [ ] UC schema exists with correct permissions
- [ ] SQL Warehouse accessible
- [ ] UC Secrets readable
- [ ] Notification destinations configured
- [ ] Unity Gateway connection registered
- [ ] Metric views queryable (if CDF data exists)
- [ ] Lakeflow Jobs created and schedulable

### Step 4: Run initial metric view deployment

**Type:** Manual (CLI)

```bash
databricks bundle run -t dev metric_view_deploy
```

### Step 5: Verify and commit

**Type:** Manual (terminal)

```bash
git add .
git commit -m "Bundle 1 (Infra) deployed and validated for dev"
```

---

### Open Questions

None — this is a procedural step.
