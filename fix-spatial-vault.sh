#!/usr/bin/env bash
set -euo pipefail

echo "Fixing Spatial Vault configuration..."

# ------------------------------------------------------------
# 1. Write improved docker-compose.yml
# ------------------------------------------------------------
cat > docker-compose.yml <<'EOF'
services:
  test-runner:
    build: .
    command: pytest tests/test_api.py -v
    profiles:
      - test
    volumes:
      - .:/app

  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
    restart: unless-stopped
    mem_limit: 2g
    cpus: 2
EOF

echo "Wrote docker-compose.yml"

# ------------------------------------------------------------
# 2. Write improved Dockerfile
# ------------------------------------------------------------
cat > Dockerfile <<'EOF'
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
EOF

echo "Wrote Dockerfile"

# ------------------------------------------------------------
# 3. Validate Compose file
# ------------------------------------------------------------
if docker compose version >/dev/null 2>&1; then
  docker compose config >/dev/null
  echo "docker-compose.yml is valid"
else
  echo "WARNING: docker compose not found, skipping validation"
fi

# ------------------------------------------------------------
# 4. Clean up any spatial-vault containers/networks/images
# ------------------------------------------------------------
if docker compose version >/dev/null 2>&1; then
  docker compose down --remove-orphans >/dev/null 2>&1 || true
fi

if docker image ls --format '{{.Repository}}' | grep -q 'spatial-vault'; then
  echo "Removing spatial-vault Docker images..."
  docker image ls --format '{{.ID}} {{.Repository}}' |
    awk '/spatial-vault/ {print $1}' |
    xargs -r docker image rm -f >/dev/null 2>&1 || true
else
  echo "No spatial-vault images found"
fi

# Remove dangling images safely
docker image prune -f >/dev/null 2>&1 || true

echo ""
echo "Spatial Vault fixed."
echo ""
echo "Now start the backend without test-runner and in detached mode:"
echo "  docker compose up -d backend"
echo ""
echo "View logs only when needed:"
echo "  docker compose logs -f backend"
echo ""
echo "Stop everything with:"
echo "  docker compose down"
