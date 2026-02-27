# Document Intelligence App — Current Architecture Guide (2026-02-24)

Dokumen ini menjelaskan kondisi **project saat ini**, supaya LLM bisa langsung
memahami struktur, flow, dan kontrak API tanpa perlu membaca seluruh source
code terlebih dahulu.

---

## 1. High-level Overview

Tujuan aplikasi ini:

- Upload berbagai dokumen (PDF, Office, image, text, CSV, JSON).
- Menyimpan file di backend (local disk).
- Melakukan **extraction / parsing** konten dokumen menjadi:
  - Markdown terstruktur.
  - JSON + `chunks` untuk kebutuhan ETL / RAG.
- Menyediakan UI dua panel: kiri **preview dokumen**, kanan **Parse / Split / Extract**.

Arsitektur:

- Monorepo npm workspaces: `apps/web` (frontend) dan `apps/api` (backend).
- Frontend: React + Vite + Tailwind, single page utama `UploadPage`.
- Backend: Node.js + Express + Multer + service extractor (local & Kreuzberg).

---

## 2. Monorepo & Folder Structure

Root: `doc-intel-app/`

- `project_guide.md` → dokumen yang sedang Anda baca.
- `package.json` → mendefinisikan workspaces dan script root.
- `apps/`
  - `web/` → frontend React (Vite + Tailwind)
    - `src/main.jsx` → entry React, langsung render `UploadPage`.
    - `src/pages/UploadPage.jsx` → halaman utama upload + tabel file + open ExtractionViewer.
    - `src/components/upload/Dropzone.jsx` → komponen drag & drop / pilih file.
    - `src/components/upload/ExtractionViewer.jsx` → modal dua panel untuk preview & extraction.
    - `src/components/upload/validators.js` → validasi extension & size di sisi frontend.
    - `src/lib/apiClient.js` → wrapper HTTP: upload, extract, delete, list tools.
  - `api/` → backend Node/Express
    - `uploads/` → folder fisik file yang di-upload (di-serve via static route).
    - `src/server.js` → bootstrap Express, daftarkan routes + static.
    - `src/routes/upload.routes.js` → route upload file.
    - `src/routes/extract.routes.js` → route ekstraksi dokumen.
    - `src/routes/files.routes.js` → route manajemen file (delete).
    - `src/controllers/upload.controller.js` → logic upload + response JSON.
    - `src/controllers/extract.controller.js` → logic memilih extractor & handle error.
    - `src/controllers/files.controller.js` → delete file dari disk.
    - `src/middlewares/multer.js` → konfigurasi Multer.
    - `src/config/allowedFiles.js` → daftar extension, mimetype, dan size limit backend.
    - `src/services/extractors/`
      - `index.js` → registry extractor (`local`, `kreuzberg`, dsb.).
      - `local.extractor.js` → extractor lokal (pdf-parse, text, csv, json, image placeholder, office placeholder).
      - `kreuzberg.extractor.js` → extractor yang memanggil Python library **Kreuzberg** via subprocess.
    - `scripts/kreuzberg_extract.py` → script Python yang dipanggil dari `kreuzberg.extractor.js`.

---

## 3. Tech Stack (Aktual)

### Frontend

- React 18 (JavaScript, tanpa TypeScript).
- Vite.
- TailwindCSS.
- `XMLHttpRequest` untuk upload progress (bukan `fetch`).

### Backend

- Node.js + Express.
- Multer (multipart/form-data) untuk upload file.
- `pdf-parse` untuk ekstraksi teks PDF (di extractor lokal).
- Python 3.12 + library `kreuzberg` untuk advanced extraction multi-format.

### Penyimpanan

- Local disk di folder: `apps/api/uploads/`.
- File di-rename ke format `{timestamp}-{random}.{ext}`.
- File di-serve lewat `express.static('/uploads')` di backend.

---

## 4. Frontend — Upload Flow & UI

### 4.1 Halaman Utama: `UploadPage.jsx`

Lokasi: `apps/web/src/pages/UploadPage.jsx`

Fungsi utama:

- Header general "Document Intelligence" (tidak hard-coded case ID).
- Komponen `Dropzone` untuk drag & drop / klik pilih file.
- Menampilkan progress bar selama upload.
- Menampilkan chip kecil **Accepted Formats** untuk semua jenis file yang didukung.
- Menampilkan tabel **Uploaded Files** dengan kolom:
  - File Name.
  - Type (extension badge).
  - Size.
  - Upload Date.
  - Status (`pending | processing | processed | failed` via `extractStatus`).
  - Actions: Download, Extract (buka modal), Delete.

State penting:

- `uploadedFiles` → array objek file yang dikembalikan backend + `extractStatus`.
- `isUploading`, `uploadProgress` → kontrol UX upload.
- `errorMsg` → error banner global.
- `extractTarget` → file yang sedang dibuka di `ExtractionViewer`.

### 4.2 Komponen Dropzone

Lokasi: `apps/web/src/components/upload/Dropzone.jsx`

- Props: `onFiles(files[])`, `disabled`.
- Mendukung:
  - Drag over / drag leave / drop.
  - Klik tombol "Select Files" untuk membuka file picker.
- Saat file diterima, memanggil callback `onFiles(Array<File>)`.

### 4.3 Validasi Frontend

Lokasi: `apps/web/src/components/upload/validators.js`

- `ALLOWED_EXTENSIONS`:
  - `pdf, png, jpg, jpeg, docx, xls, xlsx, pptx, txt, csv, json`.
- `MAX_FILE_SIZE = 50 MB`.
- Fungsi:
  - `validateFile(file)` → `{ valid, error? }`.
  - `validateFiles(files)` → array dari `{ file, valid, error? }`.

### 4.4 HTTP Client

Lokasi: `apps/web/src/lib/apiClient.js`

Export utama:

- `uploadFiles(files, onProgress)`
  - Menggunakan `XMLHttpRequest` POST ke `http://localhost:4000/api/upload`.
  - Mengirim field `files` (multiple) via `FormData`.
  - Meng-update `onProgress(0-100)` dari event `xhr.upload.progress`.
  - Response: `{ files: [ { id, name, storedName, mime, size, url, uploadedAt, status, extractStatus } ] }`.

- `extractFile(storedName, mime, tool = 'kreuzberg', options = {})`
  - `POST /api/extract` dengan body JSON `{ storedName, mime, tool, options }`.
  - Response: `{ success, tool, filename, pages, wordCount, markdown, json, chunks }`.

- `deleteFile(storedName)`
  - `DELETE /api/files/:storedName`.

- `listExtractors()`
  - `GET /api/extract/tools` → `{ tools: ['local', 'kreuzberg', ...] }`.

### 4.5 Extraction Viewer (Modal Dua Panel)

Lokasi: `apps/web/src/components/upload/ExtractionViewer.jsx`

Struktur UI:

- **Panel kiri**: preview file
  - PDF → `<iframe src="/uploads/{storedName}">`.
  - Image → `<img>`.
  - Text/CSV/JSON → `<iframe>` dengan background gelap.
- **Panel kanan**: tabs
  - `Parse` → tampilkan hasil `markdown` atau `json` (switch atas: Markdown / JSON).
  - `Split` → tampilkan setiap `chunk` sebagai kartu (menggunakan `chunk.text`).
  - `Extract` → pilih tool (default `kreuzberg`), jalankan ekstraksi.

State penting:

- `activeTab` → `'Parse' | 'Split' | 'Extract'`.
- `outputFormat` → `'markdown' | 'json'`.
- `selectedTool` → `'kreuzberg'` (default) atau `'local'`.
- `result` → object hasil ekstraksi dari backend.

Alur di tab **Extract**:

1. User pilih tool (Kreuzberg / Local).
2. Klik "Run Extraction".
3. Frontend memanggil `extractFile(storedName, mime, selectedTool)`.
4. Saat sukses, `result` terisi dan `activeTab` otomatis pindah ke `Parse`.

---

## 5. Backend — Upload & Extraction

### 5.1 Upload API

Entry: `apps/api/src/routes/upload.routes.js` → controller `upload.controller.js`.

- Endpoint: `POST /api/upload`.
- Middleware: Multer dengan konfigurasi dari `middlewares/multer.js`.
- Validasi server-side:
  - Extension & mimetype sesuai `config/allowedFiles.js`.
  - Ukuran file <= `MAX_FILE_SIZE` (50 MB).
- Output per file:
  - `id` (UUID).
  - `name` (nama asli).
  - `storedName` (nama file di disk).
  - `mime`.
  - `size`.
  - `url` (`/uploads/{storedName}`).
  - `uploadedAt` (ISO string).
  - `status` ("uploaded").

### 5.2 Extract API

File kunci:

- `apps/api/src/controllers/extract.controller.js`
- `apps/api/src/services/extractors/index.js`

Endpoint:

- `POST /api/extract`
  - Body: `{ storedName, mime, tool?, options? }`.
  - `tool` default `'local'` jika tidak dikirim.
  - Controller akan:
    1. Resolve path file: `uploads/{storedName}`.
    2. Cek file exist.
    3. Ambil extractor via `getExtractor(tool)`.
    4. Panggil `extract(filePath, mime, options)`.
    5. Return `{ success: true, tool, ...result }`.

- `GET /api/extract/tools`
  - Response: `{ tools: ['local', 'kreuzberg'] }` (saat ini).

### 5.3 File Management API

File: `apps/api/src/controllers/files.controller.js`

- `DELETE /api/files/:storedName`
  - Hapus file dari folder `uploads`.

### 5.4 Extractor Registry

Lokasi: `apps/api/src/services/extractors/index.js`

```js
const localExtractor = require('./local.extractor');
const kreuzbergExtractor = require('./kreuzberg.extractor');

const EXTRACTORS = {
  local: localExtractor,
  kreuzberg: kreuzbergExtractor,
  // 'landing-ai': require('./landingai.extractor'),
  // 'unstructured': require('./unstructured.extractor'),
  // 'azure-di': require('./azuredi.extractor'),
};

function getExtractor(tool = 'local') {
  if (!EXTRACTORS[tool]) {
    throw new Error(`Unknown extraction tool: "${tool}".`);
  }
  return EXTRACTORS[tool];
}

function listTools() {
  return Object.keys(EXTRACTORS);
}
```

Tujuannya supaya penambahan tool baru (Landing AI, Unstructured, Azure DI, dll.)
tinggal menambah satu file extractor dan register di objek `EXTRACTORS`.

---

## 6. Extractor Lokal (`local.extractor.js`)

Lokasi: `apps/api/src/services/extractors/local.extractor.js`

Karakteristik:

- Tidak memakai external API (pure Node).
- Mendukung:
  - PDF → `pdf-parse`.
  - TXT → baca `.txt` sebagai string.
  - CSV → parsing baris & header, menghasilkan Markdown table.
  - JSON → parse ke object, render kembali sebagai code block.
  - Image → hanya placeholder (info ukuran, belum OCR).
  - Office (DOCX/XLSX/PPTX) → placeholder message yang minta integrasi tool lain.

Output umum:

- `tool: 'local'`.
- `filename`.
- `pages` (kalau tersedia).
- `wordCount`.
- `markdown` (teks yang sudah dirapikan).
- `json` (struktur yang siap ETL).
- `chunks: [{ index, text, tokenEstimate }]`.

---

## 7. Extractor Kreuzberg (`kreuzberg.extractor.js` + Python)

Lokasi Node: `apps/api/src/services/extractors/kreuzberg.extractor.js`  
Lokasi Python: `apps/api/scripts/kreuzberg_extract.py`

Alur:

1. Node memanggil `execFile(PYTHON_CMD, [SCRIPT_PATH, filePath], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })`.
2. Script Python menjalankan `kreuzberg.extract_file(file_path)` (async).
3. Hasil dikirim sebagai JSON ke stdout (`ensure_ascii=False`, stdout UTF-8).
4. Node parse JSON → bangun struktur `{ markdown, json, chunks }` mirip `local`.

Python script memastikan kompatibilitas Windows:

- `sys.stdout.reconfigure(encoding="utf-8")`.
- `PYTHONIOENCODING=utf-8`.

Output extractor `kreuzberg`:

- `tool: 'kreuzberg'`.
- `filename`.
- `pages` (estimasi berdasarkan panjang teks).
- `wordCount`.
- `markdown` yang dibangun dari baris teks.
- `json`: `{ source, text, lines, chunks, metadata }`.
- `chunks` seperti di atas.

Kreuzberg sendiri mendukung berbagai format (PDF, DOCX, PPTX, XLSX, images (OCR),
TXT, CSV, HTML, Markdown, dll.).

---

## 8. Allowed Files & Limits

Backend (`apps/api/src/config/allowedFiles.js`):

- `ALLOWED_EXTENSIONS`: sama dengan frontend (`pdf, png, jpg, jpeg, docx, xls, xlsx, pptx, txt, csv, json`).
- `ALLOWED_MIMETYPES`: kombinasi mimetype standar (PDF, image, Office, text, csv, json).
- `MAX_FILE_SIZE = 50 MB`.

Frontend validator diset agar **selalu konsisten** dengan konfigurasi backend.

---

## 9. How to Run (Dev)

1. **Backend**
   - Pastikan Python 3.12 dan `kreuzberg` sudah ter-install.
   - Dari root repo:
     - `cd apps/api`
     - `node src/server.js`
   - API akan berjalan di `http://localhost:4000`.

2. **Frontend**
   - `cd apps/web`
   - `npm run dev`
   - Akses `http://localhost:5173`.

3. **Tes cepat extraction (manual)**
   - Upload file via UI.
   - Buka modal **Extract** → tool **Kreuzberg** → `Run Extraction`.
   - Buka tab **Parse** / **Split** di panel kanan untuk melihat hasil.

---

## 10. Catatan untuk LLM

- Frontend & backend sudah berjalan dan **stateful**: jangan ubah API contract
  tanpa alasan kuat, supaya UI tetap sinkron.
- Bila ingin menambah tool baru (Landing AI, Unstructured, Azure DI):
  - Buat file extractor baru di `apps/api/src/services/extractors/` dengan
    signature `async extract(filePath, mime, options) → { markdown, json, chunks }`.
  - Register di `EXTRACTORS` pada `index.js`.
  - Optional: tambahkan ke `TOOLS` di `ExtractionViewer.jsx` untuk muncul di UI.
- UI sudah mengikuti layout gelap dua panel (preview kiri, tabs kanan) sehingga
  perubahan besar di layout sebaiknya dilakukan hati-hati.


