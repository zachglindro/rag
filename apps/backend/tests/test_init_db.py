import sqlite3

import pytest
from db.init_db import create_tables, initialize_database  # type: ignore


@pytest.fixture
def temp_db_path(tmp_path):
    """Fixture to provide a temporary database path."""
    return tmp_path / "test.db"


class TestCreateTables:
    def test_creates_records_table(self):
        """Test that create_tables creates the records table with correct schema."""
        conn = sqlite3.connect(":memory:")
        cursor = conn.cursor()

        create_tables(cursor)

        # Check if table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='records'"
        )
        assert cursor.fetchone() is not None

        # Check table schema
        cursor.execute("PRAGMA table_info(records)")
        columns = cursor.fetchall()

        expected_columns = [
            (0, "id", "INTEGER", 0, None, 1),  # id INTEGER PRIMARY KEY AUTOINCREMENT
            (1, "data", "TEXT", 1, None, 0),  # data TEXT NOT NULL
            (2, "natural_language_description", "TEXT", 0, None, 0),
            (3, "created_at", "TIMESTAMP", 0, "CURRENT_TIMESTAMP", 0),
            (4, "updated_at", "TIMESTAMP", 0, "CURRENT_TIMESTAMP", 0),
        ]

        assert len(columns) == 5
        for expected, actual in zip(expected_columns, columns):
            assert actual == expected

        conn.close()

    def test_creates_column_metadata_table(self):
        """Test that create_tables creates the column_metadata table with correct schema."""
        conn = sqlite3.connect(":memory:")
        cursor = conn.cursor()

        create_tables(cursor)

        # Check if table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='column_metadata'"
        )
        assert cursor.fetchone() is not None

        # Check table schema
        cursor.execute("PRAGMA table_info(column_metadata)")
        columns = cursor.fetchall()

        expected_columns = [
            (0, "column_name", "TEXT", 0, None, 1),  # column_name TEXT PRIMARY KEY
            (1, "display_name", "TEXT", 1, None, 0),  # display_name TEXT NOT NULL
            (2, "data_type", "TEXT", 1, None, 0),  # data_type TEXT NOT NULL
            (3, "is_required", "BOOLEAN", 0, "0", 0),  # is_required BOOLEAN DEFAULT 0
            (4, "default_value", "TEXT", 0, None, 0),  # default_value TEXT
            (5, "order", "INTEGER", 0, None, 0),  # "order" INTEGER
            (6, "description", "TEXT", 0, None, 0),  # description TEXT
        ]

        assert len(columns) == 7
        for expected, actual in zip(expected_columns, columns):
            assert actual == expected

        conn.close()

    def test_tables_are_idempotent(self):
        """Test that calling create_tables multiple times doesn't cause errors."""
        conn = sqlite3.connect(":memory:")
        cursor = conn.cursor()

        # Call create_tables twice
        create_tables(cursor)
        create_tables(cursor)  # Should not raise an error due to IF NOT EXISTS

        # Verify tables still exist
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('records', 'column_metadata')"
        )
        tables = cursor.fetchall()
        assert len(tables) == 2

        conn.close()


class TestInitializeDatabase:
    def test_initializes_new_database(self, temp_db_path):
        """Test that initialize_database creates a new database file when it doesn't exist."""
        assert not temp_db_path.exists()

        initialize_database(temp_db_path)

        # Check that file was created
        assert temp_db_path.exists()

        # Check that tables were created
        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='records'"
        )
        assert cursor.fetchone() is not None

        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='column_metadata'"
        )
        assert cursor.fetchone() is not None

        conn.close()

    def test_skips_existing_database(self, temp_db_path):
        """Test that initialize_database doesn't recreate an existing database."""
        # Create an empty file first
        temp_db_path.touch()
        original_mtime = temp_db_path.stat().st_mtime

        initialize_database(temp_db_path)

        # File should still exist and not be modified (mtime should be the same or very close)
        assert temp_db_path.exists()
        new_mtime = temp_db_path.stat().st_mtime
        assert abs(new_mtime - original_mtime) < 1  # Allow for small timing differences

    def test_creates_tables_in_new_database(self, temp_db_path):
        """Test that initialize_database creates tables in a newly created database."""
        initialize_database(temp_db_path)

        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()

        # Try to insert into records table
        cursor.execute("INSERT INTO records (data) VALUES (?)", ["test data"])
        conn.commit()

        # Verify insertion worked
        cursor.execute("SELECT data FROM records WHERE id = ?", [1])
        result = cursor.fetchone()
        assert result == ("test data",)

        # Try to insert into column_metadata table
        cursor.execute(
            """
            INSERT INTO column_metadata 
            (column_name, display_name, data_type, is_required, default_value, "order", description) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            ["test_col", "Test Column", "string", False, "null", 1, "Test description"],
        )
        conn.commit()

        cursor.execute(
            "SELECT column_name, display_name FROM column_metadata WHERE column_name = ?",
            ["test_col"],
        )
        result = cursor.fetchone()
        assert result == ("test_col", "Test Column")

        conn.close()
