# L300-01 — Repository Scaffolding + Bundle 1 Configuration

## Implementation Spec

**Phase:** 1 (Bundle 1 — Infra)
**Type:** Manual CLI + Genie Code
**Prerequisites:** Git repo created, Databricks CLI installed and authenticated
**References:** L100 § Deployment Architecture, L200-C1

---


> See [docs/diagrams/mermaid/03_deployment_architecture.md] for the three-bundle DAB layout.
### Step 1: Create the repository structure

**Type:** Manual (terminal)

```bash
mkdir -p ground-truth-app
cd ground-truth-app
git init

# Create the three-bundle directory structure
mkdir -p bundle-infra/resources
mkdir -p bundle-infra/src/notebooks
mkdir -p bundle-infra/src/migrations
mkdir -p bundle-infra/fixtures
mkdir -p bundle-app
mkdir -p bundle-agent/resources

# Create the docs structure (for design artifacts)
mkdir -p docs/{design,research,semantics,pitch,diagrams/{mermaid,svg,html}}
```

### Step 2: Create Bundle 1 `databricks.yml`

**Type:** Manual (editor)

Create `bundle-infra/databricks.yml`:

```yaml
bundle:
  name: ground-truth-infra

variables:
  catalog:
    description: "Target UC catalog"
    default: "dev_ground_truth"
  schema:
    description: "Target UC schema"
    default: "app"
  warehouse_id:
    description: "SQL Warehouse ID for metric view queries"
  lakebase_project_id:
    description: "Lakebase project ID"
  notification_slack_webhook:
    description: "Slack webhook URL for notifications"
    default: ""
  notification_teams_webhook:
    description: "Teams webhook URL for notifications"
    default: ""

workspace:
  root_path: /Workspace/Shared/.bundles/${bundle.name}/${bundle.target}

include:
  - resources/*.yml

targets:
  dev:
    default: true
    variables:
      catalog: "dev_ground_truth"
      schema: "app"
  staging:
    variables:
      catalog: "staging_ground_truth"
      schema: "app"
  prod:
    variables:
      catalog: "prod_ground_truth"
      schema: "app"
```

### Step 3: Create resource definitions for Bundle 1

**Type:** Manual (editor)

Create `bundle-infra/resources/schemas.yml`:

```yaml
resources:
  schemas:
    ground_truth_schema:
      catalog_name: ${var.catalog}
      name: ${var.schema}
      comment: "Semantic Ground Truth App — operational data"
```

Create `bundle-infra/resources/jobs.yml`:

```yaml
resources:
  jobs:
    feedback_pipeline:
      name: "ground-truth-feedback-pipeline-${bundle.target}"
      schedule:
        quartz_cron_expression: "0 0 23 * * ?"
        timezone_id: "America/New_York"
      tasks:
        - task_key: collect_feedback
          notebook_task:
            notebook_path: src/notebooks/collect_feedback.py
          existing_cluster_id: ${var.warehouse_id}
        - task_key: genie_code_propose
          depends_on:
            - task_key: collect_feedback
          genie_code_task:
            prompt_file: src/prompts/feedback_loop_prompt.md
          
    freshness_resurfacing:
      name: "ground-truth-freshness-check-${bundle.target}"
      schedule:
        quartz_cron_expression: "0 0 6 * * ?"
        timezone_id: "America/New_York"
      tasks:
        - task_key: check_freshness
          notebook_task:
            notebook_path: src/notebooks/freshness_check.py

    metric_view_deploy:
      name: "ground-truth-mv-deploy-${bundle.target}"
      tasks:
        - task_key: deploy_metric_views
          for_each_task:
            inputs: "{{file_list(fixtures/)}}"
            task:
              task_key: deploy_single_mv
              notebook_task:
                notebook_path: src/notebooks/deploy_metric_view.py
                base_parameters:
                  fixture_path: "{{input}}"
                  target_catalog: ${var.catalog}
                  target_schema: ${var.schema}

    post_deploy_validation:
      name: "ground-truth-post-deploy-${bundle.target}"
      tasks:
        - task_key: validate_infra
          notebook_task:
            notebook_path: src/notebooks/post_deploy_validation.py
            base_parameters:
              catalog: ${var.catalog}
              schema: ${var.schema}
              lakebase_project_id: ${var.lakebase_project_id}
```

### Step 4: Create placeholder notebooks

**Type:** Genie Code session

Prompt for Genie Code:
```
Create the following Python notebooks in bundle-infra/src/notebooks/:

1. collect_feedback.py — Queries Lakebase for unprocessed votes (processed=FALSE, 
   vote_type IN ('reject', 'edit')), groups by asset_id, and prepares a feedback 
   batch JSON for the Genie Code task.

2. freshness_check.py — Scans the assets table for production assets where 
   last_reviewed_at is older than the configured freshness_interval_days, 
   and creates freshness campaign entries.

3. deploy_metric_view.py — Reads a fixture YAML file, resolves environment-specific 
   source table references using the target_catalog and target_schema parameters, 
   generates CREATE OR REPLACE VIEW ... WITH METRICS LANGUAGE YAML SQL, and 
   executes it via the Statement Execution API.

4. post_deploy_validation.py — Validates that all Bundle 1 resources are correctly 
   deployed: Lakebase connectivity, UC schema exists, SQL Warehouse accessible, 
   notification destinations configured, metric views queryable.
```

### Step 5: Create the feedback loop prompt

**Type:** Manual (editor)

Create `bundle-infra/src/prompts/feedback_loop_prompt.md`:

```markdown
You are a UC Semantics editor. Given the current metric view YAML and a batch of 
business user feedback (rejections and edits), propose updated YAML that addresses 
the feedback while maintaining valid metric view syntax.

Rules:
- Preserve all existing measures and dimensions unless explicitly rejected
- Update descriptions based on edit suggestions
- Add/remove synonyms based on synonym votes
- Update comments based on feedback
- Do NOT change SQL expressions unless a technical user provided a logic correction
- Output the complete updated YAML (not a diff)

Current YAML:
{current_yaml}

Feedback batch:
{feedback_json}
```

### Step 6: Initialize git and commit

**Type:** Manual (terminal)

```bash
cd ground-truth-app
git add .
git commit -m "Initial scaffold: Bundle 1 (Infra) with three-bundle structure"
```

---

### Open Questions

1. **`for_each_task` with file list:** Does `file_list(fixtures/)` work as a forEach input in current DABs? Need to verify the exact syntax for iterating over files in a directory.
2. **Genie Code task in DAB:** Is the `genie_code_task` resource type available in DABs? If not, the feedback pipeline may need to use a notebook task that invokes Genie Code via API.
3. **Variable inheritance:** How do Bundle 2 and Bundle 3 reference Bundle 1's variables (catalog, schema, warehouse_id)? Shared variables file? Environment variables? CI/CD outputs?
