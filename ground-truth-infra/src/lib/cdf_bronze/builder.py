"""Metadata-driven CDF → bronze streaming table builder.

Defines one ``dp.create_streaming_table`` with ``cluster_by=['_source_table']``
and one ``@dp.append_flow`` per existing ``lb_*_history`` table. History tables
not yet present in UC are skipped and logged.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from pyspark.sql import SparkSession, DataFrame
import pyspark.sql.functions as F
import pyspark.sql.types as T
from pyspark import pipelines as dp

from cdf_bronze.config import CdfBronzeConfig, TableEntry
from cdf_bronze.keys import record_key_expr

logger = logging.getLogger(__name__)

# Exact column order from build_conventions §7
BRONZE_COLUMNS = [
    "_source_table",
    "_source_history_table",
    "_record_key",
    "_pg_change_type",
    "_pg_lsn",
    "_pg_xid",
    "_timestamp",
    "_sort_by",
    "_ingested_at",
    "data",
]

BRONZE_SCHEMA = T.StructType(
    [
        T.StructField("_source_table", T.StringType(), False),
        T.StructField("_source_history_table", T.StringType(), False),
        T.StructField("_record_key", T.StringType(), False),
        T.StructField("_pg_change_type", T.StringType(), True),
        T.StructField("_pg_lsn", T.LongType(), True),
        T.StructField("_pg_xid", T.IntegerType(), True),
        T.StructField("_timestamp", T.TimestampNTZType(), True),
        T.StructField("_sort_by", T.LongType(), True),
        T.StructField("_ingested_at", T.TimestampType(), True),
        T.StructField("_source_table_data", T.StringType(), True),  # placeholder; replaced below
    ]
)


class CdfBronzeBuilder:
    """Build a streaming bronze table from Lakebase CDF history tables.

    Parameters
    ----------
    spark : SparkSession
    catalog : str
        Target UC catalog (e.g. ``hls_fde_dev``).
    schema : str
        Target UC schema (e.g. ``dev_matthew_giglia_semantic_ground_truth``).
    config : CdfBronzeConfig
        Parsed fixture YAML.
    """

    def __init__(
        self,
        spark: SparkSession,
        catalog: str,
        schema: str,
        config: CdfBronzeConfig,
    ) -> None:
        self._spark = spark
        self._catalog = catalog
        self._schema = schema
        self._config = config

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _fq_history_table(self, table_entry: TableEntry) -> str:
        """Fully qualified UC name for a history table."""
        return f"{self._catalog}.{self._schema}.{self._config.history_table_name(table_entry.name)}"

    def existing_sources(self) -> List[TableEntry]:
        """Return only tables whose lb_*_history table exists in UC.

        Tables not yet present are logged at WARNING level.
        """
        present: List[TableEntry] = []
        for entry in self._config.tables:
            fq = self._fq_history_table(entry)
            if self._spark.catalog.tableExists(fq):
                present.append(entry)
            else:
                logger.warning("Skipping %s — history table %s not found in UC", entry.name, fq)
        return present

    def _transform_stream(self, table_entry: TableEntry) -> DataFrame:
        """Read one lb_*_history table as a stream and project to the bronze schema."""
        fq = self._fq_history_table(table_entry)
        source_df = self._spark.readStream.table(fq)

        cdf_cols = self._config.cdf_columns

        return source_df.select(
            F.lit(table_entry.name).alias("_source_table"),
            F.lit(fq).alias("_source_history_table"),
            record_key_expr(table_entry.keys, source_df).alias("_record_key"),
            F.col("_pg_change_type"),
            F.col("_pg_lsn"),
            F.col("_pg_xid"),
            F.col("_timestamp"),
            F.col("_sort_by"),
            F.current_timestamp().alias("_ingested_at"),
            # All non-CDF columns → VARIANT via to_variant_object(struct(...))
            F.expr(
                "to_variant_object(struct(* EXCEPT ("
                + ", ".join(cdf_cols)
                + ")))"
            ).alias("data"),
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def define(self) -> None:
        """Register the bronze streaming table and one append flow per existing source.

        Call this at module level in the pipeline source file.
        """
        dp.create_streaming_table(
            name=self._config.target_table,
            comment=(
                "Lakebase CDF bronze — all Postgres app tables unified into a single "
                "streaming table with metadata columns and a VARIANT data column."
            ),
            cluster_by=["_source_table"],
        )

        sources = self.existing_sources()
        if not sources:
            logger.warning(
                "No lb_*_history tables found in %s.%s — the pipeline will create "
                "the target table but no flows will write to it.",
                self._catalog,
                self._schema,
            )
            return

        logger.info(
            "Defining %d append flows for bronze_lakebase_cdf: %s",
            len(sources),
            ", ".join(e.name for e in sources),
        )

        for entry in sources:
            self._register_flow(entry)

    def _register_flow(self, entry: TableEntry) -> None:
        """Register a single append_flow for *entry*."""
        flow_name = f"bronze_from_{entry.name}"

        @dp.append_flow(target=self._config.target_table, name=flow_name)
        def _flow(table_entry=entry):
            return self._transform_stream(table_entry)
