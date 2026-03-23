## Directory Structure

```
rag/
├── apps/
│   ├── backend/
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── api/                 # REST API endpoints
│   │   │   └── routes/
│   │   ├── rag/                 # RAG pipeline components
│   │   ├── models/              # Pydantic models & DB schemas
│   │   ├── db/                  # Database connections
│   │   ├── preprocessing/       # Data transformation
│   │   └── evaluation/          # Evaluation metrics & tools
│   │
│   └── frontend/                # Next.js application (existing)
│       ├── app/                 # App Router pages
│       ├── components/
│       │   ├── ui/              # shadcn/ui primitives
│       │   └── ...              # Feature components
│       ├── hooks/               # Custom React hooks
│       ├── lib/                 # Utilities
│       └── public/              # Static assets
│
├── docs/
├── models/                      # Local model weights (optional)
│   ├── qwen3-embedding-0.6B/
│   └── qwen3-4b/
│
└── proposed_structure.md        # This file
```
