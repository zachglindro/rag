# Quick Command Reference

## Initial Setup (One Time)
```bash
docker-compose build
```

## Daily Development
```bash
# Start everything
docker-compose up

# Stop everything
docker-compose down

# View logs
docker-compose logs -f
```

## Common Tasks
```bash
# Rebuild after dependency changes
docker-compose build && docker-compose up

# Run backend command
docker-compose exec backend python download_models.py

# Run frontend command
docker-compose exec frontend pnpm run build

# Full reset
docker-compose down -v && docker-compose build --no-cache && docker-compose up
```

## Access
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs
