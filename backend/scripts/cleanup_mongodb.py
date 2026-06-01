"""
MongoDB disk-space cleanup script.

Connects to the database configured via MONGO_URI / MONGO_DB_NAME, prints
collection-level storage stats, compacts every collection to reclaim space
left behind by deleted or updated documents, then prints the stats again so
you can see exactly how much space was freed.

Usage (from the /app working directory inside the container, or from the
backend/ directory on a local machine with a .env file present):

    python -m scripts.cleanup_mongodb

Environment variables (same ones used by the FastAPI app):
    MONGO_URI      – MongoDB connection string  (default: mongodb://localhost:27017)
    MONGO_DB_NAME  – Database name              (default: paper_tracker)
"""

from __future__ import annotations

import sys
from typing import Any

from pymongo import MongoClient
from pymongo.errors import OperationFailure

from app.core.config import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _bytes_to_mb(value: int | float) -> float:
    return round(value / (1024 * 1024), 3)


def _db_stats(db) -> dict[str, Any]:
    """Return raw dbStats document (sizes are in bytes)."""
    return db.command("dbStats", scale=1)


def _collection_stats(db, collection_name: str) -> dict[str, Any]:
    """Return raw collStats document for a single collection."""
    return db.command("collStats", collection_name)


def _print_db_summary(label: str, stats: dict[str, Any]) -> None:
    data_mb   = _bytes_to_mb(stats.get("dataSize",    0))
    index_mb  = _bytes_to_mb(stats.get("indexSize",   0))
    store_mb  = _bytes_to_mb(stats.get("storageSize", 0))
    total_mb  = _bytes_to_mb(stats.get("totalSize",   0))
    fs_used   = _bytes_to_mb(stats.get("fsUsedSize",  0))
    fs_total  = _bytes_to_mb(stats.get("fsTotalSize", 0))

    print(f"\n{'=' * 60}")
    print(f"  {label}")
    print(f"{'=' * 60}")
    print(f"  Data size    : {data_mb:>10.3f} MB")
    print(f"  Index size   : {index_mb:>10.3f} MB")
    print(f"  Storage size : {store_mb:>10.3f} MB  (allocated on disk)")
    print(f"  Total size   : {total_mb:>10.3f} MB")
    if fs_total:
        print(f"  Volume used  : {fs_used:>10.3f} MB  /  {fs_total:.3f} MB total")
    print(f"{'=' * 60}")


def _print_collection_table(db, collection_names: list[str]) -> None:
    print(f"\n  {'Collection':<20} {'Docs':>8} {'Data MB':>10} {'Storage MB':>12} {'Index MB':>10}")
    print(f"  {'-'*20} {'-'*8} {'-'*10} {'-'*12} {'-'*10}")
    for name in sorted(collection_names):
        try:
            cs = _collection_stats(db, name)
            docs    = cs.get("count",       0)
            data    = _bytes_to_mb(cs.get("size",        0))
            storage = _bytes_to_mb(cs.get("storageSize", 0))
            index   = _bytes_to_mb(cs.get("totalIndexSize", 0))
            print(f"  {name:<20} {docs:>8,} {data:>10.3f} {storage:>12.3f} {index:>10.3f}")
        except OperationFailure as exc:
            print(f"  {name:<20}  (could not read stats: {exc})")


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def compact_all_collections(db) -> dict[str, str]:
    """
    Run the `compact` command on every collection in the database.

    Returns a dict mapping collection name → "ok" | error message.
    Note: `compact` blocks the collection for the duration of the operation.
    On WiredTiger it rewrites the data files and releases unused space back
    to the OS (or at least back to MongoDB's free list).
    """
    results: dict[str, str] = {}
    collection_names: list[str] = db.list_collection_names()

    if not collection_names:
        print("\n  No collections found – nothing to compact.")
        return results

    print(f"\n  Compacting {len(collection_names)} collection(s)…")
    for name in sorted(collection_names):
        try:
            db.command("compact", name)
            results[name] = "ok"
            print(f"    ✓  {name}")
        except OperationFailure as exc:
            # compact is not supported on views or certain system collections
            msg = str(exc)
            results[name] = f"skipped – {msg}"
            print(f"    ✗  {name}  ({msg})")

    return results


def run_cleanup() -> None:
    print("\n" + "=" * 60)
    print("  MongoDB Disk-Space Cleanup")
    print("=" * 60)
    print(f"  URI      : {settings.mongo_uri}")
    print(f"  Database : {settings.mongo_db_name}")

    # ------------------------------------------------------------------
    # Connect
    # ------------------------------------------------------------------
    try:
        client: MongoClient = MongoClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=5_000,
        )
        # Force a real connection attempt
        client.admin.command("ping")
    except Exception as exc:
        print(f"\n  ERROR: Could not connect to MongoDB – {exc}")
        sys.exit(1)

    db = client[settings.mongo_db_name]
    collection_names: list[str] = db.list_collection_names()

    # ------------------------------------------------------------------
    # Stats BEFORE
    # ------------------------------------------------------------------
    stats_before = _db_stats(db)
    _print_db_summary("Database stats  BEFORE  compaction", stats_before)
    _print_collection_table(db, collection_names)

    # ------------------------------------------------------------------
    # Compact
    # ------------------------------------------------------------------
    compact_all_collections(db)

    # ------------------------------------------------------------------
    # Stats AFTER
    # ------------------------------------------------------------------
    stats_after = _db_stats(db)
    _print_db_summary("Database stats  AFTER   compaction", stats_after)
    _print_collection_table(db, collection_names)

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    freed_data    = stats_before.get("dataSize",    0) - stats_after.get("dataSize",    0)
    freed_storage = stats_before.get("storageSize", 0) - stats_after.get("storageSize", 0)
    freed_total   = stats_before.get("totalSize",   0) - stats_after.get("totalSize",   0)

    print("\n" + "=" * 60)
    print("  Space freed by compaction")
    print("=" * 60)
    print(f"  Data size    : {_bytes_to_mb(freed_data):>+10.3f} MB")
    print(f"  Storage size : {_bytes_to_mb(freed_storage):>+10.3f} MB")
    print(f"  Total size   : {_bytes_to_mb(freed_total):>+10.3f} MB")
    print("=" * 60)

    if freed_total > 0:
        print(f"\n  ✓  Freed {_bytes_to_mb(freed_total):.3f} MB of disk space.\n")
    elif freed_total == 0:
        print("\n  ✓  No fragmentation found – disk usage unchanged.\n")
    else:
        # Negative means storage grew slightly (index rebuild overhead, etc.)
        print(f"\n  ✓  Compaction complete (storage changed by {_bytes_to_mb(freed_total):+.3f} MB).\n")

    client.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_cleanup()
