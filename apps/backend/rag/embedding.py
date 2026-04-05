from pathlib import Path
from typing import Iterable

from model2vec import StaticModel


class EmbeddingService:
    def __init__(
        self,
        model_path: str | None = None,
        batch_size: int = 16,
    ):
        default_model_path = (
            Path(__file__).resolve().parents[3] / "models" / "potion-mxbai-micro"
        )
        resolved_model_path = (
            Path(model_path).expanduser().resolve()
            if model_path
            else default_model_path
        )

        if not resolved_model_path.exists():
            raise OSError(f"Embedding model path not found: {resolved_model_path}")

        self.model_path = str(resolved_model_path)
        self.batch_size = batch_size

        self.model = StaticModel.from_pretrained(self.model_path)

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        embeddings = self.model.encode(texts)
        return embeddings.tolist()

    def embed(self, text: str) -> list[float]:
        embedded = self.embed_batch([text])
        return embedded[0] if embedded else []


def batched(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]
