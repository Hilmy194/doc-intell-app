// API client — all server communication goes through here
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const UPLOAD_URL = `${BASE_URL}/api/upload`;
const CASES_URL = `${BASE_URL}/api/cases`;

function getAuthToken() {
  return localStorage.getItem('docintel_token');
}

/**
 * Login user and return { token, user }
 */
export async function loginUser(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

/**
 * Register a new user and return { token, user, message }
 */
export async function registerUser(email, password, name) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

/**
 * Upload files with progress tracking via XMLHttpRequest.
 * @param {File[]} files
 * @param {function} onProgress
 * @param {string|null} caseId  - optional case to scope the upload
 */
export function uploadFiles(files, onProgress, caseId = null) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    if (caseId) formData.append('caseId', caseId);

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
    const token = getAuthToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

// Run extraction on an uploaded file using the specified tool
export async function extractFile(storedName, mime, tool = 'kreuzberg', options = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ storedName, mime, tool, options }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Extraction failed');
  return data;
}

// Delete an uploaded file
export async function deleteFile(storedName) {
  const token = getAuthToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/files/${encodeURIComponent(storedName)}`, {
    method: 'DELETE',
    headers,
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

// ── Cases API ────────────────────────────────────────────────────────────────

// Fetch all cases
export async function listCases() {
  const res = await fetch(CASES_URL);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list cases');
  return data.cases || [];
}

// Create a new case
export async function createCase({ name, description }) {
  const token = getAuthToken();
  const res = await fetch(CASES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name, description }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create case');
  return data.case;
}

// Delete a case (and all its files)
export async function deleteCase(caseId) {
  const token = getAuthToken();
  const res = await fetch(`${CASES_URL}/${encodeURIComponent(caseId)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete case');
  }
}

// Update a case name / description
export async function updateCase(caseId, { name, description }) {
  const token = getAuthToken();
  const res = await fetch(`${CASES_URL}/${encodeURIComponent(caseId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name, description }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update case');
  return data.case;
}

// Fetch files scoped to a specific case
export async function listCaseFiles(caseId) {
  const res = await fetch(`${CASES_URL}/${encodeURIComponent(caseId)}/files`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list case files');
  return data.files || [];
}

// ── Chunks API ───────────────────────────────────────────────────────────────

export async function saveChunks(storedName, { force = false } = {}) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/chunks/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ storedName, force }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save chunks');
  return data;
}

export async function listChunks(storedName) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/chunks/${encodeURIComponent(storedName)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list chunks');
  return data;
}

// ── Entities API ─────────────────────────────────────────────────────────────

export async function extractEntities(caseId) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/entities/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ caseId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Entity extraction failed');
  return data;
}

export async function listEntities(caseId) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/entities/${encodeURIComponent(caseId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list entities');
  return data;
}

// ── Graph API ────────────────────────────────────────────────────────────────

export async function buildGraph(caseId) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/graph/build`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ caseId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Graph build failed');
  return data;
}

export async function getGraph(caseId) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/graph/${encodeURIComponent(caseId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get graph');
  return data;
}

// ── Ontology API ─────────────────────────────────────────────────────────────

export async function getOntology(caseId) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/cases/${encodeURIComponent(caseId)}/ontology`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get ontology');
  return data;
}

export async function updateOntology(caseId, rules) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/cases/${encodeURIComponent(caseId)}/ontology`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ rules }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update ontology');
  return data;
}
