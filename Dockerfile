FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/root/.cache/huggingface
ENV PATH="/root/.local/bin:$PATH"
ENV HF_HUB_DISABLE_TELEMETRY=1
ENV TOKENIZERS_PARALLELISM=false

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user --no-warn-script-location -r requirements.txt

RUN python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

FROM python:3.11-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/root/.cache/huggingface
ENV PATH="/root/.local/bin:$PATH"
ENV HF_HUB_DISABLE_TELEMETRY=1
ENV TOKENIZERS_PARALLELISM=false

RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /root/.local /root/.local
COPY --from=builder /root/.cache/huggingface /root/.cache/huggingface
ENV PATH="/root/.local/bin:$PATH"

COPY backend/ ./backend/
COPY tests/ ./tests/
COPY pytest.ini .

EXPOSE 8000

HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
