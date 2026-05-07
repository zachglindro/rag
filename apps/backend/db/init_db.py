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
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            updated_by TEXT
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

    # Settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL  -- JSON string
        )
    """)

    # History table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            action_type TEXT NOT NULL,  -- e.g., 'RECORD_ADDED', 'RECORD_UPDATED', 'RECORD_DELETED', 'COLUMN_ADDED', 'COLUMN_DELETED', 'COLUMN_RENAMED', 'DATABASE_RESET'
            user_name TEXT,
            details TEXT NOT NULL,  -- JSON object containing action-specific details
            affected_records INTEGER,  -- Number of records affected (for bulk operations)
            affected_column TEXT  -- Column name for column operations
        )
    """)


def create_fts_table(cursor: sqlite3.Cursor) -> None:
    # FTS5 virtual table for keyword search
    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
            record_id UNINDEXED,
            content
        )
    """)


def initialize_database(db_path: Path) -> None:
    if not db_path.exists():
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        create_tables(cursor)
        create_fts_table(cursor)
        conn.commit()
        conn.close()
        print("Database initialized (empty).")
    else:
        # Ensure FTS table and history table exist even for existing databases
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        create_fts_table(cursor)

        # Ensure history table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action_type TEXT NOT NULL,
                user_name TEXT,
                details TEXT NOT NULL,
                affected_records INTEGER,
                affected_column TEXT
            )
        """)

        conn.commit()
        conn.close()
        print("Database already exists.")
