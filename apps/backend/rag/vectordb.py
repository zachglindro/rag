from pathlib import Path
from typing import Any, Mapping, cast
import math

try:
    import chromadb
except Exception as exc:  # pragma: no cover - environment-specific import failures
    chromadb = None
    _CHROMADB_IMPORT_ERROR = exc
else:
    _CHROMADB_IMPORT_ERROR = None

MetadataValue = str | int | float | bool | None | list[str | int | float | bool]
Metadata = Mapping[str, MetadataValue]


class _InMemoryCollection:
    def __init__(self, name: str):
        self.name = name
        self._rows: dict[str, dict[str, Any]] = {}

    def upsert(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]] | list[list[int]],
        metadatas: list[Metadata] | None = None,
    ):
        for idx, item_id in enumerate(ids):
            metadata = metadatas[idx] if metadatas and idx < len(metadatas) else None
            self._rows[item_id] = {
                "id": item_id,
                "document": documents[idx] if idx < len(documents) else "",
                "embedding": [float(v) for v in embeddings[idx]],
                "metadata": dict(metadata) if metadata else None,
            }

    def query(
        self,
        query_embeddings: list[list[float]] | list[list[int]],
        n_results: int = 10,
        include: list[str] | None = None,
    ) -> dict[str, Any]:
        if not query_embeddings:
            return {"ids": [[]], "distances": [[]]}

        query_vec = [float(v) for v in query_embeddings[0]]

        def cosine_distance(a: list[float], b: list[float]) -> float:
            dot = sum(x * y for x, y in zip(a, b, strict=False))
            norm_a = math.sqrt(sum(x * x for x in a))
            norm_b = math.sqrt(sum(y * y for y in b))
            if norm_a == 0.0 or norm_b == 0.0:
                return 1.0
            similarity = dot / (norm_a * norm_b)
            return 1.0 - similarity

        ranked = sorted(
            (
                (row_id, cosine_distance(query_vec, row["embedding"]))
                for row_id, row in self._rows.items()
            ),
            key=lambda item: item[1],
        )[:n_results]

        result_ids = [row_id for row_id, _ in ranked]
        result_distances = [distance for _, distance in ranked]

        response: dict[str, Any] = {"ids": [result_ids]}
        if include is None or "distances" in include:
            response["distances"] = [result_distances]
        return response

    def delete(self, ids: list[str]):
        for item_id in ids:
            self._rows.pop(item_id, None)


class _InMemoryClient:
    def __init__(self):
        self._collections: dict[str, _InMemoryCollection] = {}

    def get_or_create_collection(self, name: str) -> _InMemoryCollection:
        if name not in self._collections:
            self._collections[name] = _InMemoryCollection(name=name)
        return self._collections[name]

    def delete_collection(self, name: str):
        self._collections.pop(name, None)

    def create_collection(self, name: str) -> _InMemoryCollection:
        collection = _InMemoryCollection(name=name)
        self._collections[name] = collection
        return collection


class ChromaVectorDB:
    def __init__(self, persist_directory: str | None = None):
        default_persist_dir = Path(__file__).resolve().parents[1] / "chroma_db"
        resolved_persist_dir = (
            Path(persist_directory).expanduser().resolve()
            if persist_directory
            else default_persist_dir
        )

        self.persist_directory = str(resolved_persist_dir)
        self.using_fallback = False

        if chromadb is None:
            self.using_fallback = True
            self.client = _InMemoryClient()
            self.collection = self.client.get_or_create_collection(
                name="trait_embeddings"
            )
            print(
                "ChromaDB unavailable; using in-memory fallback vector store. "
                f"Reason: {_CHROMADB_IMPORT_ERROR}"
            )
            return

        try:
            self.client = chromadb.PersistentClient(path=self.persist_directory)
            self.collection: Any = self.client.get_or_create_collection(
                name="trait_embeddings"
            )
        except Exception as exc:
            self.using_fallback = True
            self.client = _InMemoryClient()
            self.collection = self.client.get_or_create_collection(
                name="trait_embeddings"
            )
            print(
                "ChromaDB initialization failed; using in-memory fallback vector store. "
                f"Reason: {exc}"
            )

    def get_client(self):
        return self.client

    def get_collection(self):
        return self.collection

    def upsert_documents(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]] | list[list[int]],
        metadatas: list[Metadata] | None = None,
    ):
        self.collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=cast(Any, embeddings),
            metadatas=cast(Any, metadatas),
        )

    def query_embeddings(
        self,
        query_embeddings: list[list[float]] | list[list[int]],
        n_results: int = 10,
        include: list[str] | None = None,
    ) -> dict[str, Any]:
        query_args: dict[str, Any] = {
            "query_embeddings": cast(Any, query_embeddings),
            "n_results": n_results,
        }

        if include is not None:
            query_args["include"] = include

        return cast(dict[str, Any], self.collection.query(**query_args))

    def delete_by_ids(self, ids: list[str]):
        if not ids:
            return
        self.collection.delete(ids=ids)

    def reset_collection(self):
        """Reset the collection by deleting and recreating it."""
        collection_name = self.collection.name
        self.client.delete_collection(collection_name)
        self.collection = self.client.create_collection(name=collection_name)
