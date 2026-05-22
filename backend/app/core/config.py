from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


class Settings:
    app_name = "Paper Tracker API"
    api_prefix = "/api"
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    mongo_db_name = os.getenv("MONGO_DB_NAME", "paper_tracker")
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    admin_user_id = os.getenv("ADMIN_USER_ID", "adminbrc")
    admin_password = os.getenv("ADMIN_PASSWORD", "brc@123")


settings = Settings()
