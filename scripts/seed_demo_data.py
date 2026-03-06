"""Seed demo data into the enterprise database.

Usage:
    python scripts/seed_demo_data.py [--db-url DATABASE_URL]

If --db-url is not provided, reads DATABASE_STRING from environment or .env file.
"""

import argparse
import os
import sys
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def get_db_url(args_url: str | None = None) -> str:
    """Resolve database URL from args, env, or .env file."""
    if args_url:
        return args_url

    db_url = os.environ.get("DATABASE_STRING")
    if db_url:
        return db_url

    # Try loading from .env
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("DATABASE_STRING=") and not line.startswith("#"):
                return line.split("=", 1)[1].strip().strip("\"'")

    print("ERROR: No database URL found. Set DATABASE_STRING env var or pass --db-url.")
    sys.exit(1)


def to_sync_url(url: str) -> str:
    """Convert async DB URL to sync for psycopg2/psycopg."""
    return url.replace("+asyncpg", "").replace("+psycopg", "+psycopg2")


def main():
    parser = argparse.ArgumentParser(description="Seed demo data into enterprise DB")
    parser.add_argument("--db-url", type=str, help="PostgreSQL connection string")
    parser.add_argument(
        "--sql-file",
        type=str,
        default=str(PROJECT_ROOT / "tests" / "fixtures" / "seed_demo_data.sql"),
        help="Path to SQL seed file",
    )
    args = parser.parse_args()

    db_url = get_db_url(args.db_url)
    sync_url = to_sync_url(db_url)
    sql_path = Path(args.sql_file)

    if not sql_path.exists():
        print(f"ERROR: SQL file not found: {sql_path}")
        sys.exit(1)

    sql_content = sql_path.read_text(encoding="utf-8")

    print(f"Database: {sync_url.split('@')[-1] if '@' in sync_url else '(hidden)'}")
    print(f"SQL file: {sql_path}")

    try:
        import psycopg2

        conn = psycopg2.connect(sync_url)
        conn.autocommit = False
        cursor = conn.cursor()
        cursor.execute(sql_content)
        conn.commit()
        cursor.close()
        conn.close()
        print("Seed data imported successfully.")
    except ImportError:
        # Fallback: use sqlalchemy sync engine
        from sqlalchemy import create_engine, text

        engine = create_engine(sync_url)
        with engine.begin() as conn:
            conn.execute(text(sql_content))
        engine.dispose()
        print("Seed data imported successfully (via SQLAlchemy).")
    except Exception as e:
        print(f"ERROR: Failed to import seed data: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
