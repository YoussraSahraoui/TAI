import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# data/ holds user-uploaded input (datasets the user feeds into the system).
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# cache/ holds derived state owned by the backend (SQLite DB, intermediates).
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)

DEFAULT_URL = f"sqlite:///{CACHE_DIR / 'timetabling.db'}"
DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_URL)
