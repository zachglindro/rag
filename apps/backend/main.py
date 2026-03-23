import io
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from db.init_db import initialize_database
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

DB_PATH = Path(__file__).parent / "db.sqlite3"


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database(DB_PATH)
    yield


app = FastAPI(lifespan=lifespan)


class ColumnRequest(BaseModel):
    column_name: str
    display_name: str
    data_type: str  # e.g., 'string', 'number'
    is_required: bool = False
    default_value: str = "null"  # JSON string, e.g., "null" or '"default"'
    order: int = 0
    description: str = ""


@app.post("/columns")
async def add_column(request: ColumnRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Insert into column_metadata
        cursor.execute(
            """
            INSERT INTO column_metadata 
            (column_name, display_name, data_type, is_required, default_value, "order", description) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            (
                request.column_name,
                request.display_name,
                request.data_type,
                request.is_required,
                request.default_value,
                request.order,
                request.description,
            ),
        )

        # Update existing records to include the new field with default value
        cursor.execute(f"""
            UPDATE records 
            SET data = json_set(data, '$.{request.column_name}', {request.default_value})
        """)

        conn.commit()
        return {"message": f"Column '{request.column_name}' added successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400, detail=f"Column '{request.column_name}' already exists"
        )
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.split(".")[-1].lower()
    if ext not in ["csv", "xlsx"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only CSV and XLSX are allowed.",
        )

    try:
        content = await file.read()
        columns = []

        if ext == "csv":
            df = pd.read_csv(io.BytesIO(content), nrows=0)
            columns = df.columns.tolist()
        elif ext == "xlsx":
            df = pd.read_excel(io.BytesIO(content), nrows=0)
            columns = df.columns.tolist()

        return {"columns": columns}
    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400, detail="File appears to be empty or has no valid data."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/reset-database")
async def reset_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Drop existing tables
        cursor.execute("DROP TABLE IF EXISTS records")
        cursor.execute("DROP TABLE IF EXISTS column_metadata")

        # Recreate tables
        from db.init_db import create_tables

        create_tables(cursor)

        conn.commit()
        return {"message": "Database reset successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/")
async def read_root():
    return {"Hello": "World"}
