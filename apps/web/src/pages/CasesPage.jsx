import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listCases, createCase, deleteCase } from "../lib/apiClient";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Simple colour palette for case cards
const CARD_COLORS = [
  { accent: "#4f7cff", bg: "rgba(79,124,255,0.08)", border: "rgba(79,124,255,0.25)" },
  { accent: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.25)" },
  { accent: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.25)" },
  { accent: "#a855f7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.25)" },
  { accent: "#06b6d4", bg: "rgba(6,182,212,0.08)",  border: "rgba(6,182,212,0.25)" },
  { accent: "#eab308", bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.25)" },
  { accent: "#ec4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.25)" },
];

function colorForId(id = "") {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
}

export default function CasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCases();
      setCases(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCases(); }, [loadCases]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createCase({ name: newName.trim(), description: newDesc.trim() });
      setCases((prev) => [created, ...prev]);
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (caseItem) => {
    if (!confirm(`Delete case "${caseItem.name}" and all its files? This cannot be undone.`)) return;
    setDeletingId(caseItem.id);
    try {
      await deleteCase(caseItem.id);
      setCases((prev) => prev.filter((c) => c.id !== caseItem.id));
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f1e] text-white px-6 py-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Document Intelligence</h1>
            <p className="text-sm text-[#8b9cc8] mt-1">Manage cases and their document collections</p>
          </div>
          <div className="flex items-center gap-3">
            {user && <span className="text-xs text-[#8b9cc8]">{user.email}</span>}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2340] border border-[#2a3060] hover:border-red-500/50 rounded-lg text-xs text-[#8b9cc8] hover:text-red-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-300 text-sm flex-1">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Cases header row */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Cases
            {cases.length > 0 && (
              <span className="text-[#8b9cc8] font-normal ml-1 normal-case tracking-normal">({cases.length})</span>
            )}
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4f7cff] hover:bg-[#3d68e8] rounded-lg text-xs text-white font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Case
          </button>
        </div>

        {/* Create case modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1e2340] border border-[#2a3060] rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-base font-semibold text-white mb-4">Create New Case</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#8b9cc8] mb-1">Case Name <span className="text-red-400">*</span></label>
                  <input
                    autoFocus
                    className="w-full bg-[#0d0f1e] border border-[#2a3060] focus:border-[#4f7cff] rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors"
                    placeholder="e.g. Q1 Audit, Project Alpha…"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8b9cc8] mb-1">Description <span className="text-[#8b9cc8]">(optional)</span></label>
                  <textarea
                    className="w-full bg-[#0d0f1e] border border-[#2a3060] focus:border-[#4f7cff] rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors resize-none"
                    rows={3}
                    placeholder="What is this case for?"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
                    className="px-4 py-2 rounded-lg text-xs text-[#8b9cc8] hover:text-white border border-[#2a3060] hover:border-[#4f7cff] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="px-4 py-2 rounded-lg text-xs text-white bg-[#4f7cff] hover:bg-[#3d68e8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {creating ? "Creating…" : "Create Case"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cases grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#8b9cc8]">
            <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading cases…
          </div>
        ) : cases.length === 0 ? (
          <div
            onClick={() => setShowCreate(true)}
            className="cursor-pointer bg-[#1e2340] border-2 border-dashed border-[#2a3060] hover:border-[#4f7cff] rounded-xl py-20 flex flex-col items-center gap-3 text-[#8b9cc8] hover:text-white transition-colors"
          >
            <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <p className="text-sm">No cases yet — click to create one</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cases.map((c) => {
              const col = colorForId(c.id);
              const isDeleting = deletingId === c.id;
              return (
                <div
                  key={c.id}
                  className="relative group bg-[#1e2340] border rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all"
                  style={{ borderColor: col.border, background: col.bg }}
                  onClick={() => navigate(`/cases/${c.id}`)}
                >
                  {/* Folder icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: `${col.accent}22`, color: col.accent }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                  </div>

                  <h3 className="font-semibold text-sm text-white truncate pr-8">{c.name}</h3>
                  {c.description && (
                    <p className="text-xs text-[#8b9cc8] mt-1 line-clamp-2">{c.description}</p>
                  )}
                  <p className="text-xs text-[#8b9cc8] mt-3">Created {formatDate(c.createdAt)}</p>

                  {/* Delete button (shown on hover) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                    disabled={isDeleting}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 text-[#8b9cc8] hover:text-red-400 rounded hover:bg-red-900/20 transition-all"
                    title="Delete case"
                  >
                    {isDeleting ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}

            {/* Quick-add card */}
            <div
              onClick={() => setShowCreate(true)}
              className="bg-[#1e2340] border-2 border-dashed border-[#2a3060] hover:border-[#4f7cff] rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer text-[#8b9cc8] hover:text-white transition-colors min-h-[140px]"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">New Case</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
