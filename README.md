# RAG: Retrieval-Augmented Generation System

A modern, full-stack system for building intelligent search and question-answering applications with hybrid search (semantic + keyword) capabilities.


RAG combines vector-based semantic search with traditional keyword search (BM25) to create a powerful retrieval-augmented generation system. Upload your data and get intelligent responses grounded in your dataset.

**Key capabilities:**
- **Hybrid search**: Combines semantic embeddings and keyword search for best results
- **Vector database**: Chromadb for efficient embedding storage and retrieval
- **Chat interface**: Conversational AI with RAG-grounded responses
- **Data management**: Upload, search, edit, export, and compare records
- **Cross-encoder reranking**: Re-rank results for improved relevance

## Getting Started

### Prerequisites

- **Python 3.8+** (backend)
- **Node.js 18+** (frontend)
- **Docker** (optional, for containerized deployment)
- **Git** for cloning the repository

### Quick Start with Docker

The easiest way to get started:

```bash
git clone https://github.com/zachglindro/rag
cd rag
docker-compose build
docker-compose up
```

Then access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/docs

On first run, the backend will create a `.env` template with API key placeholders. To use cloud-based LLMs, configure your API keys in the generated `.env` file.

### Local Development Setup

#### Backend Setup

```bash
cd apps/backend

# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env  # or create manually with your API keys

# Download models (first run)
python download_models.py
# Optional: Include Qwen3-0.6B model
# python download_models.py --include-qwen

# Start the server
python main.py
```

The backend API will be available at `http://localhost:8000`  
Swagger docs: `http://localhost:8000/docs`

#### Frontend Setup

```bash
cd apps/frontend

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The frontend will be available at `http://localhost:3000`

### Environment Variables

Create a `.env` file in the backend directory:

```env
# API Keys (for cloud-based LLMs)
GROQ_API_KEY=your-groq-api-key
GEMINI_API_KEY=your-gemini-api-key
OPENROUTER_API_KEY=your-openrouter-api-key

# Model paths
MODELS_PATH=/models  # Or your local models directory
```

## Architecture

### Backend (`apps/backend/`)

- **main.py**: FastAPI application with all API endpoints
- **rag/**: Embedding, LLM, reranking, and vector database services
- **db/**: Database initialization and management
- **preprocessing/**: Data preprocessing and record description generation
- **models/**: ML model configurations
- **schemas/**: Pydantic models for API requests/responses

### Frontend (`apps/frontend/`)

- **app/**: Next.js pages (Chat, Data, Compare, Settings)
- **components/**: Reusable React components
- **hooks/**: Custom React hooks
- **contexts/**: React context providers
- **lib/**: Utility functions and types