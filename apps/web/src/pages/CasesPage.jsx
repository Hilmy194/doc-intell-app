import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
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
    <div
      className="min-h-screen font-sans px-4 md:px-7 py-5"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <main className="max-w-7xl mx-auto space-y-5">
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border-color)" }}>
            <div>
              <h1 className="text-xl font-semibold">Cases</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Manage case collections before processing documents</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm rounded-lg border"
                style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }}
              >
                Logout
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="px-3 py-1.5 text-sm rounded-lg bg-[#4f7cff] hover:bg-[#3d68e8] text-white"
              >
                + New Case
              </button>
            </div>
          </div>

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

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Case Library <span className="normal-case" style={{ color: "var(--text-muted)" }}>({cases.length})</span>
            </h2>
          </div>

        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-base font-semibold mb-4">Create New Case</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Case Name <span className="text-red-400">*</span></label>
                  <input
                    autoFocus
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                    style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    placeholder="e.g. Q1 Audit, Project Alpha…"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Description <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                  <textarea
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors resize-none"
                    style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
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
                    className="px-4 py-2 rounded-lg text-xs transition-colors"
                    style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)", backgroundColor: "transparent" }}
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

          {loading ? (
            <div className="flex items-center justify-center py-24" style={{ color: "var(--text-secondary)" }}>
            <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading cases…
            </div>
          ) : cases.length === 0 ? (
            <div
              onClick={() => setShowCreate(true)}
              className="cursor-pointer border-2 border-dashed rounded-xl py-20 flex flex-col items-center gap-3 transition-colors"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
            >
              <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <p className="text-sm">No cases yet, create your first case</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {cases.map((c) => {
                const col = colorForId(c.id);
                const isDeleting = deletingId === c.id;
                return (
                  <div
                    key={c.id}
                    className="relative group border rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all"
                    style={{ borderColor: col.border, background: col.bg }}
                    onClick={() => navigate(`/cases/${c.id}`)}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                      style={{ background: `${col.accent}22`, color: col.accent }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      </svg>
                    </div>

                    <h3 className="font-semibold text-sm truncate pr-8" style={{ color: "var(--text-primary)" }}>{c.name}</h3>
                    {c.description && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{c.description}</p>
                    )}
                    <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>Created {formatDate(c.createdAt)}</p>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                      disabled={isDeleting}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all"
                      style={{ color: "var(--text-secondary)" }}
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

              <div
                onClick={() => setShowCreate(true)}
                className="border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors min-h-[140px]"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">New Case</span>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
