import React, { useEffect, useState } from 'react';

function getMimeCategory(mime) {
  if (!mime) return 'unknown';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/plain' || mime === 'text/csv') return 'text';
  return 'office';
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function MimeTypeBadge({ mime }) {
  const ext = mime?.split('/').pop()?.toUpperCase() || '?';
  const map = {
    'image/png': 'bg-sky-900 text-sky-300',
    'image/jpeg': 'bg-sky-900 text-sky-300',
    'image/jpg': 'bg-sky-900 text-sky-300',
    'application/pdf': 'bg-red-900/70 text-red-300',
    'text/plain': 'bg-zinc-700 text-zinc-300',
    'text/csv': 'bg-teal-900/70 text-teal-300',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'bg-blue-900/70 text-blue-300',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'bg-green-900/70 text-green-300',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'bg-orange-900/70 text-orange-300',
  };
  const labelMap = {
    'application/pdf': 'PDF',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'image/png': 'PNG',
    'image/jpeg': 'JPG',
  };
  const cls = map[mime] || 'bg-zinc-700 text-zinc-300';
  const label = labelMap[mime] || ext;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cls}`}>{label}</span>
  );
}

function TextViewer({ url }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setError('Failed to load file content'));
  }, [url]);

  if (error) return <p className="text-red-400 text-sm p-4">{error}</p>;
  if (content === null) return (
    <div className="flex items-center justify-center h-40 text-[#5c6290] text-sm">Loading...</div>
  );

  return (
    <pre className="p-4 text-xs text-[#c8cff0] font-mono whitespace-pre-wrap break-all leading-relaxed overflow-auto max-h-[500px]">
      {content}
    </pre>
  );
}

export default function FileViewer({ file, onClose }) {
  const category = getMimeCategory(file?.mime);

  // Trap keyboard
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(10, 12, 30, 0.85)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl animate-slide-up"
        style={{ background: '#1e2340', border: '1px solid #2a3060' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3060]">
          <div className="flex items-center gap-3 min-w-0">
            <MimeTypeBadge mime={file.mime} />
            <span className="font-semibold text-[#e8eaf6] truncate">{file.name}</span>
          </div>
          <div className="flex items-center gap-4 ml-4 flex-shrink-0">
            <span className="text-xs text-[#5c6290]">{formatSize(file.size)}</span>
            <span className="text-xs text-[#5c6290]">{formatDate(file.uploadedAt)}</span>
            {/* Download */}
            <a
              href={file.url}
              download={file.name}
              className="flex items-center gap-1.5 text-xs text-[#4f7cff] hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-[#4f7cff]/20"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
            {/* Close */}
            <button
              onClick={onClose}
              className="text-[#5c6290] hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto rounded-b-2xl" style={{ background: '#141627' }}>
          {category === 'image' && (
            <div className="flex items-center justify-center p-6 min-h-[300px]">
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full max-h-[500px] object-contain rounded-lg shadow-lg"
              />
            </div>
          )}

          {category === 'pdf' && (
            <iframe
              src={`${file.url}#toolbar=1&navpanes=0`}
              title={file.name}
              className="w-full h-[600px] border-0"
            />
          )}

          {category === 'text' && (
            <TextViewer url={file.url} />
          )}

          {category === 'office' && (
            <div className="flex flex-col items-center justify-center h-60 gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[#1e2340]">
                <svg className="w-8 h-8 text-[#5c6290]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[#8b92b8] text-sm font-medium">Preview not available</p>
                <p className="text-[#5c6290] text-xs mt-1">
                  Browser preview is not supported for this file type.
                </p>
              </div>
              <a
                href={file.url}
                download={file.name}
                className="flex items-center gap-2 text-sm font-medium text-white bg-[#4f7cff] hover:bg-[#3b63e6] transition-colors px-4 py-2 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download to view
              </a>
            </div>
          )}

          {category === 'unknown' && (
            <div className="flex items-center justify-center h-40 text-[#5c6290] text-sm">
              Cannot preview this file type.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
