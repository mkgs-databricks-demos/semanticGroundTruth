# Databricks notebook source
# DBTITLE 1,author_feedback_branch placeholder
# MAGIC %md
# MAGIC # `author_feedback_branch` placeholder (not a real step)
# MAGIC
# MAGIC The `feedback_pipeline` task `author_feedback_branch` is a **Genie Code task** (`genie_task`). Bundle YAML cannot express `genie_task` (Beta, dropped by bundle validation), so the job YAML declares this notebook as a `notebook_task` placeholder and `setup_job_params` (run by `post_deploy_setup` after every deploy) swaps it for a `genie_task` with the automation from `setup_genie_automation` and the placeholder's `base_parameters` as `genie_task.parameters`.
# MAGIC
# MAGIC If this notebook ever runs, the patch did not happen. It fails on purpose so the run never reports success without authoring anything. It never creates a Git branch.
# MAGIC
# MAGIC Fix: run the `post_deploy_setup` job (`setup_genie_automation` + `setup_job_params`), then re-run `feedback_pipeline`.

# COMMAND ----------

# DBTITLE 1,Fail: placeholder was not patched
raise RuntimeError(
    "author_feedback_branch is still the notebook placeholder: run post_deploy_setup "
    "(setup_genie_automation + setup_job_params) to patch it to a genie_task, then re-run feedback_pipeline."
)