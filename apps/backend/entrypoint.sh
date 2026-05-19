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
