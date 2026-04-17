# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS base

# Install Python, OCR runtime, and native build toolchain.
# Kreuzberg may compile Rust/C extensions during pip install.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    python3-venv \
    build-essential \
    gcc \
    g++ \
    make \
    pkg-config \
    rustc \
    cargo \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/requirements.txt /tmp/requirements.txt
RUN pip3 install -r /tmp/requirements.txt --break-system-packages

WORKDIR /app

# Install Node dependencies first (layer caching)
COPY package.json ./
RUN npm install --production

# Copy application source
COPY src/ ./src/
COPY scripts/ ./scripts/

# ── Runtime ──────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PYTHON_PATH=python3
EXPOSE 3000

CMD ["node", "src/server.js"]
