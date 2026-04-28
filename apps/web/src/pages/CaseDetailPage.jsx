import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import Dropzone from "../components/upload/Dropzone";
import ExtractionViewer from "../components/upload/ExtractionViewer";
import { uploadFiles, deleteFile, listCaseFiles } from "../lib/apiClient";
import { validateFiles } from "../components/upload/validators";

const PROCESS_METHODS = [
  { value: "parse", label: "Parse", desc: "Convert to markdown/text" },
  { value: "extract", label: "Extract", desc: "Extract structured fields" },
  { value: "split", label: "Split", desc: "Create chunks for retrieval" },
];

const FORMAT_CARDS = [
  { ext: "PDF",  accent: "#ef4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)" },
  { ext: "DOCX", accent: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)" },
  { ext: "PPTX", accent: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.25)" },
  { ext: "XLS",  accent: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.25)" },
  { ext: "XLSX", accent: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.25)" },
  { ext: "CSV",  accent: "#06b6d4", bg: "rgba(6,182,212,0.08)",  border: "rgba(6,182,212,0.25)" },
  { ext: "JSON", accent: "#eab308", bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.25)" },
  { ext: "TXT",  accent: "#a855f7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.25)" },
  { ext: "PNG",  accent: "#ec4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.25)" },
  { ext: "JPG",  accent: "#ec4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.25)" },
  { ext: "JPEG", accent: "#ec4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.25)" },
];

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function extFromName(name = "") {
  return name.split(".").pop().toUpperCase();
}

function StatusBadge({ status }) {
  const map = {
    done:       { label: "Processed",  color: "#166534", bg: "rgba(34,197,94,0.16)", border: "rgba(34,197,94,0.45)" },
    extracting: { label: "Processing", color: "#1d4ed8", bg: "rgba(59,130,246,0.16)", border: "rgba(59,130,246,0.45)" },
    pending:    { label: "Pending",    color: "#92400e", bg: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.45)" },
    error:      { label: "Failed",     color: "#b91c1c", bg: "rgba(239,68,68,0.18)", border: "rgba(239,68,68,0.5)" },
  };
  const s = map[status] || map.pending;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const [caseInfo, setCaseInfo] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [extractTarget, setExtractTarget] = useState(null);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState("parse");
  const [selectedFileName, setSelectedFileName] = useState("");

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Load case metadata + files on mount
  useEffect(() => {
    // Fetch case info from the cases list (no separate endpoint needed)
    async function load() {
      try {
        const [casesRes, filesRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/cases/${caseId}`),
          listCaseFiles(caseId),
        ]);
        if (casesRes.ok) {
          const d = await casesRes.json();
          setCaseInfo(d.case);
        }
        const mappedFiles = filesRes.map((f) => ({ ...f, extractStatus: f.extractStatus || "pending" }));
        setUploadedFiles(mappedFiles);
        if (mappedFiles.length > 0) {
          setSelectedFileName(mappedFiles[0].storedName);
        }
      } catch (_) {/* non-fatal */}
    }
    load();
  }, [caseId]);

  const handleFiles = useCallback(async (files) => {
    setErrorMsg(null);
    const validations = validateFiles(files);
    const invalid = validations.filter((v) => !v.valid);
    if (invalid.length > 0) {
      setErrorMsg(invalid.map((v) => v.error).join("; "));
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    try {
      // Pass caseId so the server scopes the upload to this case
      const res = await uploadFiles(files, setUploadProgress, caseId);
      setUploadedFiles((prev) => {
        const incoming = (res.files || []).map((f) => ({ ...f, extractStatus: "pending" }));
        const merged = [
        ...prev,
          ...incoming,
        ];
        if (!selectedFileName && incoming.length > 0) {
          setSelectedFileName(incoming[0].storedName);
        }
        return merged;
      });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [caseId, selectedFileName]);

  const handleDelete = useCallback(async (file) => {
    try {
      await deleteFile(file.storedName);
      setUploadedFiles((prev) => {
        const remaining = prev.filter((f) => f.storedName !== file.storedName);
        if (selectedFileName === file.storedName) {
          setSelectedFileName(remaining[0]?.storedName || "");
        }
        return remaining;
      });
    } catch (err) {
      setErrorMsg(err.message);
    }
  }, [selectedFileName]);

  const openWorkspace = useCallback((mode) => {
    setErrorMsg(null);
    setSelectedMethod(mode);
    if (uploadedFiles.length === 0) {
      setErrorMsg("Please upload a file first.");
      return;
    }
    const nextFile = selectedFileName || uploadedFiles[0]?.storedName || "";
    if (nextFile) setSelectedFileName(nextFile);
    setExtractTarget({ mode, fileName: nextFile });
  }, [uploadedFiles, selectedFileName]);

  function previewType(mime = "") {
    if (mime.startsWith("image/")) return "image";
    if (mime === "application/pdf") return "pdf";
    if (mime === "text/plain" || mime === "text/csv" || mime === "application/json") return "text";
    return "other";
  }

  const handleDownloadAll = () => {
    uploadedFiles.forEach((f) => {
      const a = document.createElement("a");
      a.href = f.url;
      a.download = f.name;
      a.click();
    });
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="px-4 py-5 flex flex-col" style={{ backgroundColor: "var(--bg-sidebar)", borderRight: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-lg text-xs font-bold grid place-items-center" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>DI</div>
            <div>
              <p className="text-sm font-semibold">Doc Intelligence</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Case Workspace</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl p-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <p className="text-sm font-semibold">Default</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{user?.email || "No user"}</p>
          </div>

          <nav className="mt-6 space-y-1">
            {PROCESS_METHODS.map((m) => {
              const active = selectedMethod === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => openWorkspace(m.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    active
                      ? "border border-[#4f7cff]/40"
                      : "border border-transparent"
                  }`}
                  style={{
                    backgroundColor: active ? "rgba(79,124,255,0.18)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  <p className="text-sm font-semibold">{m.label}</p>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto">
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-sm rounded-lg transition-colors"
              style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)", backgroundColor: "transparent" }}
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="px-6 py-8">
          <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back to cases */}
            <button
              onClick={() => navigate("/")}
              className="shrink-0 p-1.5 rounded transition-colors"
              style={{ color: "var(--text-secondary)" }}
              title="All cases"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                  All Cases /
                </span>
                <h1 className="text-xl font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  {caseInfo ? caseInfo.name : "Loading…"}
                </h1>
              </div>
              {caseInfo?.description && (
                <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>{caseInfo.description}</p>
              )}
              {!caseInfo?.description && (
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Upload, parse, and extract structured data from your documents</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {user && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{user.email}</span>}
            <ThemeToggle />
          </div>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="rounded-lg px-4 py-3 flex items-start gap-3" style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Dropzone */}
        <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <Dropzone onFiles={handleFiles} disabled={isUploading} />
          {isUploading && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                <span>Uploading…</span><span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-color)" }}>
                <div className="h-full bg-[#4f7cff] rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Accepted formats */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Accepted Formats</h2>
          <div className="flex flex-wrap gap-2">
            {FORMAT_CARDS.map((fc) => (
              <span
                key={fc.ext}
                className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                style={{ color: fc.accent, background: fc.bg, borderColor: fc.border }}
              >
                .{fc.ext.toLowerCase()}
              </span>
            ))}
            <span className="px-2.5 py-1 rounded-md text-xs" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              Max 50 MB
            </span>
          </div>
        </div>

        {/* Files table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">
              Uploaded Files
              {uploadedFiles.length > 0 && (
                <span className="font-normal ml-1" style={{ color: "var(--text-secondary)" }}>({uploadedFiles.length})</span>
              )}
            </h2>
            {uploadedFiles.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/cases/${caseId}/knowledge-graph`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4f7cff]/20 border border-[#4f7cff]/40 hover:bg-[#4f7cff]/30 rounded-lg text-xs text-[#4f7cff] hover:text-white transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Knowledge Graph
                </button>
                <button
                  onClick={() => navigate(`/cases/${caseId}/fact-check`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22c55e]/20 border border-[#22c55e]/40 hover:bg-[#22c55e]/30 rounded-lg text-xs text-[#22c55e] hover:text-white transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Fact Checker
                </button>
                <button
                  onClick={handleDownloadAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                  style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download All
                </button>
              </div>
            )}
          </div>

          {uploadedFiles.length === 0 ? (
            <div className="rounded-xl py-12 flex flex-col items-center gap-2" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
              <svg className="w-10 h-10 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">No files in this case yet — drop files above to get started</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}>
                    <th className="text-left px-4 py-3 font-medium">File Name</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Size</th>
                    <th className="text-left px-4 py-3 font-medium">Upload Date</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedFiles.map((file, idx) => (
                    <tr key={file.storedName || idx} className="border-b last:border-0 transition-colors" style={{ borderColor: "var(--border-color)", backgroundColor: "transparent" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-[#4f7cff] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="truncate max-w-[200px]" style={{ color: "var(--text-primary)" }}>{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                          {extFromName(file.name)}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{formatBytes(file.size)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{formatDate(file.uploadedAt)}</td>
                      <td className="px-4 py-3"><StatusBadge status={file.extractStatus || "pending"} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <a href={file.url} download={file.name} title="Download" className="p-1.5 rounded transition-colors" style={{ color: "var(--text-secondary)" }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                          <button title="Preview" onClick={() => setPreviewTarget(file)} className="p-1.5 text-[#4f7cff] hover:text-white rounded hover:bg-[#4f7cff]/20 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.9 0a11.043 11.043 0 01-1.705 3.39C18.617 17.678 15.987 19 12 19s-6.617-1.322-8.195-3.61A11.043 11.043 0 012.1 12c.308-1.22.89-2.36 1.705-3.39C5.383 6.322 8.013 5 12 5s6.617 1.322 8.195 3.61A11.043 11.043 0 0121.9 12z" />
                            </svg>
                          </button>
                          <button title="Delete" onClick={() => handleDelete(file)} className="p-1.5 rounded transition-colors" style={{ color: "var(--text-secondary)" }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Extraction viewer modal */}
      {extractTarget && (
        <ExtractionViewer
          files={uploadedFiles}
          initialMode={extractTarget.mode}
          initialFileName={extractTarget.fileName}
          onClose={() => setExtractTarget(null)}
        />
      )}

      {/* Preview modal */}
      {previewTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setPreviewTarget(null)}
        >
          <div className="w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>Preview: {previewTarget.name}</p>
              <button
                onClick={() => setPreviewTarget(null)}
                className="px-2.5 py-1 text-xs rounded"
                style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)", backgroundColor: "transparent" }}
              >
                Close
              </button>
            </div>
            <div className="flex-1" style={{ backgroundColor: "var(--bg-base)" }}>
              {previewType(previewTarget.mime) === "pdf" && (
                <iframe src={previewTarget.url} title={previewTarget.name} className="w-full h-full" />
              )}
              {previewType(previewTarget.mime) === "image" && (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img src={previewTarget.url} alt={previewTarget.name} className="max-w-full max-h-full object-contain" />
                </div>
              )}
              {previewType(previewTarget.mime) === "text" && (
                <iframe src={previewTarget.url} title={previewTarget.name} className="w-full h-full" />
              )}
              {previewType(previewTarget.mime) === "other" && (
                <div className="h-full flex flex-col items-center justify-center gap-3" style={{ color: "var(--text-secondary)" }}>
                  <p className="text-sm">Preview is not available for this file type.</p>
                  <a
                    href={previewTarget.url}
                    download={previewTarget.name}
                    className="px-3 py-2 text-xs rounded bg-[#4f7cff] text-white"
                  >
                    Download file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
