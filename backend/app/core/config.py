from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    app_name = "Paper Tracker API"
    api_prefix = "/api"
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    mongo_db_name = os.getenv("MONGO_DB_NAME", "paper_tracker")
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    admin_user_id = os.getenv("ADMIN_USER_ID", "adminbrc")
    admin_password = os.getenv("ADMIN_PASSWORD", "brc@123")
    manager_user_id = os.getenv("MANAGER_USER_ID", "managerbrc")
    manager_password = os.getenv("MANAGER_PASSWORD", "brc@123")
    manager_display_name = os.getenv("MANAGER_DISPLAY_NAME", "Paper Tracker Manager")
    seed_demo_data = _env_flag("SEED_DEMO_DATA", mongo_uri.startswith("mongodb://localhost"))
    seed_demo_papers = _env_flag("SEED_DEMO_PAPERS", seed_demo_data)


settings = Settings()
