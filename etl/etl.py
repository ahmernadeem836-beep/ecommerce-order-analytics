
import os
import sys
from decimal import Decimal
from pathlib import Path
from datetime import datetime

import clickhouse_connect
import mysql.connector
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

DATABASE = os.getenv("CLICKHOUSE_DATABASE", "ecommerce_analytics")
TARGET = f"{DATABASE}.order_analytics"
STAGING = f"{DATABASE}.order_analytics_staging"

BATCH_SIZE = 5000

SOURCE_QUERY = """
SELECT
    oi.order_item_id,
    oi.order_id,
    o.order_date,
    o.order_status,
    o.customer_id,
    c.full_name AS customer_name,
    c.city AS customer_city,
    oi.product_id,
    p.product_name,
    p.category_id,
    cat.category_name,
    p.sku,
    oi.quantity,
    oi.unit_price,
    oi.quantity * oi.unit_price AS line_revenue,
    GREATEST(
        COALESCE(oi.updated_at, oi.created_at, '1970-01-01'),
        COALESCE(o.updated_at, o.created_at, '1970-01-01'),
        COALESCE(p.updated_at, p.created_at, '1970-01-01'),
        COALESCE(c.updated_at, c.created_at, '1970-01-01'),
        COALESCE(cat.updated_at, cat.created_at, '1970-01-01')
    ) AS source_updated_at
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN customers c ON c.customer_id = o.customer_id
JOIN products p ON p.product_id = oi.product_id
JOIN categories cat ON cat.category_id = p.category_id
ORDER BY oi.order_item_id
"""

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS {table}
(
    order_item_id UInt32,
    order_id UInt32,
    order_date DateTime,
    order_status LowCardinality(String),
    customer_id UInt32,
    customer_name String,
    customer_city Nullable(String),
    product_id UInt32,
    product_name String,
    category_id UInt32,
    category_name String,
    sku String,
    quantity UInt32,
    unit_price Decimal(10, 2),
    line_revenue Decimal(12, 2),
    source_updated_at DateTime
)
ENGINE = MergeTree
ORDER BY (order_date, order_id, order_item_id)
"""


def connect_mysql():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USERNAME", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_DATABASE", "ecommerce_orders"),
    )


def connect_clickhouse():
    return clickhouse_connect.get_client(
        host=os.getenv("CLICKHOUSE_HOST", "localhost"),
        port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
        username=os.getenv("CLICKHOUSE_USERNAME", "default"),
        password=os.getenv("CLICKHOUSE_PASSWORD", ""),
        database="default",
    )


def to_datetime(value):
    """Convert MySQL datetime/string values to Python datetime."""
    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        return datetime.fromisoformat(value)

    raise TypeError(
        f"Expected datetime or ISO datetime string, got "
        f"{type(value).__name__}: {value!r}"
    )


def main():
    mysql_conn = None
    ch = None
    cursor = None

    try:
        print("Connecting to MySQL...")
        mysql_conn = connect_mysql()
        print("MySQL connected.")

        print("Connecting to ClickHouse...")
        ch = connect_clickhouse()
        print("ClickHouse connected.")

        ch.command(
            f"CREATE DATABASE IF NOT EXISTS {DATABASE} ENGINE = Atomic"
        )
        ch.command(CREATE_TABLE.format(table=TARGET))
        ch.command(CREATE_TABLE.format(table=STAGING))

        print("Extracting source data...")
        cursor = mysql_conn.cursor(dictionary=True)
        cursor.execute(SOURCE_QUERY)

        columns = [
            "order_item_id",
            "order_id",
            "order_date",
            "order_status",
            "customer_id",
            "customer_name",
            "customer_city",
            "product_id",
            "product_name",
            "category_id",
            "category_name",
            "sku",
            "quantity",
            "unit_price",
            "line_revenue",
            "source_updated_at",
        ]

        # Only staging is cleared; published data remains untouched.
        ch.command(f"TRUNCATE TABLE {STAGING}")

        total_loaded = 0
        timestamp_index = columns.index("source_updated_at")
        order_date_index = columns.index("order_date")

        while True:
            records = cursor.fetchmany(BATCH_SIZE)

            if not records:
                break

            rows = []

            for record in records:
                rows.append([
                    record["order_item_id"],
                    record["order_id"],
                    to_datetime(record["order_date"]),
                    record["order_status"],
                    record["customer_id"],
                    record["customer_name"],
                    record["customer_city"],
                    record["product_id"],
                    record["product_name"],
                    record["category_id"],
                    record["category_name"],
                    record["sku"],
                    record["quantity"],
                    Decimal(str(record["unit_price"])),
                    Decimal(str(record["line_revenue"])),
                    to_datetime(record["source_updated_at"]),
                ])

            ch.insert(
                STAGING,
                rows,
                column_names=columns,
            )

            total_loaded += len(rows)
            print(f"Staged {total_loaded} rows...")

        cursor.close()
        cursor = None

        print("Validating staged data...")

        staged_count = ch.query(
            f"SELECT count() FROM {STAGING}"
        ).result_rows[0][0]

        if total_loaded != staged_count:
            raise RuntimeError(
                f"Row count mismatch: extracted={total_loaded}, "
                f"staged={staged_count}"
            )

        # Publish only after successful row-count validation.
        ch.command(
            f"EXCHANGE TABLES {TARGET} AND {STAGING}"
        )

        print("ETL completed successfully.")
        print(f"Rows published: {staged_count}")

        summary = ch.query(f"""
            SELECT
                count() AS order_items,
                uniqExact(order_id) AS orders,
                uniqExact(customer_id) AS customers,
                round(sum(line_revenue), 2) AS total_revenue
            FROM {TARGET}
        """)

        print("Analytics validation:")
        print(summary.result_rows)

    except Exception as exc:
        print(f"ETL FAILED: {exc}", file=sys.stderr)
        raise

    finally:
        if cursor is not None:
            cursor.close()

        if mysql_conn is not None and mysql_conn.is_connected():
            mysql_conn.close()

        if ch is not None:
            ch.close()


if __name__ == "__main__":
    main()
