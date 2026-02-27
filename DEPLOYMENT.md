# Deployment Guide — Document Intelligence App

Arsitektur deployment: **Vercel** (frontend) + **Render** (backend API + Docker) + **Supabase** (database + file storage).

Semua layanan di atas memiliki **free tier**.

```
┌──────────────┐     ┌───────────────────────┐     ┌──────────────────┐
│   Vercel     │────▶│   Render (Docker)      │────▶│   Supabase       │
│   React App  │     │   Node.js + Python     │     │   PostgreSQL     │
│              │     │   + Tesseract OCR      │     │   + Storage      │
└──────────────┘     └───────────────────────┘     └──────────────────┘
```

---

## Daftar Isi

1. [Setup Supabase (Database + Storage)](#1-setup-supabase)
2. [Setup Lokal untuk Development](#2-setup-lokal)
3. [Push ke GitHub](#3-push-ke-github)
4. [Deploy API ke Render](#4-deploy-api-ke-render)
5. [Deploy Web ke Vercel](#5-deploy-web-ke-vercel)
6. [Verifikasi](#6-verifikasi)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Setup Supabase

### 1.1 Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) → **Sign Up** (gratis)
2. Klik **New Project**
3. Isi:
   - **Name**: `doc-intel`
   - **Database Password**: catat password-nya
   - **Region**: pilih yang terdekat (misal: Singapore)
4. Tunggu project selesai dibuat (~2 menit)

### 1.2 Ambil API Keys

1. Di dashboard Supabase, buka **Settings** → **API**
2. Catat dua nilai ini:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public key**: `eyJhbGciOi...`

### 1.3 Buat Tabel `files`

1. Buka **SQL Editor** di sidebar kiri Supabase
2. Klik **New Query**
3. Paste dan jalankan SQL berikut:

```sql
-- Tabel untuk menyimpan metadata file
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime TEXT,
  size INTEGER,
  url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'uploaded',
  extract_status TEXT DEFAULT 'pending'
);

-- Index untuk query yang sering dipakai
CREATE INDEX idx_files_stored_name ON files (stored_name);
CREATE INDEX idx_files_uploaded_at ON files (uploaded_at DESC);
```

4. Klik **Run** (tombol hijau)

### 1.4 Buat Storage Bucket

1. Buka **Storage** di sidebar kiri
2. Klik **New Bucket**
3. Isi:
   - **Name**: `documents`
   - **Public bucket**: ✅ **aktifkan** (centang)
4. Klik **Create Bucket**

### 1.5 Set Storage Policy (Izin Akses)

1. Klik bucket `documents` → **Policies**
2. Klik **New Policy** → **For full customization**
3. Buat policy berikut:

**Policy 1 — Allow Upload:**
- **Name**: `Allow upload`
- **Allowed operation**: `INSERT`
- **Target roles**: `anon`
- **Policy**: `true`

**Policy 2 — Allow Read:**
- **Name**: `Allow read`
- **Allowed operation**: `SELECT`
- **Target roles**: `anon`
- **Policy**: `true`

**Policy 3 — Allow Delete:**
- **Name**: `Allow delete`
- **Allowed operation**: `DELETE`
- **Target roles**: `anon`
- **Policy**: `true`

> Atau jalankan SQL ini sebagai alternatif:

```sql
-- Izinkan semua operasi pada bucket documents untuk anon role
CREATE POLICY "Allow all on documents" ON storage.objects
  FOR ALL USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');
```

### 1.6 Set RLS (Row Level Security) untuk Tabel `files`

1. Buka **Table Editor** → pilih tabel `files`
2. Klik **RLS Disabled** → **Enable RLS**
3. Tambah policy:

```sql
-- Izinkan semua operasi untuk anon role pada tabel files
CREATE POLICY "Allow all on files" ON public.files
  FOR ALL USING (true)
  WITH CHECK (true);
```

---

## 2. Setup Lokal

### 2.1 Install Dependencies

```bash
# Dari root project
cd apps/api
npm install

cd ../web
npm install
```

### 2.2 Buat File `.env`

**`apps/api/.env`**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_BUCKET=documents
PORT=4000
PYTHON_PATH=python
WEB_URL=http://localhost:5173
```

**`apps/web/.env`**:
```env
VITE_API_URL=http://localhost:4000
```

### 2.3 Setup Python (untuk Kreuzberg OCR)

```bash
# Dari root project
python -m pip install kreuzberg
```

Atau dengan venv:
```bash
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install kreuzberg
```

Jika pakai venv, set di `.env`:
```env
PYTHON_PATH=C:\path\to\project\.venv\Scripts\python.exe
```

### 2.4 Jalankan Development Server

```bash
# Terminal 1 — API
cd apps/api
npm run dev

# Terminal 2 — Web
cd apps/web
npm run dev
```

Buka `http://localhost:5173` di browser.

### 2.5 Test Docker Lokal (Opsional)

```bash
# Dari root project (pastikan Docker Desktop berjalan)
docker-compose up --build
```

- Web: `http://localhost:8080`
- API: `http://localhost:4000`

---

## 3. Push ke GitHub

### 3.1 Buat Repository

1. Buka [github.com](https://github.com) → **New Repository**
2. Nama: `doc-intel-app` (atau sesuai keinginan)
3. Visibility: **Public** atau **Private**
4. **Jangan** centang "Initialize with README"

### 3.2 Push Kode

```bash
cd c:\Users\mhilm\Downloads\Intern_MKI\doc-intel-app

git init
git add .
git commit -m "feat: migrate to Supabase storage + prepare for deployment"
git branch -M main
git remote add origin https://github.com/USERNAME/doc-intel-app.git
git push -u origin main
```

> Ganti `USERNAME` dengan username GitHub kamu.

---

## 4. Deploy API ke Render

### 4.1 Buat Akun Render

1. Buka [render.com](https://render.com) → **Sign Up** dengan GitHub

### 4.2 Buat Web Service

1. Klik **New** → **Web Service**
2. **Connect Repository** → pilih `doc-intel-app`
3. Isi konfigurasi:

| Setting | Value |
|---------|-------|
| **Name** | `doc-intel-api` |
| **Region** | Singapore (atau terdekat) |
| **Root Directory** | `apps/api` |
| **Runtime** | `Docker` |
| **Instance Type** | **Free** |

4. Klik **Advanced** → **Add Environment Variable**:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi...` |
| `SUPABASE_BUCKET` | `documents` |
| `PORT` | `3000` |
| `PYTHON_PATH` | `python3` |
| `WEB_URL` | *(isi nanti setelah Vercel deploy)* |

5. Klik **Create Web Service**
6. Tunggu build selesai (~5-10 menit pertama kali)
7. **Catat URL**: misalnya `https://doc-intel-api.onrender.com`

### 4.3 Test API

Buka di browser:
```
https://doc-intel-api.onrender.com/api/health
```

Harus mengembalikan:
```json
{ "status": "ok", "timestamp": "..." }
```

---

## 5. Deploy Web ke Vercel

### 5.1 Buat Akun Vercel

1. Buka [vercel.com](https://vercel.com) → **Sign Up** dengan GitHub

### 5.2 Import Project

1. Klik **Add New** → **Project**
2. **Import Git Repository** → pilih `doc-intel-app`
3. Konfigurasi:

| Setting | Value |
|---------|-------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `apps/web` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

4. Klik **Environment Variables** → tambahkan:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://doc-intel-api.onrender.com` |

> Ganti URL dengan URL Render dari langkah 4.2.

5. Klik **Deploy**
6. Tunggu build selesai (~1-2 menit)
7. **Catat URL**: misalnya `https://doc-intel-app.vercel.app`

### 5.3 Update CORS di Render

Kembali ke Render dashboard:

1. Buka service `doc-intel-api` → **Environment**
2. Update variable `WEB_URL` dengan URL Vercel:
   ```
   WEB_URL=https://doc-intel-app.vercel.app
   ```
3. Klik **Save Changes** → service akan otomatis redeploy

---

## 6. Verifikasi

### Checklist

- [ ] Buka URL Vercel → halaman upload muncul
- [ ] Upload file → file tersimpan di Supabase Storage
- [ ] Cek Supabase Dashboard → Storage → bucket `documents` → ada file
- [ ] Cek Supabase Dashboard → Table Editor → `files` → ada record
- [ ] Klik Extract → hasil ekstraksi muncul
- [ ] Klik Delete → file terhapus dari Storage dan DB
- [ ] Download file → file terdownload dari Supabase URL

### URL Penting

| Service | URL |
|---------|-----|
| **Web App** | `https://doc-intel-app.vercel.app` |
| **API** | `https://doc-intel-api.onrender.com` |
| **Health Check** | `https://doc-intel-api.onrender.com/api/health` |
| **Supabase Dashboard** | `https://supabase.com/dashboard` |

---

## 7. Troubleshooting

### API tidak merespon / 502 error
- Render free tier spin down setelah 15 menit idle
- Request pertama setelah idle butuh ~30 detik
- Solusi: tunggu, lalu refresh

### Upload gagal / CORS error
- Pastikan `WEB_URL` di Render sudah diisi dengan URL Vercel
- Pastikan tidak ada trailing slash di URL

### Extraction gagal / Python error
- Cek Render logs: Dashboard → service → **Logs**
- Pastikan Dockerfile berhasil install `tesseract-ocr` dan `kreuzberg`

### File tidak muncul / 404
- Pastikan bucket `documents` di Supabase berstatus **Public**
- Pastikan storage policies sudah dibuat (lihat langkah 1.5)

### Database error / RLS
- Pastikan RLS policy sudah dibuat untuk tabel `files` (lihat langkah 1.6)
- Cek di Supabase: Table Editor → files → RLS harus enabled + policy ada

---

## Ringkasan Biaya

| Layanan | Free Tier |
|---------|-----------|
| **Vercel** | Unlimited deploys, 100GB bandwidth/bulan |
| **Render** | 750 jam/bulan, spin down setelah idle |
| **Supabase** | 500MB database, 1GB storage, 2GB bandwidth |

Semua **100% gratis** untuk project skala kecil-menengah.
