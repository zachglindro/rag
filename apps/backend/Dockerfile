FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements files
COPY apps/backend/requirements.txt apps/backend/requirements-dev.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r requirements-dev.txt

# Copy application code
COPY apps/backend ./

# Copy models download script
COPY apps/backend/download_models.py ./download_models.py

# Copy entrypoint script
COPY apps/backend/entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# Create models directory
RUN mkdir -p /models

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV MODELS_PATH=/models

# Expose port for FastAPI
EXPOSE 8000

# Run entrypoint script
CMD ["/bin/bash", "./entrypoint.sh"]
