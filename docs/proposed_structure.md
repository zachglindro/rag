# Proposed Codebase Structure

This document outlines the recommended organization for the RAG-based semantic search system as specified in the research paper (Section III: Materials and Methods).

## Directory Structure

```
rag/
├── apps/
│   ├── backend/
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── api/                 # REST API endpoints
│   │   │   └── routes/
│   │   │       ├── search.py    # Semantic search endpoint
│   │   │       ├── upload.py    # Data ingestion endpoint
│   │   │       └── baseline.py  # Keyword-based baseline search
│   │   ├── rag/                 # RAG pipeline components
│   │   │   ├── retriever.py     # Vector search logic (ANN)
│   │   │   ├── generator.py     # LLM response generation
│   │   │   └── embeddings.py    # Qwen3-Embedding integration
│   │   ├── models/              # Pydantic models & DB schemas
│   │   │   ├── schemas.py       # Request/response schemas
│   │   │   └── tables.py        # SQLAlchemy table definitions
│   │   ├── db/                  # Database connections
│   │   │   ├── sqlite.py        # Relational DB (original data)
│   │   │   └── chroma.py        # Vector DB (embeddings)
│   │   ├── preprocessing/       # Data transformation
│   │   │   └── serializer.py    # Row → natural language template
│   │   └── evaluation/          # Evaluation metrics & tools
│   │       ├── metrics.py       # Precision@k, Recall@k, MAP
│   │       └── ground_truth.py  # Test dataset generation
│   │
│   └── frontend/                # Next.js application (existing)
│       ├── app/                 # App Router pages
│       │   ├── page.tsx         # Home (search interface)
│       │   ├── add/             # Data upload wizard
│       │   ├── data/            # Data view page
│       │   └── compare/         # Compare lines page
│       ├── components/
│       │   ├── ui/              # shadcn/ui primitives
│       │   └── ...              # Feature components
│       ├── hooks/               # Custom React hooks
│       ├── lib/                 # Utilities
│       └── public/              # Static assets
│
├── docs/
│   ├── glindro-cs190-ieee.tex   # Research paper (IEEE format)
│   ├── generate_synthetic.py    # Synthetic data generator (500 records)
│   └── check_synthetic.py       # Data validation script
│
├── models/                      # Local model weights (optional)
│   ├── qwen3-embedding-0.6B/
│   └── qwen3-4b/
│
└── proposed_structure.md        # This file
```

---

## Backend Components

### 1. Embedding Pipeline (`rag/embeddings.py`)

**Purpose:** Generate dense vector embeddings for phenotypic trait data and user queries.

**Model:** Qwen3-Embedding-0.6B (multilingual, instruction-aware)

**Key Functions:**
- `embed_query(text: str) -> List[float]` - Encode natural language queries
- `embed_document(text: str) -> List[float]` - Encode trait descriptions
- `batch_embed(texts: List[str]) -> List[List[float]]` - Bulk embedding

---

### 2. Preprocessing (`preprocessing/serializer.py`)

**Purpose:** Transform structured spreadsheet rows into natural language descriptions for semantic embedding.

**Template Example:**
```
"Variety [Local name] is a [Kernel type] type with [Tassel color] tassels 
and a plant height of [Plant height] cm. Observations noted 
[# plants lodged] lodged plants and the presence of [Plant disease observed]."
```

**Key Functions:**
- `serialize_row(row: Dict) -> str` - Convert database row to natural language
- `batch_serialize(rows: List[Dict]) -> List[str]` - Bulk serialization

---

### 3. Vector Database (`db/chroma.py`)

**Purpose:** Store and retrieve embeddings using Approximate Nearest Neighbor (ANN) search.

**Technology:** ChromaDB (open-source, persists to disk)

**Key Functions:**
- `initialize_collection(name: str) -> Collection` - Create/get collection
- `add_embeddings(ids: List[str], embeddings: List[List[float]], metadatas: List[Dict])` - Index embeddings
- `search(query_embedding: List[float], top_k: int) -> List[Result]` - Semantic search

---

### 4. Relational Database (`db/sqlite.py`)

**Purpose:** Store original structured phenotypic trait data.

**Schema Fields:**
- Geographic: Region, Province, Municipality, Barangay
- Morphological: Plant height, Ear height, Tassel characteristics, Kernel type/color
- Phenological: Days to anthesis, Days to silking
- Stress resistance: Waterlogging, drought, acidic soil, disease ratings
- Chemical: Starch, protein, fat, fiber, micronutrients
- Pigmentation: Silk, anther, stem, leaf sheath colors

**Key Functions:**
- `init_db()` - Initialize tables
- `insert_records(records: List[Dict])` - Bulk insert
- `get_records_by_ids(ids: List[int]) -> List[Dict]` - Fetch by foreign key

---

### 5. RAG Pipeline (`rag/`)

#### Retriever (`rag/retriever.py`)
**Purpose:** Find top-k semantically similar records using vector search.

**Key Functions:**
- `retrieve(query: str, top_k: int) -> List[Record]` - End-to-end retrieval

#### Generator (`rag/generator.py`)
**Purpose:** Generate context-aware summaries using retrieved data.

**Model:** Qwen3-4B (instruction-tuned, consumer-grade hardware)

**Key Functions:**
- `generate_summary(query: str, context: List[Dict]) -> str` - LLM response generation

---

### 6. API Routes (`api/routes/`)

#### Search Endpoint (`search.py`)
```python
POST /api/search
{
  "query": "varieties that resist lodging and have purple tassels",
  "top_k": 5
}
→ {
  "summary": "...",
  "results": [...]
}
```

#### Upload Endpoint (`upload.py`)
```python
POST /api/upload
- Accepts CSV/Excel file
- Triggers: serialize → embed → store in SQLite + ChromaDB
```

#### Baseline Endpoint (`baseline.py`)
```python
GET /api/baseline?query=lodging+resistance
- SQL LIKE operator for keyword-based search
- Used for evaluation comparison
```

---

### 7. Evaluation Module (`evaluation/`)

#### Metrics (`evaluation/metrics.py`)
**Purpose:** Quantitative assessment of retrieval quality.

**Metrics:**
- **Precision@k:** Proportion of retrieved results that are relevant
- **Recall@k:** Proportion of all relevant records retrieved
- **Mean Average Precision (MAP):** Ranking quality across all queries

#### Ground Truth (`evaluation/ground_truth.py`)
**Purpose:** Generate test dataset for evaluation.

**Process:**
1. Create 20 representative queries (simple → complex)
2. Manually identify relevant record IDs for each query
3. Store as evaluation benchmark

---

## Technology Stack Summary

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Backend Framework** | FastAPI (Python) | High performance, auto API docs |
| **Frontend Framework** | Next.js 16 + React | SSR/SSG, shadcn/ui components |
| **UI Library** | shadcn/ui + Tailwind CSS v4 | Accessible, customizable |
| **Embedding Model** | Qwen3-Embedding-0.6B | Multilingual, instruction-aware |
| **Vector Database** | ChromaDB | Open-source, simple, persists to disk |
| **Relational Database** | SQLite | Lightweight, self-hosted |
| **LLM (Generator)** | Qwen3-4B | Instruction-tuned, consumer hardware |
| **Baseline Search** | SQL LIKE | Traditional keyword matching |

---

## Data Flow

1. **Ingestion:**
   ```
   CSV/Excel → Serializer → Embedding Model → SQLite + ChromaDB
   ```

2. **Query:**
   ```
   User Query → Embedding Model → ChromaDB (ANN search) 
   → SQLite (fetch records) → LLM Generator → Response
   ```

---

## Notes

- **Scale:** Designed for ~500 synthetic records (small-scale, self-hosted)
- **Users:** 5-8 researchers/lab technicians at Institute of Plant Breeding
- **Deployment:** Local server (no enterprise-scale requirements)
- **Evaluation:** Compare semantic vs. keyword search using Precision@k, Recall@k, MAP
