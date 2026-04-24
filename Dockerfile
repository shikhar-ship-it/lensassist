# syntax=docker/dockerfile:1.6

# ─────────────────────────────────────────────────────────────────────────
# Stage 1 — build the React frontend
# ─────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────
# Stage 2 — Python runtime
# ─────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# System deps (ca-certs for AWS calls)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps (cached layer — changes rarely)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY agent ./agent
COPY backend ./backend
COPY data ./data
COPY scripts ./scripts

# Built React assets from stage 1
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Non-root user
RUN useradd --create-home --shell /bin/bash lensassist \
    && chown -R lensassist:lensassist /app
USER lensassist

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

CMD ["sh", "-c", "uvicorn backend.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
