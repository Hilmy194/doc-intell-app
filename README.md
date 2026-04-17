# Document Intelligence App

Upload, parse, and extract structured data from documents using OCR and AI-powered extractors.

## Tech Stack

- **Frontend:** React + Vite + TailwindCSS (deployed on **Vercel**)
- **Backend:** Node.js + Express (deployed on **Render**)
- **Database & Storage:** Supabase (PostgreSQL + Storage)
- **Auth:** Supabase Auth (email/password registration & login)
- **Extractors:** Kreuzberg (OCR), Docling (document parsing)
- **Architecture:** Monorepo (npm workspaces)

## Prerequisites

- Node.js >= 18
- Python >= 3.9 (for extractors)

## Local Development

```bash
# 1. Install all dependencies
npm install

# 2. Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Fill in your Supabase credentials in apps/api/.env

# 4. Start both frontend & backend
npm run dev
```

### Start individually

```bash
npm run dev:api   # Backend on port 4000
npm run dev:web   # Frontend on port 5173
```

## Deployment

### Frontend → Vercel

1. Import repo on Vercel, set **Root Directory** to `apps/web`
2. Set environment variable: `VITE_API_URL` = your Render API URL
3. Deploy

### Backend → Render

1. Create a **Web Service** on Render, set **Root Directory** to `apps/api`
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `node src/server.js`
4. Or use **Docker** (Dockerfile included in apps/api)
5. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_BUCKET` = documents
   - `JWT_SECRET` = (random secret)
   - `WEB_URL` = your Vercel frontend URL
   - `PORT` = 3000
   - `PYTHON_PATH` = python3

### Supabase Setup

1. Create a Supabase project
2. Go to **Authentication** → **Sign In / Providers** → **Email** → disable **Confirm email**
3. Create a `files` table with columns: `id`, `name`, `stored_name`, `mime`, `size`, `url`, `status`, `extract_status`, `uploaded_at`
4. Create a Storage bucket named `documents`

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/register` | No | Register |
| POST | `/api/upload` | Yes | Upload files |
| GET | `/api/files` | No | List files |
| DELETE | `/api/files/:storedName` | Yes | Delete file |
| POST | `/api/extract` | Yes | Extract content |
| GET | `/api/extract/tools` | No | List extractors |
| GET | `/api/health` | No | Health check |

### New Intelligence Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/classify/run` | Yes | Classify a file (`storedName`) |
| POST | `/api/knowledge/index` | Yes | Index case chunks into knowledge table |
| POST | `/api/knowledge/search` | Yes | Semantic + keyword retrieval by claim/query |
| GET | `/api/knowledge/evidence/:chunkId` | Yes | Inspect indexed evidence chunk |
| POST | `/api/fact-check/claim` | Yes | Grounded fact-check with verdict + citations |

## Recommended Processing Flow

1. Create case
2. Upload files to case
3. Extract preview (optional)
4. Save chunks (`/api/chunks/save`)
5. Classify files (`/api/classify/run`)
6. Extract entities (`/api/entities/extract`)
7. Build graph (`/api/graph/build`)
8. Index knowledge (`/api/knowledge/index`)
9. Fact-check claims (`/api/fact-check/claim`)

## Database Migrations (Order)

Run in Supabase SQL Editor in this order:

1. `supabase_migration_knowledge_graph.sql`
2. `supabase_migration_prod_document_intel.sql`

The second migration adds:
- `document_classifications`
- `extraction_schemas`
- `extraction_runs`
- `knowledge_chunks` (with vector column)
- `fact_check_runs`

## Project Structure

```
doc-intel-app/
├── package.json
├── docker-compose.yml
├── apps/
│   ├── web/                    # Frontend (Vercel)
│   │   ├── vercel.json
│   │   ├── src/
│   │   │   ├── main.jsx
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.jsx
│   │   │   │   ├── RegisterPage.jsx
│   │   │   │   └── UploadPage.jsx
│   │   │   ├── components/
│   │   │   │   ├── auth/ProtectedRoute.jsx
│   │   │   │   └── upload/
│   │   │   │       ├── Dropzone.jsx
│   │   │   │       ├── ExtractionViewer.jsx
│   │   │   │       └── validators.js
│   │   │   ├── context/AuthContext.jsx
│   │   │   └── lib/apiClient.js
│   │   └── ...
│   └── api/                    # Backend (Render)
│       ├── Dockerfile
│       ├── src/
│       │   ├── server.js
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── middlewares/
│       │   ├── services/
│       │   │   ├── supabase.js
│       │   │   ├── db.service.js
│       │   │   ├── storage.service.js
│       │   │   └── extractors/
│       │   │       ├── index.js
│       │   │       ├── kreuzberg.extractor.js
│       │   │       └── docling.extractor.js
│       │   └── config/allowedFiles.js
│       └── scripts/
│           ├── kreuzberg_extract.py
│           └── docling_extract.py
```

## License

Private — Internal use only.
