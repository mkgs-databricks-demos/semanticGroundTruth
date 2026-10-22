"""Lakebase CDF (Change Data Feed) configuration management.

Provides the LakebaseCdfConfigurator class for idempotently creating and
waiting on Lakebase Lakehouse Sync configurations that replicate Postgres
schema tables to Delta (Unity Catalog).

SDK API reference (databricks-sdk >= 0.154.0):
    - w.postgres.create_cdf_config(parent, cdf_config, cdf_config_id?)
        parent: str  — database resource path
            Format: projects/{project}/branches/{branch}/databases/{database}
        cdf_config: CdfConfig(catalog, schema, postgres_schema)
            catalog: str  — UC catalog name
            schema: str   — UC schema name
            postgres_schema: str — Postgres schema to replicate
        Returns: CreateCdfConfigOperation (long-running)
            .wait() → CdfConfig (blocks until ready)
            .done() → bool
    - w.postgres.list_cdf_configs(parent)
        parent: str  — same database resource path
        Returns: Iterator[CdfConfig]

CdfConfig fields:
    catalog: str           — UC catalog
    schema: str            — UC schema
    postgres_schema: str   — Postgres schema being replicated
    cdf_config_id: str?    — user-specified id (defaults to postgres_schema)
    create_time: Timestamp?
    name: str?             — full resource name
"""

import logging
import time
from typing import List, Optional, Tuple

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.postgres import CdfConfig

logger = logging.getLogger(__name__)


class LakebaseCdfConfigurator:
    """Manage Lakebase CDF configs for a single database.

    Args:
        w: Authenticated WorkspaceClient instance.
        database: Full database resource path.
            Format: projects/{project}/branches/{branch}/databases/{database}
        source_schema: Postgres schema to replicate (e.g. 'app').
        dest_catalog: UC catalog for destination history tables.
        dest_schema: UC schema for destination history tables.
    """

    def __init__(
        self,
        w: WorkspaceClient,
        database: str,
        source_schema: str,
        dest_catalog: str,
        dest_schema: str,
    ):
        self.w = w
        self.database = database
        self.source_schema = source_schema
        self.dest_catalog = dest_catalog
        self.dest_schema = dest_schema

    def ensure(self) -> Tuple[CdfConfig, bool]:
        """Idempotently create a CDF config for the source schema.

        Checks whether a CDF config already exists for this source schema.
        If so, returns it. Otherwise creates one and waits for the
        long-running operation to complete.

        Returns:
            Tuple of (CdfConfig, created: bool).
        """
        existing = self._find_existing()
        if existing is not None:
            logger.info(
                "CDF config already exists for postgres_schema=%s: %s",
                self.source_schema,
                existing.name,
            )
            return existing, False

        logger.info(
            "Creating CDF config: database=%s, postgres_schema=%s -> %s.%s",
            self.database,
            self.source_schema,
            self.dest_catalog,
            self.dest_schema,
        )
        operation = self.w.postgres.create_cdf_config(
            parent=self.database,
            cdf_config=CdfConfig(
                catalog=self.dest_catalog,
                schema=self.dest_schema,
                postgres_schema=self.source_schema,
            ),
        )
        config = operation.wait()
        logger.info("CDF config created: %s", config.name)
        return config, True

    def _find_existing(self) -> Optional[CdfConfig]:
        """Find an existing CDF config for the source schema."""
        for cfg in self.w.postgres.list_cdf_configs(parent=self.database):
            if cfg.postgres_schema == self.source_schema:
                return cfg
        return None

    def history_tables(self) -> List[str]:
        """List lb_*_history tables in the destination schema.

        Queries information_schema.tables for tables matching the
        'lb_%_history' naming pattern in the destination catalog/schema.

        Returns:
            Sorted list of fully qualified table names.
        """
        rows = self.w.statement_execution.execute_statement(
            warehouse_id=None,  # serverless
            catalog=self.dest_catalog,
            schema=self.dest_schema,
            statement=(
                "SELECT table_name "
                f"FROM {self.dest_catalog}.information_schema.tables "
                f"WHERE table_schema = '{self.dest_schema}' "
                "AND table_name LIKE 'lb\\_%\\_history' "
                "ORDER BY table_name"
            ),
        )
        # Use spark SQL from the notebook instead for simpler execution
        # This method is meant to be called from a notebook context
        raise NotImplementedError(
            "Use history_tables_spark() from a notebook context instead."
        )

    def history_tables_spark(self, spark) -> List[str]:
        """List lb_*_history tables using SparkSession.

        Args:
            spark: Active SparkSession.

        Returns:
            Sorted list of unqualified table names (e.g. 'lb_votes_history').
        """
        df = spark.sql(
            f"SELECT table_name "
            f"FROM {self.dest_catalog}.information_schema.tables "
            f"WHERE table_schema = '{self.dest_schema}' "
            f"AND table_name LIKE 'lb\\_%\\_history' "
            f"ORDER BY table_name"
        )
        return [row.table_name for row in df.collect()]

    def wait_for_tables(
        self,
        expected: List[str],
        timeout_s: int = 900,
        poll_interval_s: int = 30,
        spark=None,
    ) -> List[str]:
        """Wait for expected lb_*_history tables to appear.

        Polls the destination schema until all expected history tables
        exist or the timeout is reached.

        Args:
            expected: List of Postgres table names (e.g. ['votes', 'assets']).
                Each is expected to produce an 'lb_{name}_history' table.
            timeout_s: Maximum seconds to wait (default 900 = 15 min).
            poll_interval_s: Seconds between polls (default 30).
            spark: SparkSession for querying information_schema.

        Returns:
            List of table names that were found.

        Raises:
            TimeoutError: If not all expected tables appear within timeout_s.
        """
        if spark is None:
            raise ValueError("spark is required for wait_for_tables")

        expected_history = sorted(f"lb_{t}_history" for t in expected)
        deadline = time.time() + timeout_s
        found = []

        while time.time() < deadline:
            found = self.history_tables_spark(spark)
            missing = [t for t in expected_history if t not in found]
            if not missing:
                logger.info(
                    "All %d expected history tables found: %s",
                    len(expected_history),
                    found,
                )
                return found
            logger.info(
                "Waiting for %d/%d tables (missing: %s), %.0fs remaining",
                len(missing),
                len(expected_history),
                missing,
                deadline - time.time(),
            )
            time.sleep(poll_interval_s)

        # Final check
        found = self.history_tables_spark(spark)
        missing = [t for t in expected_history if t not in found]
        if missing:
            raise TimeoutError(
                f"Timed out after {timeout_s}s waiting for history tables. "
                f"Missing: {missing}. Found: {found}"
            )
        return found
