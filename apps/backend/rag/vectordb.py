from pathlib import Path

import chromadb


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
        self.collection = self.client.get_or_create_collection(name="trait_embeddings")

    def get_client(self):
        return self.client

    def get_collection(self):
        return self.collection
