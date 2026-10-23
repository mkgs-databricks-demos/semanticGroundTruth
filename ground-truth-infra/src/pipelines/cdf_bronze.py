"""Lakebase CDF → bronze_lakebase_cdf Spark Declarative Pipeline.

This file is the sole pipeline source. It reads spark.conf for catalog, schema,
and config_path, loads the fixture YAML, and delegates to CdfBronzeBuilder.
"""

import sys

# Add src/lib to sys.path so the cdf_bronze package is importable.
_lib_path = spark.conf.get("cdf_bronze.lib_path")
if _lib_path not in sys.path:
    sys.path.insert(0, _lib_path)

from cdf_bronze.config import load_config
from cdf_bronze.builder import CdfBronzeBuilder

# Pipeline configuration passed via spark.conf from the pipeline resource YAML.
catalog = spark.conf.get("cdf_bronze.catalog")
schema = spark.conf.get("cdf_bronze.schema")
config_path = spark.conf.get("cdf_bronze.config_path")

config = load_config(config_path)
CdfBronzeBuilder(spark, catalog, schema, config).define()
