# Docker Setup Guide

## Quick Start

With Docker, setting up and running the project is just two commands:

```bash
# Build the Docker images
docker-compose build

# Start both frontend and backend
docker-compose up
```

That's it! No manual venv setup, dependency installation, or model downloading needed.

## What's Included

### Frontend Container
- **Image**: Node 22 Alpine
- **Port**: 3000 (Next.js dev server)
- **Auto-runs**: `pnpm dev`
- **Hot reload**: Enabled via volume mounts

### Backend Container
- **Image**: Python 3.11 Slim
- **Port**: 8000 (FastAPI)
- **Auto-runs**: `fastapi dev`
- **Auto-setup**: Models automatically download on first run if missing
- **Volume**: Models cached between runs

## First-Time Setup

1. **Install Docker Desktop** from [docker.com](https://www.docker.com/products/docker-desktop/)

2. **Navigate to project root**:
   ```bash
   cd /path/to/rag
   ```

3. **Build and start**:
   ```bash
   docker-compose up
   ```

   On first run, the backend container will:
   - Install Python dependencies
   - Check for required models
   - Download models (if missing) to the `./models` volume
   - Start the FastAPI server

4. **Access the app**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

## Daily Development Workflow

### Starting the App
```bash
docker-compose up
```

Both services start simultaneously. Use `-d` to run in background:
```bash
docker-compose up -d
```

### Stopping the App
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend
```

### Rebuild After Dependency Changes

After modifying `requirements.txt`, `requirements-dev.txt`, or `package.json`:
```bash
docker-compose build
docker-compose up
```

## Advanced Usage

### Run Commands in Container

```bash
# Run a Python command in backend
docker-compose exec backend python -c "import torch; print(torch.__version__)"

# Run a pnpm command in frontend
docker-compose exec frontend pnpm run typecheck
```

### Access Database Files

Database files and Chroma vectors are persisted in volumes:
- Backend database: `./apps/backend/db.sqlite3`
- Chroma database: `./apps/backend/chroma_db/`
- Models cache: `./models/`

### Environment Variables

Create `.env` files as usual:
- `./apps/backend/.env` - Backend environment variables
- `./apps/frontend/.env.local` - Frontend environment variables

The `docker-compose.yml` automatically loads `./apps/backend/.env` for the backend container.

### Manual Model Download (Alternative)

If you prefer to download models outside of Docker:
```bash
python download_models.py
```

Then start Docker:
```bash
docker-compose up
```

The backend will detect existing models and skip downloading.

## Troubleshooting

### Port Already in Use
If ports 3000 or 8000 are already in use, modify `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use 3001 instead of 3000
  - "8001:8000"  # Use 8001 instead of 8000
```

### Model Download Fails
Check backend logs:
```bash
docker-compose logs backend
```

Models require internet access during first run. If connection issues occur:
1. Download manually: `python download_models.py`
2. Start Docker: `docker-compose up`

### Container Won't Start
```bash
# View detailed error logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up
```

### Clear Everything and Start Fresh
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## Switching Between Docker and Local Development

If you also develop locally:

**With Docker:**
```bash
docker-compose up
```

**Without Docker:**
```bash
# Terminal 1: Backend
cd apps/backend
source .venv/bin/activate  # or .venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt -r requirements-dev.txt
fastapi dev

# Terminal 2: Frontend
cd apps/frontend
pnpm install
pnpm dev
```

## Benefits of Docker

✅ **No manual setup** - No venv, pip install, or pnpm install needed  
✅ **Consistency** - Same environment everywhere (local, CI/CD, production)  
✅ **Isolation** - System Python/Node aren't affected  
✅ **Easy cleanup** - `docker-compose down` removes everything  
✅ **Model caching** - Models persist between runs  
✅ **Hot reload** - Code changes reflected immediately  
✅ **Networking** - Frontend auto-connects to backend via service names  

## Production Notes

The `docker-compose.yml` is configured for **development** with hot-reloading. For production:

1. Use `next build && next start` for frontend (instead of dev)
2. Use production ASGI server (instead of `fastapi dev`)
3. Add health checks
4. Use environment-specific `.env` files
5. Set `DEBUG=false`

See individual Dockerfiles for how to adapt for production deployments.
