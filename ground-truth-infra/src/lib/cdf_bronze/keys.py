"""Build a PySpark Column expression for ``_record_key``.

Rules (from build_conventions §7):
* UUID / BINARY(16) columns → lower-case 8-4-4-4-12 hex text.
* All other types → ``CAST(col AS STRING)``.
* Composite keys are joined with ``|`` in the YAML key order.
"""

from __future__ import annotations

from typing import List

from pyspark.sql import Column
import pyspark.sql.functions as F


def _uuid_from_binary(col_name: str) -> Column:
    """Convert a BINARY(16) column to lower-case UUID text (8-4-4-4-12).

    Uses ``hex()`` then inserts dashes via ``concat`` / ``substring``.
    """
    h = F.lower(F.hex(F.col(col_name)))
    return F.concat(
        F.substring(h, 1, 8),
        F.lit("-"),
        F.substring(h, 9, 4),
        F.lit("-"),
        F.substring(h, 13, 4),
        F.lit("-"),
        F.substring(h, 17, 4),
        F.lit("-"),
        F.substring(h, 21, 12),
    )


def record_key_expr(key_columns: List[str], df: "pyspark.sql.DataFrame") -> Column:
    """Return a Column that computes ``_record_key`` for the given key columns.

    For each key column, if the column's data type is ``BinaryType`` and has
    length 16 (UUID), the value is formatted as UUID text; otherwise it is
    cast to STRING.  Multiple columns are joined with ``|``.
    """
    parts: List[Column] = []
    schema_fields = {f.name: f for f in df.schema.fields}

    for col_name in key_columns:
        field = schema_fields.get(col_name)
        if field is not None and str(field.dataType) == "BinaryType()":
            parts.append(_uuid_from_binary(col_name))
        else:
            parts.append(F.col(col_name).cast("string"))

    if len(parts) == 1:
        return parts[0]
    # Composite key: join with |
    interleaved: List[Column] = []
    for i, part in enumerate(parts):
        if i > 0:
            interleaved.append(F.lit("|"))
        interleaved.append(part)
    return F.concat(*interleaved)
