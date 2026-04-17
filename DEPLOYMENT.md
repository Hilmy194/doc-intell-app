# Deployment Guide

This project is a monorepo:
- apps/api: Express API + Python extractors
- apps/web: React/Vite frontend

## 1. Prerequisites
- Node.js 18+
- Python 3.9+
- Supabase project (Postgres + Storage)
- Storage bucket named documents

## 2. Database Setup
Run these SQL files in Supabase SQL editor:
1. supabase_migration_knowledge_graph.sql
2. supabase_migration_prod_document_intel.sql

## 3. Backend Environment
Set these environment variables in your backend deployment target:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_BUCKET=documents
- JWT_SECRET
- WEB_URL (frontend URL)
- PORT=3000
- PYTHON_PATH=python3

Optional AI:
- OPENAI_API_KEY
- OPENAI_MODEL=gpt-4o-mini
- OPENAI_EMBEDDING_MODEL=text-embedding-3-small
- FACTCHECK_MODEL=gpt-4o-mini

## 4. Frontend Environment
Set:
- VITE_API_URL=https://<your-api-domain>

## 5. Backend Deploy (Docker)
Use apps/api/Dockerfile.
It installs:
- Python + pip
- Tesseract OCR
- python dependencies from apps/api/scripts/requirements.txt

Health check endpoint:
- GET /api/health

## 6. Frontend Deploy
Option A: Vercel
- Root directory: apps/web
- Build command: npm run build
- Output directory: dist

Option B: Docker (apps/web/Dockerfile)
- Build arg: VITE_API_URL

## 7. Post-Deploy Smoke Tests
1. GET /api/health => status ok
2. Register/login
3. Create case
4. Upload file with caseId
5. Save chunks
6. Classify file
7. Index knowledge
8. Fact-check claim

## 8. Notes
- Fact-checking is grounded on retrieved knowledge chunks only.
- If OPENAI_API_KEY is not set, classifier/embedding/fact-check use local fallback logic.
