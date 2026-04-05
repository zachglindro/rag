from pathlib import Path
from typing import Any, Mapping, cast

import chromadb

MetadataValue = str | int | float | bool | None | list[str | int | float | bool]
Metadata = Mapping[str, MetadataValue]


class ChromaVectorDB:
    def __init__(self, persist_directory: str | None = None):
        default_persist_dir = Path(__file__).resolve().parents[1] / "chroma_db"
        resolved_persist_dir = (
            Path(persist_directory).expanduser().resolve()
            if persist_directory
            else default_persist_dir
        )

        self.persist_directory = str(resolved_persist_dir)
        self.client = chromadb.PersistentClient(path=self.persist_directory)
        self.collection: Any = self.client.get_or_create_collection(
            name="trait_embeddings"
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

    def delete_by_ids(self, ids: list[str]):
        if not ids:
            return
        self.collection.delete(ids=ids)

    def reset_collection(self):
        """Reset the collection by deleting and recreating it."""
        collection_name = self.collection.name
        self.client.delete_collection(collection_name)
        self.collection = self.client.create_collection(name=collection_name)
