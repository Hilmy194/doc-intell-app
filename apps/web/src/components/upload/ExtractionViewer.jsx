import { useState, useCallback } from 'react';
import { extractFile } from '../../lib/apiClient';

const TABS = ['Parse', 'Split', 'Extract'];
const TOOLS = [
  { value: 'kreuzberg', label: 'Kreuzberg', desc: 'Python-based extraction supporting PDF, DOCX, PPTX, XLSX, images (OCR), TXT, CSV, and more. No external API needed.' },
  { value: 'local', label: 'Local (built-in)', desc: 'Simple built-in parsers: pdf-parse for PDFs, plain text for TXT/CSV/JSON. Lightweight fallback.' },
  { value: 'landing-ai', label: 'Landing AI (coming soon)', disabled: true, desc: 'Agentic document extraction via Landing AI API.' },
  { value: 'unstructured', label: 'Unstructured (coming soon)', disabled: true, desc: 'Open-source ETL pipeline for documents.' },
  { value: 'azure-di', label: 'Azure Document Intelligence (coming soon)', disabled: true, desc: 'Microsoft Azure cloud-based document analysis.' },
];

function getFileType(mime = '') {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/plain' || mime === 'text/csv' || mime === 'application/json') return 'text';
  return 'other';
}

function FilePreview({ file }) {
  const url = file.url;
  const type = getFileType(file.mime);

  if (type === 'pdf') {
    return (
      <iframe
        src={url}
        title={file.name}
        className="w-full h-full rounded border border-[#2a3060]"
        style={{ minHeight: 0 }}
      />
    );
  }
  if (type === 'image') {
    return (
      <div className="flex items-center justify-center h-full">
        <img
          src={url}
          alt={file.name}
          className="max-w-full max-h-full object-contain rounded"
        />
      </div>
    );
  }
  if (type === 'text') {
    return (
      <iframe
        src={url}
        title={file.name}
        className="w-full h-full rounded border border-[#2a3060] bg-[#0d0f1e] text-white"
        style={{ minHeight: 0 }}
      />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-[#8b9cc8]">
      <svg className="w-16 h-16 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm">Preview not available for this file type</p>
      <a
        href={url}
        download={file.name}
        className="px-4 py-2 bg-[#4f7cff] hover:bg-[#3d6ae0] rounded text-white text-sm transition-colors"
      >
        Download File
      </a>
    </div>
  );
}

function MarkdownContent({ text }) {
  if (!text) return <p className="text-[#8b9cc8] text-sm">No content available.</p>;
  return (
    <pre className="whitespace-pre-wrap text-sm text-[#c8d4f0] leading-relaxed font-mono">
      {text}
    </pre>
  );
}

function JsonContent({ data }) {
  if (!data) return <p className="text-[#8b9cc8] text-sm">No data available.</p>;
  return (
    <pre className="whitespace-pre-wrap text-sm text-[#7dd3a8] leading-relaxed font-mono">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function ExtractionViewer({ file, onClose }) {
  const [activeTab, setActiveTab] = useState('Extract');
  const [outputFormat, setOutputFormat] = useState('markdown');
  const [selectedTool, setSelectedTool] = useState('kreuzberg');
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleExtract = useCallback(async () => {
    setIsExtracting(true);
    setError(null);
    try {
      const data = await extractFile(file.storedName, file.mime, selectedTool);
      setResult(data);
      setActiveTab('Parse');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExtracting(false);
    }
  }, [file, selectedTool]);

  const renderRightPanel = () => {
    switch (activeTab) {
      case 'Parse':
        if (!result) return <EmptyState message="Run extraction first." />;
        return (
          <div className="p-4 overflow-auto h-full">
            <div className="flex gap-2 mb-3">
              <span className="text-xs text-[#8b9cc8]">Pages: {result.pages ?? '—'}</span>
              <span className="text-xs text-[#8b9cc8]">·</span>
              <span className="text-xs text-[#8b9cc8]">Words: {result.wordCount ?? '—'}</span>
              <span className="text-xs text-[#8b9cc8]">·</span>
              <span className="text-xs text-[#8b9cc8]">Tool: {result.tool}</span>
            </div>
            {outputFormat === 'markdown'
              ? <MarkdownContent text={result.markdown} />
              : <JsonContent data={result.json} />}
          </div>
        );

      case 'Split':
        if (!result) return <EmptyState message="Run extraction first." />;
        if (!result.chunks?.length) return <EmptyState message="No chunks available." />;
        return (
          <div className="p-4 overflow-auto h-full space-y-3">
            {result.chunks.map((chunk, i) => (
              <div key={i} className="border border-[#2a3060] rounded p-3 bg-[#141627]">
                <div className="text-xs text-[#4f7cff] mb-1 font-semibold">
                  Chunk {i + 1} / {result.chunks.length}
                </div>
                <p className="text-sm text-[#c8d4f0] font-mono whitespace-pre-wrap">
                  {typeof chunk === 'string' ? chunk : chunk.text || JSON.stringify(chunk)}
                </p>
              </div>
            ))}
          </div>
        );

      case 'Extract':
        return (
          <div className="p-6 flex flex-col gap-6 overflow-auto h-full">
            <div>
              <label className="block text-xs font-semibold text-[#8b9cc8] uppercase tracking-wider mb-2">
                Extraction Tool
              </label>
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                className="w-full bg-[#0d0f1e] border border-[#2a3060] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4f7cff]"
              >
                {TOOLS.map((t) => (
                  <option key={t.value} value={t.value} disabled={t.disabled}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-[#141627] border border-[#2a3060] rounded p-4 text-sm text-[#8b9cc8] leading-relaxed">
              <p className="font-semibold text-white mb-1">{TOOLS.find(t => t.value === selectedTool)?.label}</p>
              <p>{TOOLS.find(t => t.value === selectedTool)?.desc}</p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/40 rounded p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {result && (
              <div className="bg-green-900/20 border border-green-500/30 rounded p-3 text-green-300 text-sm">
                Extraction complete — {result.pages ?? '?'} page(s), {result.wordCount ?? '?'} words.
                <button
                  className="ml-2 underline text-[#4f7cff] hover:text-white"
                  onClick={() => setActiveTab('Parse')}
                >
                  View results →
                </button>
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={isExtracting}
              className="flex items-center justify-center gap-2 bg-[#4f7cff] hover:bg-[#3d6ae0] disabled:opacity-50 disabled:cursor-not-allowed rounded px-6 py-3 text-white font-semibold text-sm transition-colors"
            >
              {isExtracting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Extracting…
                </>
              ) : 'Run Extraction'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-7xl h-[90vh] bg-[#1e2340] rounded-xl border border-[#2a3060] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a3060] bg-[#141627] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <svg className="w-5 h-5 text-[#4f7cff] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-white font-semibold text-sm truncate">{file.name}</span>
            {result && (
              <span className="text-xs text-[#8b9cc8] shrink-0">
                · {result.pages ?? '?'} pages · {result.wordCount ?? '?'} words
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Markdown / JSON toggle */}
            <div className="flex rounded overflow-hidden border border-[#2a3060] text-xs">
              {['markdown', 'json'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setOutputFormat(fmt)}
                  className={`px-3 py-1 transition-colors ${
                    outputFormat === fmt
                      ? 'bg-[#4f7cff] text-white'
                      : 'bg-[#1e2340] text-[#8b9cc8] hover:text-white'
                  }`}
                >
                  {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                </button>
              ))}
            </div>
            {/* Download */}
            <a
              href={file.url}
              download={file.name}
              className="p-1.5 text-[#8b9cc8] hover:text-white transition-colors"
              title="Download original"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-[#8b9cc8] hover:text-white transition-colors"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body: left preview + right panel */}
        <div className="flex flex-1 min-h-0">
          {/* Left — file preview */}
          <div className="w-1/2 border-r border-[#2a3060] p-3 flex flex-col min-h-0">
            <FilePreview file={file} />
          </div>

          {/* Right — tabs + content */}
          <div className="w-1/2 flex flex-col min-h-0">
            {/* Tab bar */}
            <div className="flex border-b border-[#2a3060] bg-[#141627] shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'text-white border-[#4f7cff]'
                      : 'text-[#8b9cc8] border-transparent hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              {renderRightPanel()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[#8b9cc8] gap-2">
      <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}
