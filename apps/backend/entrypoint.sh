#!/bin/bash

# Check if models need to be downloaded
if [ ! -d "/models/jina-reranker-v1-tiny-en" ] || [ ! -d "/models/potion-mxbai-micro" ] || [ ! -d "/models/Qwen3-0.6B" ]; then
    echo "Models not found. Downloading required models..."
    python download_models.py --models-dir /models
    if [ $? -ne 0 ]; then
        echo "Warning: Model download failed. Continuing anyway..."
    fi
else
    echo "Models found. Skipping download."
fi

# Start FastAPI server
fastapi dev --host 0.0.0.0
