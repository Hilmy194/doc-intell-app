// API client — all server communication goes through here
const RAW_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
const UPLOAD_URL = `${BASE_URL}/api/upload`;
const CASES_URL = `${BASE_URL}/api/cases`;

function getAuthToken() {
  return localStorage.getItem('docintel_token');
}

async function parseApiResponse(res, fallbackMessage) {
  const text = await res.text();
  const body = text.trim();
  const isHtml = body.startsWith('<!DOCTYPE') || body.startsWith('<html') || body.startsWith('<');

  let data = null;
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (data?.error) throw new Error(data.error);
    if (isHtml) {
      throw new Error(
        `API mengembalikan HTML (HTTP ${res.status}) dari ${res.url}. Kemungkinan VITE_API_URL salah, atau backend sedang crash/cold-start. Cek endpoint health: ${BASE_URL}/api/health`
      );
    }
    throw new Error(`${fallbackMessage} (HTTP ${res.status})`);
  }

  if (isHtml) {
    throw new Error(
      `Response API berupa HTML dari ${res.url}. Pastikan VITE_API_URL mengarah ke backend API dan endpoint health aktif: ${BASE_URL}/api/health`
    );
  }

  if (data !== null) return data;
  return {};
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

export async function processFile({ storedName, mime, engine = 'liteparse', mode = 'parse', options = {}, file = null }) {
  const token = getAuthToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  let res;
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('engine', engine);
    formData.append('mode', mode);
    formData.append('options', JSON.stringify(options || {}));
    if (storedName) formData.append('storedName', storedName);
    if (mime) formData.append('mime', mime);

    res = await fetch(`${BASE_URL}/api/process`, {
      method: 'POST',
      headers: {
        ...authHeaders,
      },
      body: formData,
    });
  } else {
    res = await fetch(`${BASE_URL}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ storedName, mime, engine, mode, options }),
    });
  }

  const data = await parseApiResponse(res, 'Processing failed');
  return data;
}

export async function listProcessingEngines() {
  const res = await fetch(`${BASE_URL}/api/process/engines`);
  const data = await parseApiResponse(res, 'Failed to list processing engines');
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

// Fetch single case
export async function getCase(caseId) {
  const res = await fetch(`${CASES_URL}/${encodeURIComponent(caseId)}`);
  const data = await parseApiResponse(res, 'Failed to get case');
  return data.case || null;
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
  const data = await parseApiResponse(res, 'Failed to list case files');
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
  const data = await parseApiResponse(res, 'Failed to save chunks');
  return data;
}

export async function listChunks(storedName) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/chunks/${encodeURIComponent(storedName)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await parseApiResponse(res, 'Failed to list chunks');
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
  const data = await parseApiResponse(res, 'Entity extraction failed');
  return data;
}

export async function listEntities(caseId) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/entities/${encodeURIComponent(caseId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await parseApiResponse(res, 'Failed to list entities');
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
  const data = await parseApiResponse(res, 'Graph build failed');
  return data;
}

export async function getGraph(caseId) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/graph/${encodeURIComponent(caseId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await parseApiResponse(res, 'Failed to get graph');
  return data;
}

// ── Ontology API ─────────────────────────────────────────────────────────────

export async function getOntology(caseId) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/cases/${encodeURIComponent(caseId)}/ontology`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await parseApiResponse(res, 'Failed to get ontology');
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
  const data = await parseApiResponse(res, 'Failed to update ontology');
  return data;
}

// ── Classify API ────────────────────────────────────────────────────────────

export async function classifyFile(storedName, { force = false } = {}) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/classify/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ storedName, force }),
  });
  const data = await parseApiResponse(res, 'Failed to classify file');
  return data;
}

// ── Knowledge API ───────────────────────────────────────────────────────────

export async function indexKnowledge(caseId, { force = false } = {}) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/knowledge/index`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ caseId, force }),
  });
  const data = await parseApiResponse(res, 'Failed to index knowledge');
  return data;
}

export async function searchKnowledge(caseId, query, { topK = 8, minScore = 0 } = {}) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/knowledge/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ caseId, query, topK, minScore }),
  });
  const data = await parseApiResponse(res, 'Failed to search knowledge');
  return data;
}

export async function inspectEvidence(chunkId) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/knowledge/evidence/${encodeURIComponent(chunkId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await parseApiResponse(res, 'Failed to inspect evidence');
  return data;
}

// ── Fact-check API ──────────────────────────────────────────────────────────

export async function factCheckClaim(caseId, claim, { topK = 8, minScore = 0.1 } = {}) {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/api/fact-check/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ caseId, claim, topK, minScore }),
  });
  const data = await parseApiResponse(res, 'Failed to run fact-check');
  return data;
}
