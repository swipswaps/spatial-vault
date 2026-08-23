import pytest
from fastapi.testclient import TestClient
from backend.main import app, engine

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_uninitialized_search_returns_400():
    engine.index = None
    engine.documents = []
    response = client.post("/search", json={"query": "test", "top_k": 2})
    assert response.status_code == 400
    assert "detail" in response.json()

def test_index_and_search_roundtrip():
    engine.index = None
    engine.documents = []

    docs = [
        {"id": "doc1", "text": "FastAPI async endpoints with Pydantic validation."},
        {"id": "doc2", "text": "Sentence Transformers vector embedding pipelines."},
    ]
    idx_res = client.post("/index", json=docs)
    assert idx_res.status_code == 201
    assert idx_res.json()["count"] == 2

    search_res = client.post("/search", json={"query": "embedding pipeline", "top_k": 1})
    assert search_res.status_code == 200
    data = search_res.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["id"] == "doc2"
    assert "score" in data["results"][0]
