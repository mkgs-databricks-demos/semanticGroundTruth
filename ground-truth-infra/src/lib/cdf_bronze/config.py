"""Load and validate the cdf_bronze_tables.yaml fixture."""

from __future__ import annotations

import pathlib
from dataclasses import dataclass, field
from typing import List

import yaml


@dataclass(frozen=True)
class TableEntry:
    """One Postgres table to stream into bronze."""

    name: str
    keys: List[str]


@dataclass(frozen=True)
class CdfBronzeConfig:
    """Parsed cdf_bronze_tables.yaml."""

    target_table: str
    history_table_pattern: str
    cdf_columns: List[str]
    tables: List[TableEntry] = field(default_factory=list)

    def history_table_name(self, table_name: str) -> str:
        """Return the lb_*_history table name for a given Postgres table."""
        return self.history_table_pattern.replace("{table}", table_name)


def load_config(config_path: str) -> CdfBronzeConfig:
    """Load and validate the YAML fixture at *config_path*.

    Raises ``ValueError`` on missing required keys or empty tables list.
    """
    path = pathlib.Path(config_path)
    with open(path, "r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)

    if not isinstance(raw, dict):
        raise ValueError(f"Expected a YAML mapping at {config_path}, got {type(raw).__name__}")

    for required in ("target_table", "history_table_pattern", "cdf_columns", "tables"):
        if required not in raw:
            raise ValueError(f"Missing required key '{required}' in {config_path}")

    tables_raw = raw["tables"]
    if not tables_raw:
        raise ValueError(f"'tables' list is empty in {config_path}")

    tables: List[TableEntry] = []
    for idx, entry in enumerate(tables_raw):
        if "name" not in entry or "keys" not in entry:
            raise ValueError(f"Table entry {idx} is missing 'name' or 'keys' in {config_path}")
        keys = entry["keys"]
        if not keys:
            raise ValueError(f"Table '{entry['name']}' has an empty keys list in {config_path}")
        tables.append(TableEntry(name=entry["name"], keys=list(keys)))

    return CdfBronzeConfig(
        target_table=raw["target_table"],
        history_table_pattern=raw["history_table_pattern"],
        cdf_columns=list(raw["cdf_columns"]),
        tables=tables,
    )
