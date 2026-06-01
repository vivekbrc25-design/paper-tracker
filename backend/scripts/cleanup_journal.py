"""
MongoDB journal / oplog / internal-bloat cleanup script.

Background
----------
MongoDB's on-disk footprint is made up of more than just your application data:

  • Journal files  – write-ahead logs that guarantee durability.  They are
                     pre-allocated in fixed-size chunks and are never shrunk
                     automatically.
  • Oplog          – stored in the 'local' database.  Even on a standalone
                     (non-replica-set) node MongoDB may keep oplog entries
                     that accumulate over time.
  • WiredTiger cache / temp files – internal engine artefacts.
  • Index / collection fragmentation – space left behind after many
                     updates/deletes that compact() can reclaim.

All of the above live in the 'local' database or in engine-level files that
are reset when MongoDB restarts.  Your application data lives in a *separate*
named database (default: 'paper_tracker') and is completely unaffected.

What this script does
---------------------
1. Prints filesystem + database stats BEFORE any changes.
2. Drops the 'local' database – this is safe:
     - It contains only MongoDB-internal state (oplog, replset config, …).
     - MongoDB recreates it automatically on the next write / restart.
     - Your application data is NOT in 'local'.
3. Compacts every collection in the application database to reclaim
   fragmented space (equivalent to running compact_mongodb.py).
4. Prints stats AFTER so you can see exactly how much space was freed.

NOTE: This script cannot restart the MongoDB process itself (that would
require OS-level access / docker restart).  After running this script,
restarting the MongoDB container / service will let the engine flush its
journal and release any remaining pre-allocated files.

Usage (from the /app working directory inside the container, or from the
backend/ directory on a local machine with a .env file present):

    python -m scripts.cleanup_journal

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
# Constants
# ---------------------------------------------------------------------------

# The 'local' database is MongoDB-internal.  It holds the oplog, replica-set
# configuration, and startup log.  Dropping it is safe on a standalone node –
# MongoDB recreates it automatically.
_INTERNAL_DB = "local"

# Databases that must never be touched by this script.
_PROTECTED_DBS = {"admin", "config", settings.mongo_db_name}


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
    data_mb  = _bytes_to_mb(stats.get("dataSize",    0))
    index_mb = _bytes_to_mb(stats.get("indexSize",   0))
    store_mb = _bytes_to_mb(stats.get("storageSize", 0))
    total_mb = _bytes_to_mb(stats.get("totalSize",   0))
    fs_used  = _bytes_to_mb(stats.get("fsUsedSize",  0))
    fs_total = _bytes_to_mb(stats.get("fsTotalSize", 0))

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
            cs      = _collection_stats(db, name)
            docs    = cs.get("count",            0)
            data    = _bytes_to_mb(cs.get("size",             0))
            storage = _bytes_to_mb(cs.get("storageSize",      0))
            index   = _bytes_to_mb(cs.get("totalIndexSize",   0))
            print(f"  {name:<20} {docs:>8,} {data:>10.3f} {storage:>12.3f} {index:>10.3f}")
        except OperationFailure as exc:
            print(f"  {name:<20}  (could not read stats: {exc})")


def _print_all_db_sizes(client: MongoClient) -> None:
    """Print a one-line size summary for every database on the server."""
    print(f"\n  {'Database':<20} {'Data MB':>10} {'Storage MB':>12} {'Total MB':>10}")
    print(f"  {'-'*20} {'-'*10} {'-'*12} {'-'*10}")
    try:
        for info in client.list_databases():
            name     = info.get("name", "?")
            size_mb  = _bytes_to_mb(info.get("sizeOnDisk", 0))
            # list_databases only gives sizeOnDisk; fetch full stats for the rest
            try:
                st      = _db_stats(client[name])
                data    = _bytes_to_mb(st.get("dataSize",    0))
                storage = _bytes_to_mb(st.get("storageSize", 0))
            except OperationFailure:
                data    = 0.0
                storage = size_mb
            print(f"  {name:<20} {data:>10.3f} {storage:>12.3f} {size_mb:>10.3f}")
    except OperationFailure as exc:
        print(f"  (could not list databases: {exc})")


# ---------------------------------------------------------------------------
# Core operations
# ---------------------------------------------------------------------------

def drop_local_database(client: MongoClient) -> bool:
    """
    Drop the 'local' database to clear oplog and journal metadata.

    Returns True if the database existed and was dropped, False if it was
    already absent (nothing to do).

    Safety notes
    ------------
    • The 'local' database is MongoDB-internal.  It is NOT your application
      database.  Your data lives in '{settings.mongo_db_name}'.
    • MongoDB recreates 'local' automatically on the next write or restart.
    • On a standalone node the oplog in 'local' is not used for replication,
      so dropping it has no impact on data integrity.
    • On a replica-set member you should NOT drop 'local' while the node is
      part of an active set.  This script checks for that and aborts.
    """
    # Guard: refuse to drop if this node is an active replica-set member.
    try:
        rs_status = client.admin.command("replSetGetStatus")
        # If we reach here the node is in a replica set.
        set_name = rs_status.get("set", "unknown")
        print(
            f"\n  ⚠  WARNING: This node is a member of replica set '{set_name}'.\n"
            f"     Dropping 'local' on an active replica-set member is unsafe.\n"
            f"     Skipping 'local' database drop.\n"
        )
        return False
    except OperationFailure:
        # "not running with --replSet" → standalone node → safe to proceed
        pass

    db_names = client.list_database_names()
    if _INTERNAL_DB not in db_names:
        print(f"\n  ℹ  '{_INTERNAL_DB}' database not found – nothing to drop.")
        return False

    # Capture size before dropping so we can report freed space.
    try:
        local_stats  = _db_stats(client[_INTERNAL_DB])
        local_size   = local_stats.get("totalSize", 0)
        local_size_mb = _bytes_to_mb(local_size)
    except OperationFailure:
        local_size    = 0
        local_size_mb = 0.0

    print(f"\n  Dropping '{_INTERNAL_DB}' database  ({local_size_mb:.3f} MB) …")
    client.drop_database(_INTERNAL_DB)
    print(f"  ✓  '{_INTERNAL_DB}' database dropped.  "
          f"MongoDB will recreate it automatically on next write / restart.")
    return True


def compact_all_collections(db) -> dict[str, str]:
    """
    Run the `compact` command on every collection in the application database.

    Returns a dict mapping collection name → "ok" | error message.
    compact() rewrites WiredTiger data files and releases unused space back
    to the OS (or at least back to MongoDB's free list).  It blocks the
    collection for the duration of the operation.
    """
    results: dict[str, str] = {}
    collection_names: list[str] = db.list_collection_names()

    if not collection_names:
        print("\n  No collections found – nothing to compact.")
        return results

    print(f"\n  Compacting {len(collection_names)} collection(s) in '{db.name}' …")
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


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_cleanup() -> None:
    print("\n" + "=" * 60)
    print("  MongoDB Journal / Oplog / Bloat Cleanup")
    print("=" * 60)
    print(f"  URI           : {settings.mongo_uri}")
    print(f"  App database  : {settings.mongo_db_name}")
    print(f"  Internal DB   : {_INTERNAL_DB}  (oplog + journal metadata)")
    print(
        "\n  What this script will do:\n"
        f"    1. Show disk usage for ALL databases on the server\n"
        f"    2. Drop the '{_INTERNAL_DB}' database (safe – MongoDB-internal only)\n"
        f"    3. Compact all collections in '{settings.mongo_db_name}'\n"
        f"    4. Show disk usage again so you can measure the improvement\n"
        f"\n  NOTE: Restarting the MongoDB service after this script will\n"
        f"        flush remaining journal pre-allocations from disk.\n"
    )

    # ------------------------------------------------------------------
    # Connect
    # ------------------------------------------------------------------
    try:
        client: MongoClient = MongoClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=5_000,
        )
        client.admin.command("ping")
    except Exception as exc:
        print(f"\n  ERROR: Could not connect to MongoDB – {exc}")
        sys.exit(1)

    db = client[settings.mongo_db_name]
    collection_names: list[str] = db.list_collection_names()

    # ------------------------------------------------------------------
    # Stats BEFORE
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("  All databases  –  BEFORE cleanup")
    print("=" * 60)
    _print_all_db_sizes(client)

    stats_before = _db_stats(db)
    _print_db_summary(
        f"'{settings.mongo_db_name}' stats  BEFORE  cleanup",
        stats_before,
    )
    _print_collection_table(db, collection_names)

    # ------------------------------------------------------------------
    # Step 1 – Drop 'local' database (oplog / journal metadata)
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print(f"  Step 1 – Drop '{_INTERNAL_DB}' database (oplog / journal metadata)")
    print("=" * 60)
    dropped = drop_local_database(client)

    # ------------------------------------------------------------------
    # Step 2 – Compact application collections
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print(f"  Step 2 – Compact collections in '{settings.mongo_db_name}'")
    print("=" * 60)
    compact_all_collections(db)

    # ------------------------------------------------------------------
    # Stats AFTER
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("  All databases  –  AFTER cleanup")
    print("=" * 60)
    _print_all_db_sizes(client)

    stats_after = _db_stats(db)
    _print_db_summary(
        f"'{settings.mongo_db_name}' stats  AFTER   cleanup",
        stats_after,
    )
    _print_collection_table(db, collection_names)

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    freed_data    = stats_before.get("dataSize",    0) - stats_after.get("dataSize",    0)
    freed_storage = stats_before.get("storageSize", 0) - stats_after.get("storageSize", 0)
    freed_total   = stats_before.get("totalSize",   0) - stats_after.get("totalSize",   0)

    print("\n" + "=" * 60)
    print(f"  Space freed in '{settings.mongo_db_name}' by compaction")
    print("=" * 60)
    print(f"  Data size    : {_bytes_to_mb(freed_data):>+10.3f} MB")
    print(f"  Storage size : {_bytes_to_mb(freed_storage):>+10.3f} MB")
    print(f"  Total size   : {_bytes_to_mb(freed_total):>+10.3f} MB")
    print("=" * 60)

    if dropped:
        print(
            f"\n  ✓  '{_INTERNAL_DB}' database dropped – oplog and journal metadata cleared."
        )
    if freed_total > 0:
        print(f"  ✓  Freed {_bytes_to_mb(freed_total):.3f} MB via compaction.")
    elif freed_total == 0:
        print("  ✓  No fragmentation found in application collections.")
    else:
        print(
            f"  ✓  Compaction complete "
            f"(storage changed by {_bytes_to_mb(freed_total):+.3f} MB)."
        )

    print(
        "\n  ➜  Restart the MongoDB service / container to flush remaining\n"
        "     journal pre-allocations and fully reclaim disk space.\n"
    )

    client.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_cleanup()
