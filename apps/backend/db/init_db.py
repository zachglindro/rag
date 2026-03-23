import sqlite3
from pathlib import Path


def create_tables(cursor: sqlite3.Cursor) -> None:
    # Data table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,  -- JSON object
            natural_language_description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Metadata table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS column_metadata (
            column_name TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            data_type TEXT NOT NULL,  -- e.g., 'string', 'number'
            is_required BOOLEAN DEFAULT 0,
            default_value TEXT,  -- JSON value
            "order" INTEGER,
            description TEXT
        )
    """)


def initialize_database(db_path: Path) -> None:
    if not db_path.exists():
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        create_tables(cursor)
        conn.commit()
        conn.close()
        print("Database initialized (empty).")
    else:
        print("Database already exists.")
