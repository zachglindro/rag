#!/usr/bin/env python3
"""
Script to download required models from Hugging Face for the RAG project.

This script downloads:
- jina-reranker-v1-tiny-en (jinaai)
- potion-mxbai-micro (blobbybob)
- Qwen3-0.6B (Qwen)

Models are stored in the ./models directory (created automatically if it doesn't exist).
"""

import sys
from pathlib import Path

try:
    from huggingface_hub import snapshot_download
except ImportError:
    print("Error: huggingface_hub is not installed.")
    print("Please install it with: pip install huggingface-hub")
    sys.exit(1)


def download_models():
    """Download all required models."""
    # Define models to download
    models = [
        {
            "repo_id": "jinaai/jina-reranker-v1-tiny-en",
            "model_name": "jina-reranker-v1-tiny-en",
            "description": "Jina Reranker v1 Tiny EN",
        },
        {
            "repo_id": "blobbybob/potion-mxbai-micro",
            "model_name": "potion-mxbai-micro",
            "description": "Potion MXBai Micro",
        },
        {
            "repo_id": "Qwen/Qwen3-0.6B",
            "model_name": "Qwen3-0.6B",
            "description": "Qwen 3 0.6B",
        },
    ]

    # Create models directory if it doesn't exist
    models_dir = Path("models")
    models_dir.mkdir(parents=True, exist_ok=True)
    print(f"Models directory: {models_dir.resolve()}\n")

    # Download each model
    failed_models = []

    for model_info in models:
        repo_id = model_info["repo_id"]
        model_name = model_info["model_name"]
        description = model_info["description"]

        model_path = models_dir / model_name

        print(f"Downloading {description}...")
        print(f"  Repository: {repo_id}")
        print(f"  Destination: {model_path.resolve()}")

        try:
            snapshot_download(
                repo_id=repo_id,
                local_dir=str(model_path),
                local_dir_use_symlinks=False,
            )
            print("  ✓ Successfully downloaded\n")
        except Exception as e:
            print(f"  ✗ Failed to download: {e}\n")
            failed_models.append(model_name)

    # Summary
    print("=" * 60)
    if failed_models:
        print(f"Download completed with {len(failed_models)} error(s):")
        for model in failed_models:
            print(f"  - {model}")
        return False
    else:
        print("All models downloaded successfully!")
        return True


if __name__ == "__main__":
    success = download_models()
    sys.exit(0 if success else 1)
