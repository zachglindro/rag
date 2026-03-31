import io

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestUploadEndpoint:
    def test_upload_csv_file(self):
        """Test uploading a valid CSV file."""
        # Create a sample CSV content
        csv_content = "name,age,city\nJohn,25,NYC\nJane,30,LA\n"
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "test.csv"

        response = client.post(
            "/upload", files={"file": ("test.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        assert "rows" in data
        assert "row_count" in data
        assert data["columns"] == ["name", "age", "city"]
        assert len(data["rows"]) == 2
        assert data["row_count"] == 2

    def test_upload_xlsx_file(self):
        """Test uploading a valid XLSX file."""
        # For XLSX, we need to create a proper Excel file
        # Using pandas to create a DataFrame and save to BytesIO
        import pandas as pd

        df = pd.DataFrame(
            {
                "product": ["Apple", "Banana", "Cherry"],
                "price": [1.0, 0.5, 2.0],
                "quantity": [10, 20, 5],
            }
        )

        xlsx_file = io.BytesIO()
        with pd.ExcelWriter(xlsx_file, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        xlsx_file.name = "test.xlsx"
        xlsx_file.seek(0)

        response = client.post(
            "/upload",
            files={
                "file": (
                    "test.xlsx",
                    xlsx_file,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        assert "rows" in data
        assert "row_count" in data
        assert data["columns"] == ["product", "price", "quantity"]
        assert len(data["rows"]) == 3
        assert data["row_count"] == 3

    def test_upload_unsupported_file_type(self):
        """Test uploading a file with unsupported extension."""
        txt_content = "This is a text file"
        txt_file = io.BytesIO(txt_content.encode("utf-8"))
        txt_file.name = "test.txt"

        response = client.post(
            "/upload", files={"file": ("test.txt", txt_file, "text/plain")}
        )

        assert response.status_code == 400
        data = response.json()
        assert "Unsupported file type" in data["detail"]

    def test_upload_no_file(self):
        """Test uploading without a file."""
        response = client.post("/upload")

        assert response.status_code == 422  # Unprocessable Entity due to missing file

    def test_upload_empty_csv(self):
        """Test uploading an empty CSV file."""
        csv_file = io.BytesIO(b"")
        csv_file.name = "empty.csv"

        response = client.post(
            "/upload", files={"file": ("empty.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 400
        data = response.json()
        assert "empty" in data["detail"].lower()

    def test_upload_malformed_csv(self):
        """Test uploading a malformed CSV file."""
        # CSV with inconsistent columns - should fail
        csv_content = "name,age\nJohn,25\nJane\nBob,35,extra"
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "malformed.csv"

        response = client.post(
            "/upload", files={"file": ("malformed.csv", csv_file, "text/csv")}
        )

        # pandas cannot parse inconsistent columns
        assert response.status_code == 500
        data = response.json()
        assert "Error processing file" in data["detail"]


class TestSuggestMappingsEndpoint:
    def test_suggest_mappings_with_matches(self):
        """Test suggesting mappings for columns that have good matches."""
        # First, add some system columns
        client.post(
            "/columns",
            json={
                "column_name": "local_name",
                "display_name": "Local Name",
                "data_type": "string",
            },
        )
        client.post(
            "/columns",
            json={
                "column_name": "plant_height",
                "display_name": "Plant Height (cm)",
                "data_type": "number",
            },
        )
        client.post(
            "/columns",
            json={
                "column_name": "tassel_color",
                "display_name": "Tassel Color",
                "data_type": "string",
            },
        )

        # Test the suggest mappings
        response = client.post(
            "/suggest-mappings",
            json={"columns": ["Var_Name_Loc", "hgt_cm", "p_tassel_color"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

        # Check that each suggestion has the required fields
        for suggestion in data:
            assert "orig_column" in suggestion
            assert "suggested_column" in suggestion
            assert "confidence" in suggestion
            assert isinstance(suggestion["confidence"], float)
            assert 0 <= suggestion["confidence"] <= 1

    def test_suggest_mappings_no_matches(self):
        """Test suggesting mappings for columns with no good matches."""
        response = client.post(
            "/suggest-mappings",
            json={"columns": ["completely_unrelated_column", "xyz123"]},
        )

        assert response.status_code == 200
        data = response.json()
        # Should return empty list if no matches above threshold
        assert isinstance(data, list)
        # Depending on threshold, might be empty or have low confidence matches

    def test_suggest_mappings_empty_request(self):
        """Test suggesting mappings with empty columns list."""
        response = client.post("/suggest-mappings", json={"columns": []})

        assert response.status_code == 200
        data = response.json()
        assert data == []

    def test_suggest_mappings_exact_match(self):
        """Test suggesting mappings with exact column name matches."""
        # Add a column
        client.post(
            "/columns",
            json={
                "column_name": "exact_match_test",
                "display_name": "Exact Match Test",
                "data_type": "string",
            },
        )

        response = client.post(
            "/suggest-mappings", json={"columns": ["exact_match_test"]}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["orig_column"] == "exact_match_test"
        assert data[0]["suggested_column"] == "exact_match_test"
        assert data[0]["confidence"] == 1.0  # Exact match should be 1.0


class TestIngestEndpoint:
    def test_ingest_valid_data(self):
        """Test successful ingestion of valid mapped data."""
        # First, add some system columns
        client.post(
            "/columns",
            json={
                "column_name": "local_name",
                "display_name": "Local Name",
                "data_type": "string",
            },
        )
        client.post(
            "/columns",
            json={
                "column_name": "plant_height",
                "display_name": "Plant Height (cm)",
                "data_type": "number",
            },
        )

        # Test data with mappings
        rows = [
            {"orig_name": "Plant A", "height_cm": 150, "extra_col": "ignored"},
            {"orig_name": "Plant B", "height_cm": 200, "extra_col": "ignored"},
        ]
        mappings = [
            {"origColumn": "orig_name", "mappedColumn": "local_name"},
            {"origColumn": "height_cm", "mappedColumn": "plant_height"},
            {"origColumn": "extra_col", "mappedColumn": ""},  # Unmapped
        ]

        response = client.post("/ingest", json={"rows": rows, "mappings": mappings})

        assert response.status_code == 200
        data = response.json()
        assert data["inserted_count"] == 2
        assert data["status"] == "success"

        # Verify data was inserted
        records_response = client.get("/records")
        assert records_response.status_code == 200
        records_data = records_response.json()
        assert len(records_data["records"]) >= 2

        # Check that the data is correctly transformed and stored
        inserted_records = records_data["records"][-2:]  # Get last 2 records
        for record in inserted_records:
            record_data = record["data"]
            assert "local_name" in record_data
            assert "plant_height" in record_data
            assert "extra_col" not in record_data  # Unmapped column should be excluded

    def test_ingest_empty_rows(self):
        """Test ingestion with empty rows list."""
        mappings = [{"origColumn": "col1", "mappedColumn": "field1"}]
        response = client.post("/ingest", json={"rows": [], "mappings": mappings})

        assert response.status_code == 400
        data = response.json()
        assert "No rows provided" in data["detail"]

    def test_ingest_no_mappings(self):
        """Test ingestion with empty mappings list."""
        rows = [{"col1": "value1"}]
        response = client.post("/ingest", json={"rows": rows, "mappings": []})

        assert response.status_code == 400
        data = response.json()
        assert "No mappings provided" in data["detail"]

    def test_ingest_empty_mapped_columns(self):
        """Test ingestion where all mappings have empty mappedColumn."""
        rows = [{"col1": "value1"}]
        mappings = [{"origColumn": "col1", "mappedColumn": ""}]
        response = client.post("/ingest", json={"rows": rows, "mappings": mappings})

        assert response.status_code == 400
        data = response.json()
        assert "No valid mappings provided" in data["detail"]

    def test_ingest_no_transformable_rows(self):
        """Test ingestion where no rows can be transformed due to missing orig columns."""
        rows = [{"col1": "value1"}]
        mappings = [{"origColumn": "missing_col", "mappedColumn": "field1"}]
        response = client.post("/ingest", json={"rows": rows, "mappings": mappings})

        assert response.status_code == 400
        data = response.json()
        assert "No rows could be transformed" in data["detail"]

    def test_ingest_partial_mapping(self):
        """Test ingestion where some rows have partial mappings."""
        # Add system column
        client.post(
            "/columns",
            json={
                "column_name": "local_name",
                "display_name": "Local Name",
                "data_type": "string",
            },
        )

        rows = [
            {"name": "Plant A", "height": 150},  # Both fields present
            {"name": "Plant B"},  # Missing height
        ]
        mappings = [
            {"origColumn": "name", "mappedColumn": "local_name"},
            {"origColumn": "height", "mappedColumn": "plant_height"},
        ]

        response = client.post("/ingest", json={"rows": rows, "mappings": mappings})

        assert response.status_code == 200
        data = response.json()
        assert data["inserted_count"] == 2

        # Verify data - second record should have local_name but not plant_height
        records_response = client.get("/records")
        records_data = records_response.json()
        inserted_records = records_data["records"][-2:]

        assert inserted_records[0]["data"]["local_name"] == "Plant A"
        assert "plant_height" in inserted_records[0]["data"]

        assert inserted_records[1]["data"]["local_name"] == "Plant B"
        assert "plant_height" not in inserted_records[1]["data"]  # Missing orig column
