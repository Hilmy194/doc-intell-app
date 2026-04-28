import { useState, useCallback, useMemo, useEffect } from 'react';
import { listProcessingEngines, processFile } from '../../lib/apiClient';

const ENGINE_CARDS = [
  {
    value: 'liteparse',
    label: 'Liteparse',
    desc: 'Local fast parser',
  },
  {
    value: 'docling',
    label: 'Docling',
    desc: 'OCR + layout-aware parsing',
  },
  {
    value: 'kreuzberg',
    label: 'Kreuzberg',
    desc: 'Smart semantic parsing',
  },
  {
    value: 'opendataloader_pdf',
    label: 'OpenDataLoader PDF',
    desc: 'Simple PDF parser',
  },
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
        className="w-full h-full rounded"
        style={{ minHeight: 0, border: "1px solid var(--border-color)" }}
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
        className="w-full h-full rounded"
        style={{ minHeight: 0, border: "1px solid var(--border-color)", backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
      />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "var(--text-secondary)" }}>
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
  if (!text) return <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No content available.</p>;
  return (
    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono" style={{ color: "var(--text-primary)" }}>
      {text}
    </pre>
  );
}

function JsonContent({ data }) {
  if (!data) return <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No data available.</p>;
  return (
    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono" style={{ color: "var(--text-primary)" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function ExtractionViewer({ files = [], file = null, onClose, initialMode = 'parse', initialFileName = '' }) {
  const fileList = files.length > 0 ? files : file ? [file] : [];
  const [activeMode, setActiveMode] = useState(initialMode);
  const [activeStage, setActiveStage] = useState('build');
  const [outputFormat, setOutputFormat] = useState('markdown');
  const [selectedFileName, setSelectedFileName] = useState(initialFileName || file?.storedName || fileList[0]?.storedName || '');
  const [selectedEngine, setSelectedEngine] = useState('liteparse');
  const [availableEngines, setAvailableEngines] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastMode, setLastMode] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [advanced, setAdvanced] = useState({
    chunk_size: 900,
    chunk_overlap: 120,
    output_format: 'markdown',
    use_ocr: true,
    fallback_engine: '',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setActiveMode(initialMode || 'parse');
  }, [initialMode]);

  useEffect(() => {
    if (!selectedFileName && fileList.length > 0) {
      setSelectedFileName(fileList[0].storedName);
    }
  }, [fileList, selectedFileName]);

  useEffect(() => {
    listProcessingEngines()
      .then((data) => {
        const engines = Array.isArray(data?.engines) ? data.engines : [];
        setAvailableEngines(engines);
        if (engines.length > 0 && !engines.includes(selectedEngine)) {
          setSelectedEngine(engines[0]);
        }
      })
      .catch(() => {
        // Keep static engine list when endpoint is not reachable.
      });
  }, []);

  const selectableEngines = useMemo(() => {
    if (availableEngines.length === 0) return ENGINE_CARDS;
    return ENGINE_CARDS.filter((card) => availableEngines.includes(card.value));
  }, [availableEngines]);

  const normalizedOptions = useMemo(() => {
    const output = {
      chunk_size: Number(advanced.chunk_size) || 900,
      chunk_overlap: Number(advanced.chunk_overlap) || 120,
      output_format: advanced.output_format || 'markdown',
      use_ocr: Boolean(advanced.use_ocr),
    };

    if (advanced.fallback_engine) {
      output.fallback_engine = advanced.fallback_engine;
    }
    return output;
  }, [advanced]);

  const handleProcess = useCallback(async (mode) => {
    setIsProcessing(true);
    setLastMode(mode);
    setError(null);
    setSuccessMsg('');
    try {
      const activeFile = fileList.find((f) => f.storedName === selectedFileName) || fileList[0];
      if (!activeFile) {
        throw new Error('Please select a file first.');
      }
      const data = await processFile({
        storedName: activeFile.storedName,
        mime: activeFile.mime,
        engine: selectedEngine,
        mode,
        options: normalizedOptions,
      });
      setResult(data?.result || null);
      setLastMode(mode);
      setOutputFormat(normalizedOptions.output_format || 'markdown');
      setSuccessMsg(`Processing complete with ${data?.engine || selectedEngine} in ${mode} mode.`);
      setActiveStage('results');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [file, selectedEngine, normalizedOptions]);

  const metadata = result?.metadata || {};
  const selectedEngineMeta = selectableEngines.find((item) => item.value === selectedEngine) || ENGINE_CARDS[0];

  const activeFile = fileList.find((f) => f.storedName === selectedFileName) || fileList[0] || null;

  const resultLabel = useMemo(() => {
    if (lastMode === 'split') return 'Chunks';
    if (outputFormat === 'json') return 'JSON';
    return 'Markdown';
  }, [lastMode, outputFormat]);

  const renderBuildPanel = () => (
    <div className="h-full overflow-auto p-5 space-y-5" style={{ backgroundColor: "var(--bg-base)" }}>
      <section className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
          File Selection
          <select
            value={selectedFileName}
            onChange={(e) => setSelectedFileName(e.target.value)}
            className="mt-1.5 w-full rounded-md px-2.5 py-2 text-sm"
            style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
          >
            {fileList.length === 0 ? (
              <option value="">No files uploaded</option>
            ) : (
              fileList.map((f) => (
                <option key={f.storedName} value={f.storedName}>{f.name}</option>
              ))
            )}
          </select>
        </label>
      </section>

      <section className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Engine Tier</h3>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Choose processing engine</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {selectableEngines.map((engine) => {
            const selected = selectedEngine === engine.value;
            return (
              <button
                key={engine.value}
                type="button"
                onClick={() => setSelectedEngine(engine.value)}
                className="text-left rounded-lg border px-3 py-3 transition-all h-full flex flex-col gap-2"
                style={{
                  borderColor: selected ? "#2563eb" : "var(--border-color)",
                  backgroundColor: selected ? "rgba(37,99,235,0.12)" : "var(--bg-base)",
                }}
              >
                <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>{engine.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{engine.desc}</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed mt-3" style={{ color: "var(--text-secondary)" }}>{selectedEngineMeta?.desc}</p>
      </section>

      <section className="rounded-xl p-4 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Configuration</h3>
          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            className="text-xs text-[#2563eb] hover:text-[#1d4ed8]"
          >
            {advancedOpen ? 'Hide advanced' : 'Show advanced'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Output Format
            <select
              value={advanced.output_format}
              onChange={(e) => setAdvanced((prev) => ({ ...prev, output_format: e.target.value }))}
              className="mt-1.5 w-full rounded-md px-2.5 py-2 text-sm"
              style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Fallback Engine
            <select
              value={advanced.fallback_engine}
              onChange={(e) => setAdvanced((prev) => ({ ...prev, fallback_engine: e.target.value }))}
              className="mt-1.5 w-full rounded-md px-2.5 py-2 text-sm"
              style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="">Auto fallback chain</option>
              {selectableEngines
                .filter((item) => item.value !== selectedEngine)
                .map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
            </select>
          </label>
        </div>

        {advancedOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Chunk Size
              <input
                type="number"
                min={200}
                value={advanced.chunk_size}
                onChange={(e) => setAdvanced((prev) => ({ ...prev, chunk_size: e.target.value }))}
                className="mt-1.5 w-full rounded-md px-2.5 py-2 text-sm"
                style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Chunk Overlap
              <input
                type="number"
                min={0}
                value={advanced.chunk_overlap}
                onChange={(e) => setAdvanced((prev) => ({ ...prev, chunk_overlap: e.target.value }))}
                className="mt-1.5 w-full rounded-md px-2.5 py-2 text-sm"
                style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={advanced.use_ocr}
                onChange={(e) => setAdvanced((prev) => ({ ...prev, use_ocr: e.target.checked }))}
              />
              Enable OCR
            </label>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.12)", color: "var(--text-primary)" }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid rgba(34,197,94,0.35)", backgroundColor: "rgba(34,197,94,0.12)", color: "var(--text-primary)" }}>
          {successMsg}
        </div>
      )}

      <button
        onClick={() => handleProcess(activeMode)}
        disabled={isProcessing || !activeFile}
        className="w-full rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white"
      >
        {isProcessing ? 'Processing...' : `Run ${activeMode.charAt(0).toUpperCase() + activeMode.slice(1)}`}
      </button>
    </div>
  );

  const renderResultsPanel = () => {
    if (!result) return <EmptyState message="Run processing first to view results." />;

    return (
      <div className="h-full overflow-auto p-5" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)", color: "#1d4ed8" }}>Engine: {metadata.engine || selectedEngine}</span>
          <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: "rgba(14,116,144,0.12)", border: "1px solid rgba(14,116,144,0.35)", color: "#0e7490" }}>Time: {metadata.processing_time || 0} ms</span>
          <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>View: {resultLabel}</span>
        </div>

        {metadata.fallback && (
          <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ border: "1px solid rgba(251,191,36,0.4)", backgroundColor: "rgba(251,191,36,0.12)", color: "var(--text-primary)" }}>
            Fallback used: {metadata.fallback.requested}{' -> '}{metadata.fallback.used}
          </div>
        )}

        {Array.isArray(metadata.warnings) && metadata.warnings.length > 0 && (
          <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ border: "1px solid rgba(249,115,22,0.4)", backgroundColor: "rgba(249,115,22,0.12)", color: "var(--text-primary)" }}>
            {metadata.warnings.join(' | ')}
          </div>
        )}

        <div className="flex rounded-lg overflow-hidden text-xs mb-4 w-fit" style={{ border: "1px solid var(--border-color)" }}>
          {['markdown', 'json', 'chunks'].map((fmt) => (
            <button
              key={fmt}
              onClick={() => setOutputFormat(fmt)}
              className="px-3 py-1.5 transition-colors"
              style={{
                backgroundColor: outputFormat === fmt ? "#0f172a" : "var(--bg-base)",
                color: outputFormat === fmt ? "#ffffff" : "var(--text-secondary)",
              }}
            >
              {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
            </button>
          ))}
        </div>

        {outputFormat === 'chunks' ? (
          <div className="space-y-3">
            {(result.chunks || []).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No chunks available.</p>
            ) : (
              result.chunks.map((chunk, i) => (
                <div key={i} className="rounded-lg p-3" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Chunk {i + 1}</p>
                  <pre className="text-xs whitespace-pre-wrap font-mono" style={{ color: "var(--text-primary)" }}>
                    {typeof chunk === 'string' ? chunk : chunk.text || JSON.stringify(chunk)}
                  </pre>
                </div>
              ))
            )}
          </div>
        ) : outputFormat === 'json' ? (
          <JsonContent data={result.json} />
        ) : (
          <MarkdownContent text={result.markdown} />
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[1400px] h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-center justify-between px-4 md:px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-md text-[11px] grid place-items-center font-bold" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>DI</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{activeFile?.name || "Workspace"}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{activeMode.charAt(0).toUpperCase() + activeMode.slice(1)} Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={activeFile?.url}
              download={activeFile?.name}
              className="px-2 py-1.5 text-xs rounded"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
              title="Download original"
            >
              Download
            </a>
            {result && result.markdown && (
              <button
                onClick={() => {
                  const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  const baseName = (activeFile?.name || 'document').replace(/\.[^/.]+$/, '');
                  a.href = url;
                  a.download = `${baseName}-extracted.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-2 py-1.5 text-xs rounded"
                style={{ color: "#1d4ed8", border: "1px solid rgba(59,130,246,0.35)", backgroundColor: "rgba(59,130,246,0.12)" }}
                title="Download Markdown"
              >
                Export .md
              </button>
            )}
            <button
              onClick={onClose}
              className="px-2 py-1.5 text-xs rounded"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
              title="Close"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          <div className="lg:w-[56%] p-3 md:p-4 min-h-0 flex flex-col" style={{ borderRight: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
            <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="px-2 py-1 rounded" style={{ backgroundColor: "rgba(79,70,229,0.12)", color: "#3730a3" }}>Document</span>
              <span>{activeFile?.mime || 'unknown mime'}</span>
            </div>
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-base)" }}>
              {activeFile ? <FilePreview file={activeFile} /> : <EmptyState message="No file selected." />}
            </div>
          </div>

          <div className="lg:w-[44%] flex min-h-0" style={{ backgroundColor: "var(--bg-base)" }}>
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--bg-base)" }}>
                  <button
                    onClick={() => setActiveStage('build')}
                    className={`px-3 py-1.5 rounded text-xs font-medium ${
                      activeStage === 'build' ? 'shadow-sm' : ''
                    }`}
                    style={{ backgroundColor: activeStage === 'build' ? "var(--bg-card)" : "transparent", color: activeStage === 'build' ? "var(--text-primary)" : "var(--text-secondary)" }}
                  >
                    Build
                  </button>
                  <button
                    onClick={() => setActiveStage('results')}
                    className={`px-3 py-1.5 rounded text-xs font-medium ${
                      activeStage === 'results' ? 'shadow-sm' : ''
                    }`}
                    style={{ backgroundColor: activeStage === 'results' ? "var(--bg-card)" : "transparent", color: activeStage === 'results' ? "var(--text-primary)" : "var(--text-secondary)" }}
                  >
                    Results
                  </button>
                </div>

              </div>

              <div className="flex-1 min-h-0">
                {activeStage === 'build' ? renderBuildPanel() : renderResultsPanel()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center" style={{ color: "var(--text-secondary)" }}>
      <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}
