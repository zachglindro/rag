#!/bin/bash

# Generate .env template if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env template..."
    cat > .env << 'EOF'
# OpenRouter API Key
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Groq API Key
GROQ_API_KEY=your-groq-api-key-here

# Gemini API Key
GEMINI_API_KEY=your-gemini-api-key-here
EOF
    echo ".env template created. Please configure the API keys."
fi

# Load environment variables from .env file
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Function to check if models are ready (have files, not just directories)
check_models_ready() {
    [ -f "/models/jina-reranker-v1-tiny-en/config.json" ] && [ -f "/models/potion-mxbai-micro/config.json" ]
}

# Wait for models to be available with retry logic
MODELS_READY=false
RETRY_COUNT=0
MAX_RETRIES=15  # 15 seconds total (1 second per retry)

while [ "$MODELS_READY" = false ] && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if check_models_ready; then
        MODELS_READY=true
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            sleep 1
        fi
    fi
done

if [ "$MODELS_READY" = true ]; then
    echo "Models found. Skipping download."
else
    echo "Models not found. Downloading required models..."
    python download_models.py --models-dir /models
    if [ $? -ne 0 ]; then
        echo "Warning: Model download failed. Continuing anyway..."
    fi
fi

# Start FastAPI server (production)
exec fastapi run --host 0.0.0.0 --port 8000
