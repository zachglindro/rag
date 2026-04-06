import sqlite3

import pytest
import main
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


class TestSemanticSearchEndpoint:
    def test_semantic_search_returns_ranked_records(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO records (data, natural_language_description) VALUES (?, ?)",
                ('{"name": "Alpha", "trait": "drought tolerance"}', "Alpha drought tolerant"),
            )
            first_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO records (data, natural_language_description) VALUES (?, ?)",
                ('{"name": "Beta", "trait": "high yield"}', "Beta high yield"),
            )
            second_id = cursor.lastrowid
            conn.commit()

        class FakeEmbedder:
            def embed(self, text: str) -> list[float]:
                assert text == "high yielding plants"
                return [0.1, 0.2, 0.3]

        class FakeVectorDB:
            def query_embeddings(
                self,
                query_embeddings: list[list[float]] | list[list[int]],
                n_results: int = 10,
                include: list[str] | None = None,
            ):
                assert len(query_embeddings) == 1
                assert n_results == 20
                assert include == ["distances"]
                return {
                    "ids": [[str(second_id), str(first_id)]],
                    "distances": [[0.0123, 0.2456]],
                }

        class FakeReranker:
            def rerank(self, query: str, candidates: list[dict[str, object]]):
                assert query == "high yielding plants"
                assert [candidate["id"] for candidate in candidates] == [
                    str(second_id),
                    str(first_id),
                ]
                return [
                    {"id": str(first_id), "score": 0.93},
                    {"id": str(second_id), "score": 0.74},
                ]

        monkeypatch.setattr(main, "get_embedder", lambda: FakeEmbedder())
        monkeypatch.setattr(main, "get_vectordb", lambda: FakeVectorDB())
        monkeypatch.setattr(main, "get_reranker", lambda: FakeReranker())

        response = client.get(
            "/semantic-search/records",
            params={"query": "high yielding plants", "top_k": 5},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["query"] == "high yielding plants"
        assert body["top_k"] == 5
        assert [record["id"] for record in body["records"]] == [first_id, second_id]
        assert body["records"][0]["distance"] == pytest.approx(0.2456)
        assert body["records"][0]["rerank_score"] == pytest.approx(0.93)
        assert body["records"][1]["distance"] == pytest.approx(0.0123)
        assert body["records"][1]["rerank_score"] == pytest.approx(0.74)

    def test_semantic_search_empty_results(self, monkeypatch: pytest.MonkeyPatch):
        class FakeEmbedder:
            def embed(self, _: str) -> list[float]:
                return [0.4, 0.5]

        class FakeVectorDB:
            def query_embeddings(
                self,
                query_embeddings: list[list[float]] | list[list[int]],
                n_results: int = 10,
                include: list[str] | None = None,
            ):
                return {"ids": [[]], "distances": [[]]}

        monkeypatch.setattr(main, "get_embedder", lambda: FakeEmbedder())
        monkeypatch.setattr(main, "get_vectordb", lambda: FakeVectorDB())

        response = client.get(
            "/semantic-search/records",
            params={"query": "unmatched query", "top_k": 5},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["records"] == []
