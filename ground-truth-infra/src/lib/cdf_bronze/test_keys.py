"""Unit tests for cdf_bronze.keys — _record_key formatting.

Run with: pytest src/lib/cdf_bronze/test_keys.py
Requires a SparkSession (available on Databricks clusters and serverless).
"""

from pyspark.sql import SparkSession
import pyspark.sql.types as T

from cdf_bronze.keys import record_key_expr


def _spark() -> SparkSession:
    return SparkSession.builder.getOrCreate()


def test_uuid_binary_to_text():
    """A BINARY(16) id should become a lower-case 8-4-4-4-12 UUID string."""
    spark = _spark()
    # UUID: 550e8400-e29b-41d4-a716-446655440000
    uuid_bytes = bytes.fromhex("550e8400e29b41d4a716446655440000")
    schema = T.StructType([T.StructField("id", T.BinaryType(), False)])
    df = spark.createDataFrame([(uuid_bytes,)], schema)
    result = df.select(record_key_expr(["id"], df).alias("key")).collect()[0]["key"]
    assert result == "550e8400-e29b-41d4-a716-446655440000"


def test_string_key():
    """A STRING key should be cast to string (identity)."""
    spark = _spark()
    schema = T.StructType([T.StructField("key", T.StringType(), False)])
    df = spark.createDataFrame([("admin_emails",)], schema)
    result = df.select(record_key_expr(["key"], df).alias("key")).collect()[0]["key"]
    assert result == "admin_emails"


def test_integer_key():
    """An INTEGER key should be cast to its string representation."""
    spark = _spark()
    schema = T.StructType([T.StructField("user_id", T.IntegerType(), False)])
    df = spark.createDataFrame([(42,)], schema)
    result = df.select(record_key_expr(["user_id"], df).alias("key")).collect()[0]["key"]
    assert result == "42"


def test_composite_key():
    """Composite keys should be pipe-separated in YAML order."""
    spark = _spark()
    schema = T.StructType(
        [
            T.StructField("campaign_id", T.BinaryType(), False),
            T.StructField("user_id", T.StringType(), False),
        ]
    )
    uuid_bytes = bytes.fromhex("a1b2c3d4e5f6078890a1b2c3d4e5f607")
    df = spark.createDataFrame([(uuid_bytes, "user@test.com")], schema)
    result = df.select(
        record_key_expr(["campaign_id", "user_id"], df).alias("key")
    ).collect()[0]["key"]
    assert result == "a1b2c3d4-e5f6-0788-90a1-b2c3d4e5f607|user@test.com"


def test_composite_non_binary():
    """Composite keys where neither is BINARY should be pipe-joined strings."""
    spark = _spark()
    schema = T.StructType(
        [
            T.StructField("group_name", T.StringType(), False),
            T.StructField("member_id", T.StringType(), False),
        ]
    )
    df = spark.createDataFrame([("semantic-ground-truth-admins", "admin@test.com")], schema)
    result = df.select(
        record_key_expr(["group_name", "member_id"], df).alias("key")
    ).collect()[0]["key"]
    assert result == "semantic-ground-truth-admins|admin@test.com"
