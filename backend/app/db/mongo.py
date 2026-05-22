from __future__ import annotations

from pymongo import MongoClient

from app.core.config import settings


_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
    return _client


def get_database():
    return get_client()[settings.mongo_db_name]
