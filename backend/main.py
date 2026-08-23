import asyncio
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Vector Semantic Search API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DocumentInput(BaseModel):
    id: str
    text: str
    title: str = ""
    timestamp: str = "00:00:00"
    seconds: float = 0.0
    snippet: str = ""
    category: str = ""
    video_url: str = ""
    subtitle_url: str = ""

class SearchQuery(BaseModel):
    query: str
    top_k: Optional[int] = 3

class ThreadSafeSemanticSearchEngine:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.index: Optional[faiss.IndexFlatIP] = None
        self.documents: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()

    def _encode_and_normalize(self, texts: List[str]) -> np.ndarray:
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        faiss.normalize_L2(embeddings)
        return embeddings.astype(np.float32)

    async def index_documents(self, documents: List[Dict[str, Any]], text_field: str = "text") -> int:
        async with self._lock:
            self.documents = documents
            texts = [doc[text_field] for doc in documents]
            loop = asyncio.get_running_loop()
            embeddings = await loop.run_in_executor(None, self._encode_and_normalize, texts)
            dimension = embeddings.shape[1]
            new_index = faiss.IndexFlatIP(dimension)
            new_index.add(embeddings)
            self.index = new_index
            return len(self.documents)

    async def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        async with self._lock:
            if self.index is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="FAISS Index uninitialized. Index documents first.")
            loop = asyncio.get_running_loop()
            query_vector = await loop.run_in_executor(None, self._encode_and_normalize, [query])
            scores, indices = self.index.search(query_vector, top_k)
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx != -1 and idx < len(self.documents):
                    doc = self.documents[idx].copy()
                    doc["score"] = float(score)
                    results.append(doc)
            return results

engine = ThreadSafeSemanticSearchEngine()

DEFAULT_DOCUMENTS = [
    {
        "id": "1",
        "text": "Local demo video start timestamp zero.",
        "title": "Local Demo Clip: Start",
        "timestamp": "00:00:00",
        "seconds": 0,
        "snippet": "Local demo video loaded from /videos/demo.mp4.",
        "category": "Local",
        "video_url": "/videos/demo.mp4",
        "subtitle_url": "./subtitles/demo.vtt",
    },
    {
        "id": "2",
        "text": "Local demo video middle timestamp five seconds.",
        "title": "Local Demo Clip: Middle",
        "timestamp": "00:00:05",
        "seconds": 5,
        "snippet": "Jump to the middle of the local demo video.",
        "category": "Local",
        "video_url": "/videos/demo.mp4",
        "subtitle_url": "./subtitles/demo.vtt",
    },
    {
        "id": "3",
        "text": "Local demo video later timestamp ten seconds.",
        "title": "Local Demo Clip: Later",
        "timestamp": "00:00:10",
        "seconds": 10,
        "snippet": "Jump to a later point in the local demo video.",
        "category": "Local",
        "video_url": "/videos/demo.mp4",
        "subtitle_url": "./subtitles/demo.vtt",
    },
]

@app.on_event("startup")
async def startup_event():
    if engine.index is None:
        try:
            await engine.index_documents(DEFAULT_DOCUMENTS)
            print(f"Indexed {len(DEFAULT_DOCUMENTS)} default documents")
        except Exception as exc:
            print(f"Failed to index default documents: {exc}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "index_initialized": engine.index is not None}

@app.post("/index", status_code=status.HTTP_201_CREATED)
async def index_documents(docs: List[DocumentInput]):
    doc_dicts = [doc.model_dump() for doc in docs]
    count = await engine.index_documents(doc_dicts)
    return {"message": "Successfully indexed documents", "count": count}

@app.post("/search")
async def search_documents(payload: SearchQuery):
    top_k = payload.top_k or 3
    results = await engine.search(payload.query, top_k)
    return {"query": payload.query, "results": results}
