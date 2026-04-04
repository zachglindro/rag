from pathlib import Path
from typing import Iterable

import torch
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer


class QwenEmbeddingService:
    def __init__(
        self,
        model_path: str | None = None,
        batch_size: int = 16,
        max_length: int = 512,
    ):
        default_model_path = (
            Path(__file__).resolve().parents[3] / "models" / "Qwen3-Embedding-0.6B"
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
        self.max_length = max_length

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
        self.model = AutoModel.from_pretrained(
            self.model_path,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto",
        )

    @staticmethod
    def _mean_pool(last_hidden_state: torch.Tensor, attention_mask: torch.Tensor):
        mask = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
        masked_embeddings = last_hidden_state * mask
        sum_embeddings = masked_embeddings.sum(dim=1)
        sum_mask = mask.sum(dim=1).clamp(min=1e-9)
        return sum_embeddings / sum_mask

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        all_embeddings: list[list[float]] = []
        self.model.eval()

        with torch.no_grad():
            for i in range(0, len(texts), self.batch_size):
                batch = texts[i : i + self.batch_size]
                encoded = self.tokenizer(
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=self.max_length,
                    return_tensors="pt",
                )

                outputs = self.model(**encoded)
                pooled = self._mean_pool(
                    outputs.last_hidden_state, encoded["attention_mask"]
                )
                normalized = F.normalize(pooled, p=2, dim=1)
                all_embeddings.extend(normalized.cpu().tolist())

        return all_embeddings

    def embed(self, text: str) -> list[float]:
        embedded = self.embed_batch([text])
        return embedded[0] if embedded else []


def batched(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]
