# Document Intelligence App — Phase 1

Upload system foundation for the Document Intelligence pipeline.

## Tech Stack

- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Node.js + Express + Multer
- **Architecture:** Monorepo (npm workspaces)

## Prerequisites

- Node.js >= 18
- npm >= 9

## Setup

```bash
# 1. Clone the repo & enter the project
cd doc-intel-app

# 2. Install all dependencies (root + workspaces)
npm install

# 3. Copy env example (optional)
cp .env.example .env
```

## Running the App

### Start both frontend & backend concurrently

```bash
npm run dev
```

### Start individually

```bash
# Backend (port 4000)
npm run dev:api

# Frontend (port 5173)
npm run dev:web
```

## API

### POST `/api/upload`

- **Content-Type:** `multipart/form-data`
- **Field name:** `files`
- **Max file size:** 25 MB
- **Allowed types:** pdf, png, jpg, jpeg, docx, xlsx, pptx, txt, csv

#### Success Response (200)

```json
{
  "files": [
    {
      "id": "f_abc123def456",
      "name": "document.pdf",
      "mime": "application/pdf",
      "size": 2039201,
      "status": "uploaded"
    }
  ]
}
```

#### Error Response (400 / 413)

```json
{
  "error": "Extension .exe is not allowed"
}
```

### GET `/api/health`

Health check endpoint.

## Folder Structure

```
doc-intel-app/
├── package.json
├── .env.example
├── README.md
├── apps/
│   ├── web/                  # Frontend (Vite + React + Tailwind)
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.jsx
│   │       ├── index.css
│   │       ├── pages/
│   │       │   └── UploadPage.jsx
│   │       ├── components/
│   │       │   └── upload/
│   │       │       ├── Dropzone.jsx
│   │       │       ├── FileItem.jsx
│   │       │       └── validators.js
│   │       └── lib/
│   │           └── apiClient.js
│   └── api/                  # Backend (Express + Multer)
│       ├── package.json
│       ├── uploads/
│       └── src/
│           ├── server.js
│           ├── routes/
│           │   └── upload.routes.js
│           ├── controllers/
│           │   └── upload.controller.js
│           ├── middlewares/
│           │   └── multer.js
│           └── config/
│               └── allowedFiles.js
```

## License

Private — Internal use only.
