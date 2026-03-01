// API client — all server communication goes through here
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const UPLOAD_URL = `${BASE_URL}/api/upload`;

/**
 * Upload files with progress tracking via XMLHttpRequest.
 */
export function uploadFiles(files, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          if (response.files) {
            response.files = response.files.map((f) => ({
              ...f,
              uploadedAt: f.uploadedAt || new Date().toISOString(),
              extractStatus: 'pending',
            }));
          }
          resolve(response);
        } else {
          reject(new Error(response.error || `Upload failed (HTTP ${xhr.status})`));
        }
      } catch {
        // API returned non-JSON (e.g. Render cold-start 502, CORS block, or server crash)
        const preview = xhr.responseText ? xhr.responseText.slice(0, 120) : '(empty)';
        reject(new Error(
          `Server returned HTTP ${xhr.status} — API mungkin sedang cold-start atau crash.\n` +
          `Cek: ${BASE_URL}/api/health\nResponse: ${preview}`
        ));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error(`Network error — tidak bisa menghubungi API di ${BASE_URL}. Cek VITE_API_URL di Vercel env vars.`));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'));
    });

    xhr.open('POST', UPLOAD_URL);
    xhr.send(formData);
  });
}

// Run extraction on an uploaded file using the specified tool
export async function extractFile(storedName, mime, tool = 'local', options = {}) {
  const res = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storedName, mime, tool, options }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Extraction failed');
  return data;
}

// Delete an uploaded file
export async function deleteFile(storedName) {
  const res = await fetch(`${BASE_URL}/api/files/${encodeURIComponent(storedName)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Delete failed');
  }
}

// List available extractor tools
export async function listExtractors() {
  const res = await fetch(`${BASE_URL}/api/extract/tools`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list extractors');
  return data.tools || [];
}

// Fetch all uploaded files from the database
export async function listFiles() {
  const res = await fetch(`${BASE_URL}/api/files`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list files');
  return data.files || [];
}
