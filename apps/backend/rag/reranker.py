from typing import Any

from flashrank import Ranker, RerankRequest  # type: ignore[import-untyped]


class FlashRankService:
    def __init__(self, model_name: str = "ms-marco-MiniLM-L-12-v2"):
        self.model_name = model_name
        self.ranker = Ranker(model_name=model_name)

    def rerank(self, query: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not candidates:
            return []

        request = RerankRequest(query=query, passages=candidates)
        reranked = self.ranker.rerank(request)

        # Normalize to plain Python scalars to avoid JSON serialization failures
        # from numpy-like numeric values (e.g., float32).
        return [self._normalize_item(item) for item in reranked]

    def _normalize_item(self, item: dict[str, Any]) -> dict[str, Any]:
        return {key: self._normalize_value(value) for key, value in item.items()}

    def _normalize_value(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {key: self._normalize_value(nested) for key, nested in value.items()}

        if isinstance(value, list):
            return [self._normalize_value(nested) for nested in value]

        if hasattr(value, "item") and callable(value.item):
            try:
                return value.item()
            except Exception:
                return value

        return value