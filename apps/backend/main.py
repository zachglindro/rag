import difflib
import io
import importlib
import json
import sqlite3
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

import pandas as pd
from db.init_db import initialize_database, create_fts_table
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from preprocessing.description_builder import build_natural_language_description
from pydantic import BaseModel
from rag.embedding import EmbeddingService
from rag.llm import GemmaLLM, GroqLLM
from rag.reranker import FlashRankService
from rag.vectordb import ChromaVectorDB


load_dotenv()

DB_PATH = Path(__file__).parent / "db.sqlite3"

# Minimum rerank score threshold for filtering search results
MINIMUM_RERANK_SCORE = 0.001

# Local model registry: maps model IDs to local paths
LOCAL_MODEL_REGISTRY = {
    "gemma-4-e2b-it": Path(__file__).resolve().parents[2] / "models" / "gemma-4-E2B-it",
    "qwen3-0.6b": Path(__file__).resolve().parents[2] / "models" / "Qwen3-0.6B",
    "qwen3.5-0.8b": Path(__file__).resolve().parents[2] / "models" / "qwen3.5-0.8b",
}

# Online model registry: maps model IDs to provider descriptors
ONLINE_MODEL_REGISTRY = {
    "groq": {"provider": "groq", "model_name": "openai/gpt-oss-120b"},
    "gemini-online": {
        "provider": "gemini",
        "model_name": "gemini-3-flash-preview",
    },
}

MODEL_REGISTRY = {
    **LOCAL_MODEL_REGISTRY,
    **ONLINE_MODEL_REGISTRY,
}

MODEL_LABELS = {
    "gemma-4-e2b-it": "Gemma 4 (Slowest)",
    "qwen3-0.6b": "Qwen 3 (Fast)",
    "qwen3.5-0.8b": "Qwen 3.5 (Slow)",
    "groq": "Groq",
    "gemini-online": "Gemini Online",
}

# Cache of loaded LLM instances
loaded_llms: dict[str, Any] = {}

# Active model ID (server-wide)
active_model_id: str = "qwen3-0.6b"

vectordb = None  # Will be set in lifespan
embedder = None  # Will be set in lifespan
reranker = None  # Will be set in lifespan


def is_online_model(model_id: str) -> bool:
    return model_id in ONLINE_MODEL_REGISTRY


def load_model(model_id: str):
    if is_online_model(model_id):
        provider_config = ONLINE_MODEL_REGISTRY[model_id]
        provider = provider_config["provider"]
        provider_model_id = provider_config["model_name"]

        if provider == "groq":
            return GroqLLM(model_name=provider_model_id)

        if provider == "gemini":
            llm_module = importlib.import_module("rag.llm")
            gemini_llm_cls = getattr(llm_module, "GeminiLLM", None)
            if gemini_llm_cls is None:
                raise RuntimeError("GeminiLLM class is not available in rag.llm")
            return gemini_llm_cls(model_name=provider_model_id)

        raise RuntimeError(f"Unsupported online provider: {provider}")

    return GemmaLLM(str(LOCAL_MODEL_REGISTRY[model_id]))


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database(DB_PATH)
    global loaded_llms
    loaded_llms[active_model_id] = load_model(active_model_id)
    global vectordb
    vectordb = ChromaVectorDB()
    global embedder
    embedder = EmbeddingService()
    global reranker
    reranker = FlashRankService()
    print(f"ChromaDB initialized with persist directory: {vectordb.persist_directory}")
    print("ChromaDB collection 'trait_embeddings' ready")
    print("Embedding service initialized")
    print("FlashRank reranker initialized")
    print(f"Active model: {active_model_id}")
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


class ColumnMapping(BaseModel):
    origColumn: str
    mappedColumn: str


class IngestRequest(BaseModel):
    rows: list[dict[str, Any]]
    mappings: list[ColumnMapping]


class IngestResponse(BaseModel):
    inserted_count: int
    status: str


class MappingSuggestion(BaseModel):
    orig_column: str
    suggested_column: str
    confidence: float


class DeleteColumnRequest(BaseModel):
    column_name: str


class GenerateRequest(BaseModel):
    messages: list[dict[str, str]]
    max_tokens: int = 1024
    task: str = "general"


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


class UpdateRecordRequest(BaseModel):
    data: dict[str, Any]


class RetrievedRecordRow(RecordRow):
    distance: float | None = None
    rerank_score: float | None = None


class RecordSearchResponse(BaseModel):
    query: str
    top_k: int
    records: list[RetrievedRecordRow]


class ModelInfo(BaseModel):
    id: str
    label: str
    path: str
    source: str
    loaded: bool


class ModelSettingsResponse(BaseModel):
    active_model: str
    available_models: list[ModelInfo]


class SwitchModelRequest(BaseModel):
    model_id: str


class CompareSetupResponse(BaseModel):
    indexed_count: int
    setup_duration_ms: int


class CompareStatusResponse(BaseModel):
    ready: bool
    indexed_count: int | None = None
    last_updated: str | None = None


class CompareRebuildResponse(BaseModel):
    indexed_count: int
    rebuild_duration_ms: int


def infer_column_data_type(values: list[Any]) -> str:
    for value in values:
        if value is None:
            continue

        if isinstance(value, bool):
            return "boolean"

        if isinstance(value, int | float):
            return "number"

        if isinstance(value, list):
            return "array"

        if isinstance(value, dict):
            return "object"

        if isinstance(value, str):
            return "string"

    return "string"


def to_display_name(column_name: str) -> str:
    return column_name.replace("_", " ").strip().title() or column_name


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


def build_searchable_text(
    record_data: dict[str, Any], natural_description: str | None
) -> str:
    if natural_description:
        return natural_description
    return json.dumps(record_data, ensure_ascii=False)


def build_export_rows(
    records: list[tuple[Any, ...]], metadata_rows: list[tuple[Any, ...]]
) -> tuple[list[dict[str, Any]], list[str]]:
    ordered_column_names = [str(row[0]) for row in metadata_rows if row and row[0]]
    discovered_columns: set[str] = set(ordered_column_names)
    normalized_records: list[tuple[int, dict[str, Any], Any, Any, Any]] = []

    for record in records:
        record_id = int(record[0])
        record_data = parse_record_data(record[1])
        normalized_records.append(
            (record_id, record_data, record[2], record[3], record[4])
        )

        for key in record_data.keys():
            if key not in discovered_columns:
                ordered_column_names.append(key)
                discovered_columns.add(key)

    export_rows: list[dict[str, Any]] = []
    for (
        record_id,
        record_data,
        natural_description,
        created_at,
        updated_at,
    ) in normalized_records:
        row: dict[str, Any] = {
            "id": record_id,
            "natural_language_description": natural_description,
            "created_at": created_at,
            "updated_at": updated_at,
        }

        for column_name in ordered_column_names:
            value = record_data.get(column_name, None)
            if isinstance(value, dict | list):
                row[column_name] = json.dumps(value, ensure_ascii=False)
            else:
                row[column_name] = value

        export_rows.append(row)

    ordered_export_columns = [
        "id",
        *ordered_column_names,
        "natural_language_description",
        "created_at",
        "updated_at",
    ]
    return export_rows, ordered_export_columns


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


@app.delete("/columns")
async def delete_column(request: DeleteColumnRequest):
    column_name = request.column_name
    if column_name == "id":
        raise HTTPException(status_code=400, detail="Cannot delete the 'id' column")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    embedder_instance = get_embedder()
    vector_db = get_vectordb()

    # Store original metadata for rollback
    cursor.execute(
        "SELECT * FROM column_metadata WHERE column_name = ?",
        (column_name,),
    )
    original_metadata = cursor.fetchone()
    if original_metadata is None:
        raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

    # Store original data for all records (for rollback)
    cursor.execute("SELECT id, data FROM records")
    original_records = cursor.fetchall()

    vector_updated = False

    try:
        conn.execute("BEGIN")

        # Delete from column_metadata
        cursor.execute(
            "DELETE FROM column_metadata WHERE column_name = ?",
            (column_name,),
        )

        # Remove the column from all records' data JSON
        cursor.execute(f"""
            UPDATE records 
            SET data = json_remove(data, '$.{column_name}')
        """)

        # Regenerate descriptions and embeddings for all records
        cursor.execute("SELECT id, data FROM records")
        updated_records = cursor.fetchall()

        new_descriptions = []
        new_embeddings = []
        ids_to_update = []

        for record_id, data_json in updated_records:
            data = parse_record_data(data_json)
            new_description = build_natural_language_description(data)
            new_embedding = embedder_instance.embed(new_description)
            if not new_embedding:
                raise RuntimeError(f"Failed to embed record {record_id}")
            new_descriptions.append(new_description)
            new_embeddings.append(new_embedding)
            ids_to_update.append(str(record_id))

        # Update vector DB
        vector_db.upsert_documents(
            ids=ids_to_update,
            documents=new_descriptions,
            embeddings=new_embeddings,
            metadatas=[{"record_id": int(id)} for id in ids_to_update],
        )
        vector_updated = True

        # Update records with new descriptions
        for i, (record_id, _) in enumerate(updated_records):
            cursor.execute(
                "UPDATE records SET natural_language_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_descriptions[i], record_id),
            )

        conn.commit()
        return {"status": "success", "deleted_column": column_name}
    except Exception as e:
        conn.rollback()

        # Restore metadata
        if original_metadata:
            cursor.execute(
                """
                INSERT INTO column_metadata 
                (column_name, display_name, data_type, is_required, default_value, "order", description) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                original_metadata,
            )

        # Restore records' data
        for record_id, old_data_json in original_records:
            cursor.execute(
                "UPDATE records SET data = ? WHERE id = ?",
                (old_data_json, record_id),
            )

        # Restore vector DB if updated
        if vector_updated:
            try:
                rollback_descriptions = []
                rollback_embeddings = []
                rollback_ids = []
                for record_id, data_json in original_records:
                    data = parse_record_data(data_json)
                    desc = build_natural_language_description(data)
                    emb = embedder_instance.embed(desc)
                    if emb:
                        rollback_descriptions.append(desc)
                        rollback_embeddings.append(emb)
                        rollback_ids.append(str(record_id))
                vector_db.upsert_documents(
                    ids=rollback_ids,
                    documents=rollback_descriptions,
                    embeddings=rollback_embeddings,
                    metadatas=[{"record_id": int(id)} for id in rollback_ids],
                )
            except Exception:
                pass  # Vector DB rollback failed, but continue

        conn.commit()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    finally:
        conn.close()


class RenameColumnRequest(BaseModel):
    old_column_name: str
    new_column: ColumnRequest


@app.put("/columns")
async def rename_column(request: RenameColumnRequest):
    old_column_name = request.old_column_name
    new_column_name = request.new_column.column_name
    if old_column_name == "id":
        raise HTTPException(status_code=400, detail="Cannot rename the 'id' column")

    if request.new_column.column_name == "id":
        raise HTTPException(status_code=400, detail="Cannot rename column to 'id'")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    embedder_instance = get_embedder()
    vector_db = get_vectordb()

    # Check if old column exists
    cursor.execute(
        "SELECT * FROM column_metadata WHERE column_name = ?",
        (old_column_name,),
    )
    original_metadata = cursor.fetchone()
    if original_metadata is None:
        raise HTTPException(
            status_code=404, detail=f"Column '{old_column_name}' not found"
        )

    # Check if new column name already exists (unless it's the same)
    if request.new_column.column_name != old_column_name:
        cursor.execute(
            "SELECT column_name FROM column_metadata WHERE column_name = ?",
            (request.new_column.column_name,),
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail=f"Column '{request.new_column.column_name}' already exists",
            )

    # Store original data for all records (for rollback)
    cursor.execute("SELECT id, data FROM records")
    original_records = cursor.fetchall()

    vector_updated = False

    try:
        conn.execute("BEGIN")

        # Update column_metadata
        cursor.execute(
            """
            UPDATE column_metadata 
            SET column_name = ?, display_name = ?, data_type = ?, is_required = ?, default_value = ?, "order" = ?, description = ?
            WHERE column_name = ?
            """,
            (
                request.new_column.column_name,
                request.new_column.display_name,
                request.new_column.data_type,
                request.new_column.is_required,
                request.new_column.default_value,
                request.new_column.order,
                request.new_column.description,
                old_column_name,
            ),
        )

        # Rename the key in all records' data JSON if column name changed
        if request.new_column.column_name != old_column_name:
            cursor.execute(f"""
                UPDATE records 
                SET data = json_set(json_remove(data, '$.{old_column_name}'), '$.{request.new_column.column_name}', json_extract(data, '$.{old_column_name}'))
            """)

        # Regenerate descriptions and embeddings for all records
        cursor.execute("SELECT id, data FROM records")
        updated_records = cursor.fetchall()

        new_descriptions = []
        new_embeddings = []
        ids_to_update = []

        for record_id, data_json in updated_records:
            data = parse_record_data(data_json)
            new_description = build_natural_language_description(data)
            new_embedding = embedder_instance.embed(new_description)
            if not new_embedding:
                raise RuntimeError(f"Failed to embed record {record_id}")
            new_descriptions.append(new_description)
            new_embeddings.append(new_embedding)
            ids_to_update.append(str(record_id))

        # Update vector DB
        vector_db.upsert_documents(
            ids=ids_to_update,
            documents=new_descriptions,
            embeddings=new_embeddings,
            metadatas=[{"record_id": int(id)} for id in ids_to_update],
        )
        vector_updated = True

        # Update records with new descriptions
        for i, (record_id, _) in enumerate(updated_records):
            cursor.execute(
                "UPDATE records SET natural_language_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_descriptions[i], record_id),
            )

        conn.commit()
        return {
            "status": "success",
            "renamed_column": old_column_name,
            "new_name": request.new_column.column_name,
        }
    except Exception as e:
        conn.rollback()

        # Restore metadata
        cursor.execute(
            """
            UPDATE column_metadata 
            SET column_name = ?, display_name = ?, data_type = ?, is_required = ?, default_value = ?, "order" = ?, description = ?
            WHERE column_name = ?
            """,
            (
                original_metadata[0],  # column_name
                original_metadata[1],  # display_name
                original_metadata[2],  # data_type
                original_metadata[3],  # is_required
                original_metadata[4],  # default_value
                original_metadata[5],  # order
                original_metadata[6],  # description
                new_column_name,  # where clause uses new name if updated
            ),
        )

        # Restore records' data
        for record_id, old_data_json in original_records:
            cursor.execute(
                "UPDATE records SET data = ? WHERE id = ?",
                (old_data_json, record_id),
            )

        # Restore vector DB if updated
        if vector_updated:
            try:
                rollback_descriptions = []
                rollback_embeddings = []
                rollback_ids = []
                for record_id, data_json in original_records:
                    data = parse_record_data(data_json)
                    desc = build_natural_language_description(data)
                    emb = embedder_instance.embed(desc)
                    if emb:
                        rollback_descriptions.append(desc)
                        rollback_embeddings.append(emb)
                        rollback_ids.append(str(record_id))
                vector_db.upsert_documents(
                    ids=rollback_ids,
                    documents=rollback_descriptions,
                    embeddings=rollback_embeddings,
                    metadatas=[{"record_id": int(id)} for id in rollback_ids],
                )
            except Exception:
                pass  # Vector DB rollback failed, but continue

        conn.commit()
        raise HTTPException(status_code=500, detail=f"Rename failed: {str(e)}")
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

        # Normalize headers and row keys to strings so frontend mapping logic
        # can safely treat all column identifiers as text.
        columns = [str(col) for col in df.columns.tolist()]
        rows = [
            {str(key): value for key, value in row.items()}
            for row in df.fillna("").to_dict("records")
        ]

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


@app.post("/ingest", response_model=IngestResponse)
async def ingest_records(request: IngestRequest):
    # Validate request
    if not request.rows:
        raise HTTPException(status_code=400, detail="No rows provided for ingestion")

    if not request.mappings:
        raise HTTPException(status_code=400, detail="No mappings provided")

    # Build mapping dict for quick lookup
    mapping_dict = {
        m.origColumn: m.mappedColumn for m in request.mappings if m.mappedColumn
    }

    if not mapping_dict:
        raise HTTPException(
            status_code=400,
            detail="No valid mappings provided (all mappedColumn are empty)",
        )

    # Transform rows: apply mappings and filter to only mapped columns
    transformed_rows = []
    for row in request.rows:
        transformed = {}
        for orig_col, mapped_col in mapping_dict.items():
            if orig_col in row:
                transformed[mapped_col] = row[orig_col]
        if transformed:  # Only add if at least one field was mapped
            transformed_rows.append(transformed)

    if not transformed_rows:
        raise HTTPException(
            status_code=400,
            detail="No rows could be transformed with the provided mappings",
        )

    descriptions = [
        build_natural_language_description(row_data) for row_data in transformed_rows
    ]

    embedder_instance = get_embedder()
    vector_db = get_vectordb()

    # Insert into database with transaction
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    inserted_ids: list[int] = []
    try:
        conn.execute("BEGIN")

        # Ensure mapped columns are represented in metadata for first-time ingestion.
        unique_mapped_columns = list(dict.fromkeys(mapping_dict.values()))
        for order, mapped_column in enumerate(unique_mapped_columns):
            values_for_column = [
                row[mapped_column]
                for row in transformed_rows
                if mapped_column in row and row[mapped_column] != ""
            ]
            inferred_type = infer_column_data_type(values_for_column)

            cursor.execute(
                """
                INSERT OR IGNORE INTO column_metadata
                (column_name, display_name, data_type, is_required, default_value, "order", description)
                VALUES (?, ?, ?, 0, NULL, ?, ?)
                """,
                (
                    mapped_column,
                    to_display_name(mapped_column),
                    inferred_type,
                    order,
                    "",
                ),
            )

        inserted_count = 0
        for row_data, description in zip(transformed_rows, descriptions, strict=True):
            cursor.execute(
                "INSERT INTO records (data, natural_language_description) VALUES (?, ?)",
                (json.dumps(row_data), description),
            )
            record_id = cursor.lastrowid
            if record_id is None:
                raise RuntimeError("Failed to retrieve inserted record ID")
            inserted_ids.append(int(record_id))
            inserted_count += 1

        embeddings = embedder_instance.embed_batch(descriptions)
        if len(embeddings) != inserted_count:
            raise RuntimeError("Embedding count does not match inserted record count")

        vector_db.upsert_documents(
            ids=[str(record_id) for record_id in inserted_ids],
            documents=descriptions,
            embeddings=embeddings,
            metadatas=[{"record_id": record_id} for record_id in inserted_ids],
        )

        conn.commit()
        return IngestResponse(inserted_count=inserted_count, status="success")
    except Exception as e:
        conn.rollback()

        if inserted_ids:
            try:
                vector_db.delete_by_ids([str(record_id) for record_id in inserted_ids])
            except Exception:
                pass

        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        conn.close()


@app.get("/records", response_model=RecordListResponse)
async def get_records(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    sort_by: str = Query(default="id"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Build ORDER BY clause
        sort_order_upper = sort_order.upper()
        if sort_by in ["id", "created_at", "updated_at"]:
            order_clause = f"ORDER BY {sort_by} {sort_order_upper}"
        else:
            # Assume sort_by is a data column, use json_extract
            order_clause = (
                f"ORDER BY json_extract(data, '$.{sort_by}') {sort_order_upper}"
            )

        cursor.execute(
            f"""
            SELECT id, data, natural_language_description, created_at, updated_at
            FROM records
            {order_clause}
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


@app.put("/records/{record_id}", response_model=RecordRow)
async def update_record(record_id: int, request: UpdateRecordRequest):
    if not request.data:
        raise HTTPException(status_code=400, detail="Record data must not be empty")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    embedder_instance = get_embedder()
    vector_db = get_vectordb()

    vector_updated = False
    old_data: dict[str, Any] | None = None
    old_description: str | None = None

    try:
        cursor.execute(
            """
            SELECT data, natural_language_description
            FROM records
            WHERE id = ?
            """,
            (record_id,),
        )
        existing_row = cursor.fetchone()
        if existing_row is None:
            raise HTTPException(status_code=404, detail="Record not found")

        old_data = parse_record_data(existing_row[0])
        old_description = existing_row[1]

        new_description = build_natural_language_description(request.data)
        new_embedding = embedder_instance.embed(new_description)
        if not new_embedding:
            raise RuntimeError("Failed to embed updated record")

        conn.execute("BEGIN")
        cursor.execute(
            """
            UPDATE records
            SET data = ?, natural_language_description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (json.dumps(request.data), new_description, record_id),
        )

        vector_db.upsert_documents(
            ids=[str(record_id)],
            documents=[new_description],
            embeddings=[new_embedding],
            metadatas=[{"record_id": record_id}],
        )
        vector_updated = True

        conn.commit()

        cursor.execute(
            """
            SELECT id, data, natural_language_description, created_at, updated_at
            FROM records
            WHERE id = ?
            """,
            (record_id,),
        )
        updated_row = cursor.fetchone()
        if updated_row is None:
            raise HTTPException(status_code=404, detail="Record not found")

        return RecordRow(
            id=updated_row[0],
            data=parse_record_data(updated_row[1]),
            natural_language_description=updated_row[2],
            created_at=updated_row[3],
            updated_at=updated_row[4],
        )
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()

        if vector_updated and old_data is not None:
            try:
                rollback_description = (
                    old_description or build_natural_language_description(old_data)
                )
                rollback_embedding = embedder_instance.embed(rollback_description)
                if rollback_embedding:
                    vector_db.upsert_documents(
                        ids=[str(record_id)],
                        documents=[rollback_description],
                        embeddings=[rollback_embedding],
                        metadatas=[{"record_id": record_id}],
                    )
            except Exception:
                pass

        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")
    finally:
        conn.close()


@app.delete("/records/{record_id}")
async def delete_record(record_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    embedder_instance = get_embedder()
    vector_db = get_vectordb()

    vector_deleted = False
    existing_data: dict[str, Any] | None = None
    existing_description: str | None = None

    try:
        cursor.execute(
            """
            SELECT data, natural_language_description
            FROM records
            WHERE id = ?
            """,
            (record_id,),
        )
        existing_row = cursor.fetchone()
        if existing_row is None:
            raise HTTPException(status_code=404, detail="Record not found")

        existing_data = parse_record_data(existing_row[0])
        existing_description = existing_row[1]

        conn.execute("BEGIN")
        cursor.execute("DELETE FROM records WHERE id = ?", (record_id,))

        vector_db.delete_by_ids([str(record_id)])
        vector_deleted = True

        conn.commit()
        return {"status": "success", "deleted_id": record_id}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()

        if vector_deleted and existing_data is not None:
            try:
                rollback_description = (
                    existing_description
                    or build_natural_language_description(existing_data)
                )
                rollback_embedding = embedder_instance.embed(rollback_description)
                if rollback_embedding:
                    vector_db.upsert_documents(
                        ids=[str(record_id)],
                        documents=[rollback_description],
                        embeddings=[rollback_embedding],
                        metadatas=[{"record_id": record_id}],
                    )
            except Exception:
                pass

        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    finally:
        conn.close()


@app.get("/semantic-search/records", response_model=RecordSearchResponse)
async def search_records(
    query: str = Query(..., min_length=1),
    top_k: int = Query(default=10, ge=1, le=100),
    sort_by: str = Query(default=""),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
):
    cleaned_query = query.strip()
    if not cleaned_query:
        raise HTTPException(status_code=400, detail="Query must not be empty")

    embedder_instance = get_embedder()
    vector_db = get_vectordb()

    query_embedding = embedder_instance.embed(cleaned_query)
    if not query_embedding:
        raise HTTPException(status_code=500, detail="Failed to embed query")

    rerank_candidate_count = 20
    combined_record_ids: set[int] = set()
    distance_by_record_id: dict[int, float | None] = {}
    bm25_score_by_record_id: dict[int, float | None] = {}

    # Get candidates from semantic search (vector DB)
    try:
        retrieval = vector_db.query_embeddings(
            query_embeddings=[query_embedding],
            n_results=rerank_candidate_count,
            include=["distances"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Semantic search failed: {str(e)}")

    raw_ids = retrieval.get("ids", [[]])
    raw_distances = retrieval.get("distances", [[]])
    ranked_ids = raw_ids[0] if raw_ids else []
    ranked_distances = raw_distances[0] if raw_distances else []

    for idx, raw_record_id in enumerate(ranked_ids):
        try:
            record_id = int(raw_record_id)
        except (TypeError, ValueError):
            continue

        combined_record_ids.add(record_id)

        distance_value = None
        if idx < len(ranked_distances):
            raw_distance = ranked_distances[idx]
            if isinstance(raw_distance, int | float):
                distance_value = float(raw_distance)

        distance_by_record_id[record_id] = distance_value

    # Get candidates from keyword search (FTS) if available
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='records_fts'
        """)
        fts_available = cursor.fetchone() is not None

        if fts_available:
            try:
                cursor.execute(
                    """
                    SELECT record_id, bm25(records_fts)
                    FROM records_fts
                    WHERE content MATCH ?
                    ORDER BY bm25(records_fts)
                    LIMIT ?
                """,
                    (cleaned_query, rerank_candidate_count),
                )
                fts_results = cursor.fetchall()

                for record_id, bm25_score in fts_results:
                    combined_record_ids.add(record_id)
                    bm25_score_by_record_id[record_id] = float(bm25_score)
            except Exception:
                # If FTS search fails, continue with just semantic results
                pass

        if not combined_record_ids:
            return RecordSearchResponse(query=cleaned_query, top_k=top_k, records=[])

        # Fetch all combined records
        ordered_record_ids = sorted(combined_record_ids)
        placeholders = ",".join("?" for _ in ordered_record_ids)
        cursor.execute(
            f"""
            SELECT id, data, natural_language_description, created_at, updated_at
            FROM records
            WHERE id IN ({placeholders})
            """,
            ordered_record_ids,
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    rows_by_id = {
        row[0]: RetrievedRecordRow(
            id=row[0],
            data=parse_record_data(row[1]),
            natural_language_description=row[2],
            created_at=row[3],
            updated_at=row[4],
            distance=distance_by_record_id.get(row[0]),
        )
        for row in rows
    }

    # Build rerank candidates from all combined records
    rerank_candidates: list[dict[str, Any]] = []
    for record_id in ordered_record_ids:
        if record_id not in rows_by_id:
            continue

        record = rows_by_id[record_id]
        candidate_text = (
            record.natural_language_description
            if record.natural_language_description
            else json.dumps(record.data)
        )
        rerank_candidates.append({"id": str(record_id), "text": candidate_text})

    reranker_instance = get_reranker()
    try:
        reranked = reranker_instance.rerank(cleaned_query, rerank_candidates)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reranking failed: {str(e)}")

    reranked_ids: list[int] = []
    rerank_score_by_record_id: dict[int, float | None] = {}
    for item in reranked:
        raw_id = item.get("id")
        if not isinstance(raw_id, str | int):
            continue
        try:
            record_id = int(raw_id)
        except (TypeError, ValueError):
            continue

        if record_id not in rows_by_id or record_id in rerank_score_by_record_id:
            continue

        raw_score = item.get("score")
        score_value = float(raw_score) if isinstance(raw_score, int | float) else None

        reranked_ids.append(record_id)
        rerank_score_by_record_id[record_id] = score_value

    if not reranked_ids:
        reranked_ids = [
            record_id for record_id in ordered_record_ids if record_id in rows_by_id
        ]
        # No scores available, skip filtering
        filtered_ids = reranked_ids
    else:
        # Filter by rerank_score >= MINIMUM_RERANK_SCORE
        filtered_ids = []
        for rid in reranked_ids:
            score = rerank_score_by_record_id.get(rid)
            if score is not None and score >= MINIMUM_RERANK_SCORE:
                filtered_ids.append(rid)

    ordered_rows = []
    for record_id in filtered_ids:
        row = rows_by_id[record_id]
        row.rerank_score = rerank_score_by_record_id.get(record_id)
        ordered_rows.append(row)

    # Apply user-specified sorting if provided
    if sort_by:
        reverse = sort_order == "desc"

        def sort_key(row):
            if sort_by == "id":
                return row.id
            elif sort_by == "created_at":
                return row.created_at or ""
            elif sort_by == "updated_at":
                return row.updated_at or ""
            elif sort_by == "distance":
                return row.distance if row.distance is not None else float("inf")
            else:
                # Assume data field
                value = row.data.get(sort_by)
                if value is None:
                    return ""
                return str(value)  # Handle mixed types by converting to string

        ordered_rows.sort(key=sort_key, reverse=reverse)

    return RecordSearchResponse(
        query=cleaned_query, top_k=len(ordered_rows), records=ordered_rows
    )


@app.post("/reset-database")
async def reset_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Drop existing tables
        cursor.execute("DROP TABLE IF EXISTS records")
        cursor.execute("DROP TABLE IF EXISTS column_metadata")
        cursor.execute("DROP TABLE IF EXISTS records_fts")

        # Recreate tables
        from db.init_db import create_tables

        create_tables(cursor)

        conn.commit()

        # Reset ChromaDB collection
        global vectordb
        if vectordb is not None:
            vectordb.reset_collection()

        return {"message": "Database and ChromaDB reset successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/compare/setup", response_model=CompareSetupResponse)
async def setup_compare_mode():
    import time

    start_time = time.time()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Create FTS table if not exists
        create_fts_table(cursor)

        # Clear existing FTS data
        cursor.execute("DELETE FROM records_fts")

        # Fetch all records
        cursor.execute("""
            SELECT id, data, natural_language_description
            FROM records
        """)
        records = cursor.fetchall()

        # Insert into FTS
        indexed_count = 0
        for record in records:
            record_id, data, natural_description = record
            content = build_searchable_text(
                parse_record_data(data), natural_description
            )
            cursor.execute(
                """
                INSERT INTO records_fts (record_id, content)
                VALUES (?, ?)
            """,
                (record_id, content),
            )
            indexed_count += 1

        conn.commit()

        duration_ms = int((time.time() - start_time) * 1000)
        return CompareSetupResponse(
            indexed_count=indexed_count, setup_duration_ms=duration_ms
        )
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Setup failed: {str(e)}")
    finally:
        conn.close()


@app.get("/compare/status", response_model=CompareStatusResponse)
async def get_compare_status():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Check if FTS table exists and has data
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='records_fts'
        """)
        table_exists = cursor.fetchone() is not None

        if not table_exists:
            return CompareStatusResponse(ready=False)

        cursor.execute("SELECT COUNT(*) FROM records_fts")
        count = cursor.fetchone()[0]

        # For simplicity, no last_updated tracking yet
        return CompareStatusResponse(ready=True, indexed_count=count, last_updated=None)
    finally:
        conn.close()


@app.post("/compare/rebuild", response_model=CompareRebuildResponse)
async def rebuild_compare_index():
    import time

    start_time = time.time()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Check if table exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='records_fts'
        """)
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=400,
                detail="Compare mode not set up. Call /compare/setup first.",
            )

        # Clear and rebuild
        cursor.execute("DELETE FROM records_fts")

        cursor.execute("""
            SELECT id, data, natural_language_description
            FROM records
        """)
        records = cursor.fetchall()

        indexed_count = 0
        for record in records:
            record_id, data, natural_description = record
            content = build_searchable_text(
                parse_record_data(data), natural_description
            )
            cursor.execute(
                """
                INSERT INTO records_fts (record_id, content)
                VALUES (?, ?)
            """,
                (record_id, content),
            )
            indexed_count += 1

        conn.commit()

        duration_ms = int((time.time() - start_time) * 1000)
        return CompareRebuildResponse(
            indexed_count=indexed_count, rebuild_duration_ms=duration_ms
        )
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Rebuild failed: {str(e)}")
    finally:
        conn.close()


@app.get("/keyword-search/records", response_model=RecordSearchResponse)
async def search_records_keyword(
    query: str = Query(..., min_length=1),
    top_k: int = Query(default=10, ge=1, le=100),
    sort_by: str = Query(default=""),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
):
    cleaned_query = query.strip()
    if not cleaned_query:
        raise HTTPException(status_code=400, detail="Query must not be empty")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Check if compare mode is ready
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='records_fts'
        """)
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=409,
                detail="Keyword search not available. Set up compare mode first via POST /compare/setup.",
            )

        # Perform FTS search with BM25
        candidate_limit = 100
        cursor.execute(
            """
            SELECT record_id, bm25(records_fts)
            FROM records_fts
            WHERE content MATCH ?
            ORDER BY bm25(records_fts)
            LIMIT ?
        """,
            (cleaned_query, candidate_limit),
        )

        fts_results = cursor.fetchall()

        if not fts_results:
            return RecordSearchResponse(query=cleaned_query, top_k=top_k, records=[])

        # Get record IDs
        record_ids = [row[0] for row in fts_results]
        bm25_scores = {row[0]: row[1] for row in fts_results}

        # Fetch full records
        placeholders = ",".join("?" for _ in record_ids)
        cursor.execute(
            f"""
            SELECT id, data, natural_language_description, created_at, updated_at
            FROM records
            WHERE id IN ({placeholders})
        """,
            record_ids,
        )

        rows = cursor.fetchall()

        rows_by_id = {
            row[0]: RetrievedRecordRow(
                id=row[0],
                data=parse_record_data(row[1]),
                natural_language_description=row[2],
                created_at=row[3],
                updated_at=row[4],
                rerank_score=bm25_scores.get(row[0]),  # Using rerank_score for BM25
            )
            for row in rows
        }

        # Order by BM25 score (already sorted by FTS)
        ordered_rows = [rows_by_id[rid] for rid in record_ids if rid in rows_by_id]

        # Apply user sorting if specified
        if sort_by:
            reverse = sort_order == "desc"

            def sort_key(row):
                if sort_by == "id":
                    return row.id
                elif sort_by == "created_at":
                    return row.created_at or ""
                elif sort_by == "updated_at":
                    return row.updated_at or ""
                elif sort_by == "rerank_score":
                    return (
                        row.rerank_score
                        if row.rerank_score is not None
                        else float("inf")
                    )
                else:
                    # Assume data field
                    value = row.data.get(sort_by)
                    if value is None:
                        return ""
                    return str(value)

            ordered_rows.sort(key=sort_key, reverse=reverse)

        limited_rows = ordered_rows[:top_k]

        return RecordSearchResponse(
            query=cleaned_query, top_k=top_k, records=limited_rows
        )
    finally:
        conn.close()


@app.get("/settings/model", response_model=ModelSettingsResponse)
async def get_model_settings():
    available_models = []
    for model_id, model_value in MODEL_REGISTRY.items():
        try:
            label = MODEL_LABELS.get(model_id, model_id.replace("-", " ").title())
            source = "online" if is_online_model(model_id) else "local"
            path_or_name = (
                model_value["model_name"]
                if isinstance(model_value, dict)
                else str(model_value)
            )
            available_models.append(
                ModelInfo(
                    id=model_id,
                    label=label,
                    path=path_or_name,
                    source=source,
                    loaded=model_id in loaded_llms,
                )
            )
        except Exception as e:
            print(f"Error processing {model_id}: {e}")
    return ModelSettingsResponse(
        active_model=active_model_id,
        available_models=available_models,
    )


@app.get("/export-data")
async def export_data(format: str = Query(..., pattern="^(csv|xlsx)$")):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT column_name, "order"
            FROM column_metadata
            ORDER BY "order" ASC, column_name ASC
            """
        )
        metadata_rows = cursor.fetchall()

        cursor.execute(
            """
            SELECT id, data, natural_language_description, created_at, updated_at
            FROM records
            ORDER BY id ASC
            """
        )
        records = cursor.fetchall()

        export_rows, ordered_export_columns = build_export_rows(records, metadata_rows)
        records_df = pd.DataFrame(export_rows)
        if not records_df.empty:
            records_df = records_df.reindex(columns=ordered_export_columns)

        metadata_df = pd.DataFrame(
            [
                {
                    "column_name": row[0],
                    "order": row[1],
                }
                for row in metadata_rows
            ]
        )

        bytes_buffer = io.BytesIO()
        text_buffer = io.StringIO()

        content = b""
        media_type = ""
        filename = ""

        if format == "csv":
            records_df.to_csv(text_buffer, index=False)
            content = text_buffer.getvalue().encode("utf-8")
            media_type = "text/csv"
            filename = "export_data.csv"
        elif format == "xlsx":
            with pd.ExcelWriter(bytes_buffer, engine="openpyxl") as writer:
                records_df.to_excel(writer, sheet_name="records", index=False)
                metadata_df.to_excel(writer, sheet_name="column_metadata", index=False)
            content = bytes_buffer.getvalue()
            media_type = (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            filename = "export_data.xlsx"

        response = StreamingResponse(iter([content]), media_type=media_type)
        response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
    finally:
        conn.close()


@app.post("/settings/model")
async def switch_model(request: SwitchModelRequest):
    global active_model_id
    if request.model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=400, detail="Invalid model ID")

    # If selecting an online model, unload all local models for performance.
    if is_online_model(request.model_id):
        for model_id in list(loaded_llms.keys()):
            if model_id in LOCAL_MODEL_REGISTRY:
                loaded_llms[model_id].cleanup()
                del loaded_llms[model_id]
    # If selecting a local model, keep only that local model loaded.
    elif request.model_id != active_model_id:
        for model_id in list(loaded_llms.keys()):
            if model_id in LOCAL_MODEL_REGISTRY and model_id != request.model_id:
                loaded_llms[model_id].cleanup()
                del loaded_llms[model_id]

    # Lazy load the new model if not already loaded
    if request.model_id not in loaded_llms:
        try:
            loaded_llms[request.model_id] = load_model(request.model_id)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    active_model_id = request.model_id
    return {"message": f"Switched to model {request.model_id}"}


def get_llm() -> Any:
    if active_model_id not in loaded_llms:
        raise RuntimeError(f"Active model {active_model_id} is not loaded")
    return loaded_llms[active_model_id]


def get_vectordb() -> ChromaVectorDB:
    if vectordb is None:
        raise RuntimeError("Vector DB was not initialized during startup")

    return vectordb


def get_embedder() -> EmbeddingService:
    if embedder is None:
        raise RuntimeError("Embedding service was not initialized during startup")

    return embedder


def get_reranker() -> FlashRankService:
    if reranker is None:
        raise RuntimeError("Reranker was not initialized during startup")

    return reranker


@app.post("/generate")
async def generate_response_endpoint(
    request: GenerateRequest, llm_instance: Any = Depends(get_llm)
):
    end_of_stream = object()

    def next_token_or_end(token_iterator):
        try:
            return next(token_iterator)
        except StopIteration:
            return end_of_stream

    async def generate_stream():
        try:
            token_iterator = llm_instance.generate_response(
                request.messages,
                request.max_tokens,
                request.task,
                stream=True,
            )

            while True:
                # Pull the next token off-thread so event loop remains responsive.
                token = await asyncio.to_thread(next_token_or_end, token_iterator)
                if token is end_of_stream:
                    break

                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            payload = json.dumps({"error": str(e)})
            yield f"data: {payload}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")
