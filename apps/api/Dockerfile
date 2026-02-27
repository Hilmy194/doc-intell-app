# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS base

# Install Python 3, pip, and Tesseract OCR (needed by kreuzberg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Install kreuzberg globally (no venv needed in container)
RUN pip3 install kreuzberg --break-system-packages

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
