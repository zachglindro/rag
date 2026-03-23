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
        assert data["columns"] == ["name", "age", "city"]

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
        assert data["columns"] == ["product", "price", "quantity"]

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
        # CSV with inconsistent columns
        csv_content = "name,age\nJohn,25\nJane\nBob,35,extra"
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "malformed.csv"

        response = client.post(
            "/upload", files={"file": ("malformed.csv", csv_file, "text/csv")}
        )

        # pandas should still read the columns from the first row
        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        assert data["columns"] == ["name", "age"]
