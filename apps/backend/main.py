import difflib
import io
import json
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import pandas as pd
from db.init_db import initialize_database
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from rag.llm import QwenLLM
from rag.vectordb import ChromaVectorDB

DB_PATH = Path(__file__).parent / "db.sqlite3"


llm = None  # Will be set in lifespan
vectordb = None  # Will be set in lifespan


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database(DB_PATH)
    global llm
    llm = QwenLLM()
    global vectordb
    vectordb = ChromaVectorDB()
    print(f"ChromaDB initialized with persist directory: {vectordb.persist_directory}")
    print("ChromaDB collection 'trait_embeddings' ready")
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


class SuggestMappingsRequest(BaseModel):
    columns: list[str]


class MappingSuggestion(BaseModel):
    orig_column: str
    suggested_column: str
    confidence: float


class GenerateRequest(BaseModel):
    messages: list[dict[str, str]]
    max_tokens: int = 1024


class GenerateResponse(BaseModel):
    response: str


class RecordRow(BaseModel):
    id: int
    data: dict[str, Any]
    natural_language_description: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class RecordListResponse(BaseModel):
    records: list[RecordRow]
    skip: int
    limit: int


class ColumnMetadataRow(BaseModel):
    column_name: str
    display_name: str
    data_type: str
    is_required: bool
    default_value: str | None = None
    order: int | None = None
    description: str | None = None


class RecordCountResponse(BaseModel):
    count: int


def parse_record_data(data_value: Any) -> dict[str, Any]:
    if isinstance(data_value, dict):
        return data_value

    if isinstance(data_value, str):
        try:
            parsed = json.loads(data_value)
            if isinstance(parsed, dict):
                return parsed
            return {"value": parsed}
        except json.JSONDecodeError:
            return {"_raw": data_value}

    return {}


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
        rows = []

        if ext == "csv":
            df = pd.read_csv(io.BytesIO(content))
        elif ext == "xlsx":
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Only CSV and XLSX are allowed.",
            )

        columns = df.columns.tolist()
        rows = df.fillna("").to_dict("records")

        return {"columns": columns, "rows": rows, "row_count": len(rows)}
    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400, detail="File appears to be empty or has no valid data."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/suggest-mappings", response_model=list[MappingSuggestion])
async def suggest_mappings(request: SuggestMappingsRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT column_name, display_name FROM column_metadata")
        system_columns = cursor.fetchall()

        possible_matches = []
        for orig_column in request.columns:
            for column_name, display_name in system_columns:
                score_column = difflib.SequenceMatcher(
                    None, orig_column.lower(), column_name.lower()
                ).ratio()
                score_display = difflib.SequenceMatcher(
                    None, orig_column.lower(), display_name.lower()
                ).ratio()

                score = max(score_column, score_display)
                if score > 0.3:
                    possible_matches.append((score, orig_column, column_name))

        # Sort by score descending
        possible_matches.sort(reverse=True, key=lambda x: x[0])

        assigned_systems = set()
        suggestions = []
        for score, orig_column, suggested_column in possible_matches:
            if suggested_column not in assigned_systems:
                assigned_systems.add(suggested_column)
                suggestions.append(
                    MappingSuggestion(
                        orig_column=orig_column,
                        suggested_column=suggested_column,
                        confidence=round(score, 3),
                    )
                )

        return suggestions
    finally:
        conn.close()


@app.get("/records", response_model=RecordListResponse)
async def get_records(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, data, natural_language_description, created_at, updated_at
            FROM records
            ORDER BY id ASC
            LIMIT ? OFFSET ?
            """,
            (limit, skip),
        )
        rows = cursor.fetchall()

        records = [
            RecordRow(
                id=row[0],
                data=parse_record_data(row[1]),
                natural_language_description=row[2],
                created_at=row[3],
                updated_at=row[4],
            )
            for row in rows
        ]

        return RecordListResponse(records=records, skip=skip, limit=limit)
    finally:
        conn.close()


@app.get("/column-metadata", response_model=list[ColumnMetadataRow])
async def get_column_metadata():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT column_name, display_name, data_type, is_required, default_value, "order", description
            FROM column_metadata
            ORDER BY "order" ASC, column_name ASC
            """
        )
        rows = cursor.fetchall()

        return [
            ColumnMetadataRow(
                column_name=row[0],
                display_name=row[1],
                data_type=row[2],
                is_required=bool(row[3]),
                default_value=row[4],
                order=row[5],
                description=row[6],
            )
            for row in rows
        ]
    finally:
        conn.close()


@app.get("/records/count", response_model=RecordCountResponse)
async def get_record_count():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT COUNT(*) FROM records")
        count = cursor.fetchone()[0]
        return RecordCountResponse(count=count)
    finally:
        conn.close()


@app.get("/records/{record_id}", response_model=RecordRow)
async def get_record(record_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, data, natural_language_description, created_at, updated_at
            FROM records
            WHERE id = ?
            """,
            (record_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Record not found")

        return RecordRow(
            id=row[0],
            data=parse_record_data(row[1]),
            natural_language_description=row[2],
            created_at=row[3],
            updated_at=row[4],
        )
    finally:
        conn.close()


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


def get_llm() -> QwenLLM:
    if llm is None:
        raise RuntimeError("LLM was not initialized during startup")

    return llm


@app.post("/generate")
async def generate_response_endpoint(
    request: GenerateRequest, llm_instance: QwenLLM = Depends(get_llm)
):
    async def generate_stream():
        try:
            for token in llm_instance.generate_response(
                request.messages, request.max_tokens, stream=True
            ):
                yield f'data: {{"token": "{token.replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r")}"}}\n\n'
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f'data: {{"error": "{str(e).replace('"', '\\"')}"}}\n\n'

    return StreamingResponse(generate_stream(), media_type="text/event-stream")
