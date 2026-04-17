# Document Intelligence App — Penjelasan Codebase

Dokumen ini menjelaskan arsitektur, alur bisnis, dan logika utama di monorepo **doc-intel-app** (frontend React + backend Express + Supabase + extractor Python).

## 1) Gambaran Umum
Aplikasi ini dipakai untuk:
1. Membuat **Case** (wadah/collection dokumen).
2. Upload dokumen ke **Supabase Storage** dan simpan metadata ke **Supabase Postgres**.
3. Menjalankan **extraction** (OCR/parsing) via extractor Python (Kreuzberg/Docling).
4. Membuat **chunks** (potongan teks) dan menyimpannya ke DB.
5. Mengekstrak **entities** + **relations** (OpenAI bila tersedia, atau heuristic regex fallback).
6. Menampilkan **Knowledge Graph** (nodes+links) dan mengaplikasikan **ontology rules** per-case.

Monorepo memakai npm workspaces:
- `apps/api` = backend Express (Render/Docker)
- `apps/web` = frontend React (Vercel/Docker)

Lihat ringkasannya juga di `README.md`.

## 2) Struktur Folder
- `docker-compose.yml` — menjalankan web+api lokal via Docker.
- `apps/api/src/server.js` — entrypoint API server.
- `apps/api/src/routes/*` — definisi endpoint.
- `apps/api/src/controllers/*` — handler HTTP.
- `apps/api/src/services/*` — integrasi DB/Storage, chunking, entity extraction.
- `apps/api/scripts/*.py` — extractor Python yang dipanggil dari Node.
- `apps/web/src/main.jsx` — router utama.
- `apps/web/src/pages/*` — halaman (Cases, Case Detail, Knowledge Graph, Auth).
- `apps/web/src/lib/apiClient.js` — semua komunikasi ke backend.

## 3) Arsitektur (High Level)

```mermaid
flowchart LR
  UI[React Web (Vite)] -->|HTTP /api/*| API[Express API]
  API -->|Auth| SUPA_AUTH[Supabase Auth]
  API -->|DB tables| SUPA_DB[Supabase Postgres]
  API -->|Upload/Download| SUPA_STORAGE[Supabase Storage]
  API -->|execFile python| PY[Python Extractors]
  PY -->|JSON stdout| API
  UI -->|Render graph| FG[react-force-graph-2d]
```

Catatan penting:
- Backend **login/register** memanggil Supabase Auth, lalu backend menerbitkan **JWT sendiri** untuk mengamankan endpoint tertentu.
- Penyimpanan file dilakukan ke **Supabase Storage**; teks/graph disimpan ke **Supabase Postgres**.

## 4) Backend (apps/api)

### 4.1 Entry & Routing
File: `apps/api/src/server.js`
- Mendaftarkan routes berikut:
  - `/api/auth` → auth (login/register)
  - `/api/cases` → case management + ontology rules
  - `/api/upload` → upload dokumen (wajib auth)
  - `/api/extract` → extraction via python (wajib auth)
  - `/api/files` → list semua file, delete file
  - `/api/chunks` → simpan/list/hapus chunks (wajib auth)
  - `/api/entities` → ekstraksi entities+relations (wajib auth)
  - `/api/graph` → build & get graph (wajib auth)
  - `/api/health` → health check

### 4.2 Auth
Files:
- `apps/api/src/controllers/auth.controller.js`
- `apps/api/src/middlewares/auth.middleware.js`

Alur:
- `POST /api/auth/login`:
  1) `supabase.auth.signInWithPassword`.
  2) Backend membuat JWT (`jsonwebtoken`) berisi `{ id, email }` dengan expiry 24 jam.
- `POST /api/auth/register`:
  1) `supabase.auth.signUp`.
  2) Jika sukses, backend juga **auto-issue JWT**.
- `auth.middleware`:
  - Membaca header `Authorization: Bearer <token>`.
  - `jwt.verify` terhadap `JWT_SECRET`.
  - Menyimpan hasil decode ke `req.user`.

Catatan: token yang dipakai frontend adalah JWT milik backend (bukan access token Supabase).

### 4.3 Cases + Ontology Rules
Files:
- `apps/api/src/routes/cases.routes.js`
- `apps/api/src/controllers/cases.controller.js`
- `apps/api/src/services/cases.db.service.js`

Endpoint utama:
- `GET /api/cases` — list case.
- `POST /api/cases` (auth) — buat case.
- `GET /api/cases/:caseId` — detail.
- `PATCH /api/cases/:caseId` (auth) — update.
- `DELETE /api/cases/:caseId` (auth) — hapus case dan **cascade** hapus semua file-nya (record DB + storage path).
- `GET /api/cases/:caseId/files` — list file dalam case.
- `GET /api/cases/:caseId/ontology` — ambil ontology rules.
- `PUT /api/cases/:caseId/ontology` (auth) — simpan ontology rules.

Ontology rules disimpan per case (kolom `ontology_rules`) dan bentuknya array:
```json
[{"from":"PERSON","relation":"works_at","to":"ORGANIZATION"}]
```
Rules ini dipakai dalam 2 tempat:
1) Saat ekstraksi entities+relations (mengarahkan relationType yang boleh dibuat).
2) Saat `graph/build` (co-occurrence pass menambah link sesuai rule tanpa re-run AI).

### 4.4 Upload Files
Files:
- `apps/api/src/routes/upload.routes.js`
- `apps/api/src/controllers/upload.controller.js`
- `apps/api/src/middlewares/multer.js`
- `apps/api/src/config/allowedFiles.js`
- `apps/api/src/services/storage.service.js`
- `apps/api/src/services/db.service.js`

Aturan upload:
- `multer` pakai `memoryStorage()`.
- Validasi extension + mimetype ada di `allowedFiles.js`.
- Limit size: `MAX_FILE_SIZE = 50MB`.
- `POST /api/upload` **wajib auth** dan menerima `multipart/form-data`:
  - field file: `files` (maks 20)
  - field text: `caseId` (**wajib**)

Alur upload:
1) Backend membuat `storedName` unik.
2) Upload buffer ke Supabase Storage.
   - Path diset di controller: `cases/<caseId>/<storedName>`.
3) Simpan record ke table `files` via `db.service.js`.

### 4.5 Files Listing & Delete
Files:
- `apps/api/src/routes/files.routes.js`
- `apps/api/src/controllers/files.controller.js`

- `GET /api/files` — list semua file (tidak pakai auth).
- `DELETE /api/files/:storedName` (auth) — delete file:
  1) Ambil record untuk membaca `caseId`.
  2) Hapus dari Storage (path tergantung caseId).
  3) Hapus record dari DB.

### 4.6 Extraction (Kreuzberg / Docling)
Files:
- `apps/api/src/routes/extract.routes.js`
- `apps/api/src/controllers/extract.controller.js`
- `apps/api/src/services/extractors/*`
- `apps/api/scripts/kreuzberg_extract.py`
- `apps/api/scripts/docling_extract.py`

Endpoint:
- `POST /api/extract` (auth)
  - body: `{ storedName, mime, tool, options }`
  - `tool` default: `kreuzberg`
- `GET /api/extract/tools` — list tool yang tersedia.

Alur extraction:
1) Cari file record via `getFileRecord(storedName)`.
2) Download file dari Supabase Storage ke temp folder (`os.tmpdir()/doc-intel`).
3) Panggil extractor Node wrapper:
   - `kreuzberg.extractor.js` → `python scripts/kreuzberg_extract.py ...`
   - `docling.extractor.js` → `python scripts/docling_extract.py ...`
4) Output python adalah JSON di stdout.
5) Backend membangun:
   - `markdown`
   - `json` (raw text, lines, tables, metadata)
   - `chunks` (estimasi token, + chunk untuk tables)
6) Update `extract_status` file menjadi `done`.

Catatan: extractor ini berbeda dengan pipeline “chunks/entities/graph”. Extraction endpoint dipakai terutama untuk melihat hasil parse per-file (via modal di UI).

### 4.7 Chunking (Persist ke DB)
Files:
- `apps/api/src/routes/chunks.routes.js`
- `apps/api/src/controllers/chunks.controller.js`
- `apps/api/src/services/chunks.db.service.js`

Endpoint:
- `POST /api/chunks/save` (auth): `{ storedName, force }`
  - Jika chunks sudah ada dan `force=false`, server mengembalikan cached.
- `GET /api/chunks/:storedName` (auth)
- `DELETE /api/chunks/:storedName` (auth)

Logika chunking:
- CSV: split per baris (header + 1 row per chunk).
- JSON: split per item (array) atau per key.
- Lainnya (PDF/DOCX/image, dst): jalankan extractor `kreuzberg` → ambil full text → split.
- Ada “record-aware split” khusus format seperti watchlist DTTOT:
  - Mendeteksi pola `"1. Nama :"` dan header bagian `"I. ENTITAS" / "II. INDIVIDU"`.

Insert chunks dilakukan batch (100 rows per insert) agar tidak kena limit request body.

### 4.8 Entity + Relation Extraction
Files:
- `apps/api/src/routes/entities.routes.js`
- `apps/api/src/controllers/entities.controller.js`
- `apps/api/src/services/entity.service.js`
- `apps/api/src/services/entities.db.service.js`

Endpoint:
- `POST /api/entities/extract` (auth): `{ caseId }`
- `GET /api/entities/:caseId` (auth)

Mode extractor:
- Jika `OPENAI_API_KEY` tersedia → default `openai`.
- Jika tidak → `heuristic` (regex patterns).
- Bisa dipaksa dengan env `ENTITY_EXTRACTOR` (`openai|heuristic|hybrid`).

Alur utama (`entities.controller`):
1) Hapus entities & relations lama untuk case tersebut.
2) Ambil semua chunks untuk case.
3) Ambil ontology rules dari case.
4) Untuk setiap chunk:
   - Panggil `extractFullFromText(text, ontologyRules)`.
   - Simpan entities ke table `extracted_entities`.
   - Relations:
     - `heuristic`: buat relations via co-occurrence rules (`buildRelationsFromChunkEntities`).
     - `openai/hybrid`: kumpulkan “named relations” dari LLM, lalu resolve ke entity IDs (`resolveNamedRelations`) dan simpan.
   - Fallback:
     - Jika resolve-rate rendah (<30%) atau LLM return 0 relations → tambahkan co-occurrence relations.

Poin penting:
- Prompt LLM mewajibkan relation `source`/`target` **harus match persis** dengan `entityValue` (untuk mempermudah resolve).
- Jika ontology rules ada, LLM diminta **hanya** memakai relation type dari ontology.

### 4.9 Graph API (untuk Visualisasi)
Files:
- `apps/api/src/routes/graph.routes.js`
- `apps/api/src/controllers/graph.controller.js`

Endpoint:
- `GET /api/graph/:caseId` (auth): return `{ nodes, links, stats }`.
  - Nodes didedupe berdasarkan `type + entityValue` (case-insensitive).
  - Links didedupe berdasarkan `(src, relationType, tgt)`.
- `POST /api/graph/build` (auth): `{ caseId }`
  - Jika ontology rules berubah setelah extraction, endpoint ini menambah relations via co-occurrence pass tanpa re-run AI.

### 4.10 Neo4j
File: `apps/api/src/services/neo4j.service.js`
- Di repo ini **Neo4j sudah dihapus**; service ini stub agar import lama tidak crash.
- Graph sekarang sepenuhnya hidup di Postgres (Supabase).

## 5) Python Extractors

### 5.1 Kreuzberg
File: `apps/api/scripts/kreuzberg_extract.py`
- Memakai library `kreuzberg`.
- OCR via tesseract (force OCR untuk file image).
- Output JSON: `text`, `tables` (markdown + cells), `metadata`.

### 5.2 Docling
File: `apps/api/scripts/docling_extract.py`
- Memakai `docling.document_converter.DocumentConverter`.
- Output JSON: `text`, `markdown`, `tables`, `pages`, `wordCount`, `metadata`.

Node wrappers (`apps/api/src/services/extractors/*.extractor.js`) memanggil python via `execFile` dengan timeout 120 detik.

## 6) Frontend (apps/web)

### 6.1 Routing & Auth
Files:
- `apps/web/src/main.jsx`
- `apps/web/src/context/AuthContext.jsx`
- `apps/web/src/components/auth/ProtectedRoute.jsx`

Routing:
- `/login`, `/register` (public)
- `/` → `CasesPage` (protected)
- `/cases/:caseId` → `CaseDetailPage` (protected)
- `/cases/:caseId/knowledge-graph` → `KnowledgeGraphPage` (protected)

`AuthContext` menyimpan token & user ke `localStorage` dan melakukan check expiry (decode JWT payload base64) saat mount.

### 6.2 API Client
File: `apps/web/src/lib/apiClient.js`
- Semua call ke backend lewat sini.
- Base URL: `import.meta.env.VITE_API_URL` (default `http://localhost:4000`).
- Ada helper `parseApiResponse` yang mendeteksi jika API mengembalikan HTML (biasanya karena `VITE_API_URL` salah atau backend crash/cold start).
- Upload memakai `XMLHttpRequest` agar bisa progress bar.

### 6.3 Cases Page
File: `apps/web/src/pages/CasesPage.jsx`
- List cases.
- Create case (modal).
- Delete case (confirm).

### 6.4 Case Detail Page (Upload per Case)
File: `apps/web/src/pages/CaseDetailPage.jsx`
- Menampilkan file yang scope ke case.
- Upload file memakai `uploadFiles(files, onProgress, caseId)`.
- Tombol “Extract” membuka modal `ExtractionViewer` untuk menjalankan `/api/extract` dan melihat output markdown/json.

Catatan penting: backend `POST /api/upload` **mewajibkan `caseId`**. Jadi upload harus dilakukan dari halaman ini (atau pastikan `caseId` ikut terkirim).

### 6.5 Knowledge Graph Page (Pipeline + Ontology)
File: `apps/web/src/pages/KnowledgeGraphPage.jsx`
Fitur utama:
- **Ontology editor** per-case (tambah/hapus rule; preset templates seperti DTTOT/Contract/Financial).
- Pipeline 3 langkah:
  1) Save Chunks → memanggil `/api/chunks/save` untuk setiap file di case.
  2) Extract Entities → memanggil `/api/entities/extract`.
  3) Apply Rules → memanggil `/api/graph/build` (menambah links berbasis ontology).
- Graph rendering pakai `react-force-graph-2d` (lazy loaded).
- Filter nodes berdasarkan tipe entity.

### 6.6 Upload UI Components
Files:
- `apps/web/src/components/upload/Dropzone.jsx` — drag&drop + file picker.
- `apps/web/src/components/upload/ExtractionViewer.jsx` — modal preview file + tab Extract/Parse/Split.
- `apps/web/src/components/upload/validators.js` — validasi extension & max size (50MB).

## 7) Data Model (Supabase)

Aplikasi mengandalkan table berikut (nama sesuai service code):
- `cases`
  - `id`, `name`, `description`, `user_id`, `ontology_rules`, `created_at`
- `files`
  - `id`, `name`, `stored_name`, `mime`, `size`, `url`, `status`, `extract_status`, `case_id`, `uploaded_at`
- `file_chunks`
  - `file_id`, `case_id`, `chunk_index`, `content`, `token_estimate`, `metadata`
- `extracted_entities`
  - `file_id`, `case_id`, `chunk_id`, `entity_type`, `entity_value`, `confidence`, `source`
- `entity_relations`
  - `case_id`, `source_entity`, `target_entity`, `relation_type`, `confidence`

Ada file migration contoh: `supabase_migration_knowledge_graph.sql`.

Catatan: migration tersebut memakai `UUID` untuk `id`/FK. Di code sekarang, `caseId` dan `file.id` terlihat seperti string prefix (`case_...`, `f_...`). Pastikan schema Supabase di project kamu konsisten dengan implementasi service (`cases.db.service.js`, `db.service.js`).

## 8) Environment Variables

### Backend (apps/api/.env)
Minimal:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (disarankan) atau `SUPABASE_ANON_KEY`
- `SUPABASE_BUCKET` (default `documents`)
- `JWT_SECRET`
- `WEB_URL` (origin frontend untuk CORS)
- `PORT` (default 3000 di container; compose map ke 4000)
- `PYTHON_PATH` (default `python`, di docker-compose: `python3`)

Opsional untuk entity extraction via LLM:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `ENTITY_EXTRACTOR` (`openai|heuristic|hybrid`)

### Frontend (apps/web/.env)
- `VITE_API_URL` (contoh: `http://localhost:4000`)

## 9) Cara Menjalankan Lokal (ringkas)
1) Install dependencies monorepo:
   - `npm install`
2) Isi env:
   - copy `apps/api/.env.example` → `apps/api/.env`
   - copy `apps/web/.env.example` → `apps/web/.env`
3) Install python deps (di environment yang dipakai backend):
   - `pip install kreuzberg docling`
   - Pastikan Tesseract tersedia jika ingin OCR dari Kreuzberg.
4) Start:
   - `npm run dev`

## 10) Alur Kerja yang Direkomendasikan (End-to-End)
1) Login/register.
2) Buat case.
3) Upload dokumen ke case.
4) (Opsional) Cek hasil parse per-file via tombol Extract (modal ExtractionViewer).
5) Buka Knowledge Graph:
   - definisikan ontology rules (atau pakai template) → Save.
   - Run Full Pipeline (chunks → entities → apply rules).
6) Graph akan tampil dan bisa di-filter berdasarkan tipe entity.

## 11) Catatan / Gotchas
- Backend upload sekarang memaksa `caseId` (lihat `upload.controller.js`). Halaman `UploadPage.jsx` (yang upload tanpa caseId) kemungkinan adalah legacy dan tidak dipakai oleh router utama.
- `storage.service.js` mengharuskan `caseId` untuk download/delete path `cases/<caseId>/...`.
- `cors` di `server.js` saat ini permissive (origin tetap di-allow). Jika mau lebih ketat, logikanya bisa diperbaiki.

---
Jika kamu mau, saya bisa lanjutkan dengan: (a) bikin diagram sequence per pipeline, atau (b) validasi schema Supabase vs service code (biar tidak mismatch UUID vs string id).
