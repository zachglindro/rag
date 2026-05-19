import os
from typing import Any, Optional
from pathlib import Path
from sentence_transformers import CrossEncoder


class CrossEncoderReranker:
    def __init__(self, model_name: Optional[str] = None):
        if model_name is None:
            # Use MODELS_PATH env var or fall back to relative path
            models_dir = Path(os.getenv("MODELS_PATH", "../../../models"))
            model_name = str(models_dir / "jina-reranker-v1-tiny-en")
        
        self.model = CrossEncoder(model_name, trust_remote_code=True)

    def rerank(
        self, query: str, candidates: list[dict[str, Any]], top_k: int = 20
    ) -> list[dict[str, Any]]:
        if not candidates:
            return []

        # Extract texts for CrossEncoder rank
        texts = [c["text"] for c in candidates]

        results = self.model.rank(query, texts, return_documents=True, top_k=top_k)

        # Map results back to original structure, including the ID
        reranked = []
        for res in results:
            # Match by text content to get the original ID
            # Note: This assumes texts are unique.
            original_candidate = next(
                (c for c in candidates if c["text"] == res["text"]), None
            )

            reranked.append(
                {
                    "text": res["text"],
                    "score": float(res["score"]),
                    "corpus_id": original_candidate.get("corpus_id")
                    if original_candidate
                    else None,
                }
            )

        return reranked
