import sqlite3

import pytest
from fastapi.testclient import TestClient
from main import DB_PATH, app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_database():
    response = client.post("/reset-database")
    assert response.status_code == 200
    yield


class TestRecordReadEndpoints:
    def test_get_records_empty(self):
        response = client.get("/records")

        assert response.status_code == 200
        data = response.json()
        assert data["skip"] == 0
        assert data["limit"] == 50
        assert data["records"] == []

    def test_get_records_pagination(self):
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO records (data) VALUES (?)", ('{"name": "A"}',))
            cursor.execute("INSERT INTO records (data) VALUES (?)", ('{"name": "B"}',))
            cursor.execute("INSERT INTO records (data) VALUES (?)", ('{"name": "C"}',))
            conn.commit()

        first_page = client.get("/records", params={"skip": 0, "limit": 2})
        second_page = client.get("/records", params={"skip": 2, "limit": 2})

        assert first_page.status_code == 200
        assert second_page.status_code == 200

        first_data = first_page.json()
        second_data = second_page.json()

        assert [row["data"]["name"] for row in first_data["records"]] == ["A", "B"]
        assert [row["data"]["name"] for row in second_data["records"]] == ["C"]

    def test_get_records_query_validation(self):
        negative_skip = client.get("/records", params={"skip": -1})
        zero_limit = client.get("/records", params={"limit": 0})
        too_large_limit = client.get("/records", params={"limit": 501})

        assert negative_skip.status_code == 422
        assert zero_limit.status_code == 422
        assert too_large_limit.status_code == 422

    def test_get_record_by_id_success(self):
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO records (data, natural_language_description) VALUES (?, ?)",
                ('{"trait": "lodging resistance"}', "high resistance"),
            )
            record_id = cursor.lastrowid
            conn.commit()

        response = client.get(f"/records/{record_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == record_id
        assert data["data"] == {"trait": "lodging resistance"}
        assert data["natural_language_description"] == "high resistance"

    def test_get_record_by_id_not_found(self):
        response = client.get("/records/999999")

        assert response.status_code == 404
        assert response.json()["detail"] == "Record not found"

    def test_get_record_count(self):
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO records (data) VALUES (?)", ('{"v": 1}',))
            cursor.execute("INSERT INTO records (data) VALUES (?)", ('{"v": 2}',))
            conn.commit()

        response = client.get("/records/count")

        assert response.status_code == 200
        assert response.json() == {"count": 2}


class TestColumnMetadataReadEndpoint:
    def test_get_column_metadata_empty(self):
        response = client.get("/column-metadata")

        assert response.status_code == 200
        assert response.json() == []

    def test_get_column_metadata_ordering(self):
        first_insert = client.post(
            "/columns",
            json={
                "column_name": "z_column",
                "display_name": "Z Column",
                "data_type": "string",
                "order": 2,
            },
        )
        second_insert = client.post(
            "/columns",
            json={
                "column_name": "a_column",
                "display_name": "A Column",
                "data_type": "string",
                "order": 1,
            },
        )
        tie_insert = client.post(
            "/columns",
            json={
                "column_name": "b_column",
                "display_name": "B Column",
                "data_type": "string",
                "order": 1,
            },
        )

        assert first_insert.status_code == 200
        assert second_insert.status_code == 200
        assert tie_insert.status_code == 200

        response = client.get("/column-metadata")

        assert response.status_code == 200
        names_in_order = [row["column_name"] for row in response.json()]
        assert names_in_order == ["a_column", "b_column", "z_column"]
