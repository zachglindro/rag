import difflib
import io
import json
import sqlite3
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

import pandas as pd
from db.init_db import initialize_database
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

# Local model registry: maps model IDs to local paths
LOCAL_MODEL_REGISTRY = {
    "gemma-4-e2b-it": Path(__file__).resolve().parents[2] / "models" / "gemma-4-E2B-it",
    "qwen3-0.6b": Path(__file__).resolve().parents[2] / "models" / "Qwen3-0.6B",
    "qwen3.5-0.8b": Path(__file__).resolve().parents[2] / "models" / "qwen3.5-0.8b",
}

# Online model registry: maps model IDs to provider model names
ONLINE_MODEL_REGISTRY = {
    "groq": "qwen/qwen3-32b",
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
        provider_model_id = ONLINE_MODEL_REGISTRY[model_id]
        return GroqLLM(model_name=provider_model_id)

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


@app.get("/semantic-search/records", response_model=RecordSearchResponse)
async def search_records(
    query: str = Query(..., min_length=1),
    top_k: int = Query(default=10, ge=1, le=100),
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

    if not ranked_ids:
        return RecordSearchResponse(query=cleaned_query, top_k=top_k, records=[])

    ordered_record_ids: list[int] = []
    distance_by_record_id: dict[int, float | None] = {}
    for idx, raw_record_id in enumerate(ranked_ids):
        try:
            record_id = int(raw_record_id)
        except (TypeError, ValueError):
            continue

        if record_id in distance_by_record_id:
            continue

        distance_value = None
        if idx < len(ranked_distances):
            raw_distance = ranked_distances[idx]
            if isinstance(raw_distance, int | float):
                distance_value = float(raw_distance)

        ordered_record_ids.append(record_id)
        distance_by_record_id[record_id] = distance_value

    if not ordered_record_ids:
        return RecordSearchResponse(query=cleaned_query, top_k=top_k, records=[])

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
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

    # Build rerank candidates from the top vector-retrieved records only.
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

    limited_ids = reranked_ids[:top_k]
    ordered_rows = []
    for record_id in limited_ids:
        row = rows_by_id[record_id]
        row.rerank_score = rerank_score_by_record_id.get(record_id)
        ordered_rows.append(row)

    return RecordSearchResponse(query=cleaned_query, top_k=top_k, records=ordered_rows)


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


@app.get("/settings/model", response_model=ModelSettingsResponse)
async def get_model_settings():
    available_models = []
    for model_id, path_or_name in MODEL_REGISTRY.items():
        try:
            label = MODEL_LABELS.get(model_id, model_id.replace("-", " ").title())
            source = "online" if is_online_model(model_id) else "local"
            available_models.append(
                ModelInfo(
                    id=model_id,
                    label=label,
                    path=str(path_or_name),
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
