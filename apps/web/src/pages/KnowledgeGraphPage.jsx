import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getCase,
  listCaseFiles,
  saveChunks,
  extractEntities,
  getGraph,
  buildGraph,
  getOntology,
  updateOntology,
} from "../lib/apiClient";

const ENTITY_COLORS = {
  PERSON: "#f97316",
  ORGANIZATION: "#3b82f6",
  DATE: "#22c55e",
  MONEY: "#eab308",
  EMAIL: "#ec4899",
  PHONE: "#8b5cf6",
  ID: "#06b6d4",
  DOCUMENT_ID: "#06b6d4",
  LOCATION: "#ef4444",
};

const ENTITY_TYPES = [
  "PERSON", "ORGANIZATION", "LOCATION", "DATE",
  "MONEY", "EMAIL", "PHONE", "DOCUMENT_ID",
];

const PRESETS = {
  "Terrorism Watchlist (DTTOT)": [
    { from: "PERSON",       to: "ORGANIZATION", relation: "member_of" },
    { from: "PERSON",       to: "LOCATION",     relation: "born_in" },
    { from: "PERSON",       to: "LOCATION",     relation: "nationality" },
    { from: "PERSON",       to: "LOCATION",     relation: "address_in" },
    { from: "PERSON",       to: "PERSON",       relation: "alias_of" },
    { from: "PERSON",       to: "DATE",         relation: "birth_date" },
    { from: "PERSON",       to: "DATE",         relation: "listed_on" },
    { from: "PERSON",       to: "DOCUMENT_ID",  relation: "identified_by" },
    { from: "ORGANIZATION", to: "ORGANIZATION", relation: "alias_of" },
    { from: "ORGANIZATION", to: "LOCATION",     relation: "origin_country" },
    { from: "ORGANIZATION", to: "LOCATION",     relation: "operates_in" },
    { from: "ORGANIZATION", to: "DATE",         relation: "listed_on" },
    { from: "ORGANIZATION", to: "DOCUMENT_ID",  relation: "identified_by" },
  ],
  "Contract / Legal": [
    { from: "PERSON",       to: "ORGANIZATION", relation: "works_at" },
    { from: "PERSON",       to: "ORGANIZATION", relation: "represents" },
    { from: "PERSON",       to: "DATE",         relation: "signed_on" },
    { from: "ORGANIZATION", to: "DATE",         relation: "effective_date" },
    { from: "ORGANIZATION", to: "MONEY",        relation: "contract_value" },
    { from: "PERSON",       to: "MONEY",        relation: "receives_salary" },
  ],
  "Financial Document": [
    { from: "PERSON",       to: "MONEY",        relation: "received" },
    { from: "ORGANIZATION", to: "MONEY",        relation: "paid" },
    { from: "PERSON",       to: "ORGANIZATION", relation: "owns" },
    { from: "ORGANIZATION", to: "DATE",         relation: "transaction_date" },
    { from: "ORGANIZATION", to: "LOCATION",     relation: "headquartered_in" },
  ],
};

const STEPS = [
  { key: "chunks",   label: "1. Save Chunks",     desc: "Parse files -> persist text chunks" },
  { key: "entities", label: "2. Extract Entities", desc: "AI extracts entities & applies your ontology" },
  { key: "graph",    label: "3. Apply Rules",      desc: "Co-occurrence pass: add links from ontology rules" },
];

export default function KnowledgeGraphPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [caseInfo, setCaseInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [stepResults, setStepResults] = useState({});
  const [filter, setFilter] = useState("ALL");
  const [ForceGraph, setForceGraph] = useState(null);

  // Ontology state
  const [ontologyRules, setOntologyRules] = useState([]);
  const [ontologySaving, setOntologySaving] = useState(false);
  const [ontologySaved, setOntologySaved] = useState(false);

  const containerRef = useRef(null);
  const fgRef = useRef(null);

  // Lazy-load react-force-graph-2d
  useEffect(() => {
    import("react-force-graph-2d")
      .then((mod) => setForceGraph(() => mod.default))
      .catch(() => console.warn("react-force-graph-2d not installed"));
  }, []);

  // Load case info + files + ontology
  useEffect(() => {
    async function load() {
      try {
        const [caseRes, filesRes, ontologyRes] = await Promise.all([
          getCase(caseId).catch(() => null),
          listCaseFiles(caseId),
          getOntology(caseId).catch(() => ({ ontologyRules: [] })),
        ]);
        if (caseRes) setCaseInfo(caseRes);
        setFiles(filesRes);
        setOntologyRules(ontologyRes.ontologyRules || []);
      } catch {/* non-fatal */}
    }
    load();
  }, [caseId]);

  const refreshGraph = useCallback(async () => {
    try {
      const data = await getGraph(caseId);
      setGraphData({ nodes: data.nodes || [], links: data.links || [] });
      setStats(data.stats || null);
    } catch {/* No graph yet */}
  }, [caseId]);

  useEffect(() => { refreshGraph(); }, [refreshGraph]);

  // â”€â”€ Ontology handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleAddRule = () => {
    setOntologySaved(false);
    setOntologyRules((prev) => [...prev, { from: "PERSON", to: "ORGANIZATION", relation: "" }]);
  };

  const handleRemoveRule = (i) => {
    setOntologySaved(false);
    setOntologyRules((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleUpdateRule = (i, field, value) => {
    setOntologySaved(false);
    setOntologyRules((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))
    );
  };

  const handleApplyPreset = (presetName) => {
    setOntologyRules([...(PRESETS[presetName] || [])]);
    setOntologySaved(false);
  };

  const handleSaveOntology = async () => {
    setOntologySaving(true);
    setError(null);
    try {
      await updateOntology(caseId, ontologyRules);
      setOntologySaved(true);
      setTimeout(() => setOntologySaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setOntologySaving(false);
    }
  };

  // â”€â”€ Pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const pipelineBusy = useRef(false);

  const runStep = async (step) => {
    setError(null);
    setLoading(step);
    try {
      if (step === "chunks") {
        let total = 0;
        for (const f of files) {
          const res = await saveChunks(f.storedName, { force: true });
          total += res.count || 0;
        }
        setStepResults((p) => ({ ...p, chunks: `${total} chunks saved` }));
      } else if (step === "entities") {
        const res = await extractEntities(caseId);
        const modeLabel = res.extractorMode === "openai" ? "AI" : res.extractorMode === "hybrid" ? "Hybrid" : "Regex";
        const ontLabel = res.ontologyRulesUsed > 0 ? ` -- ${res.ontologyRulesUsed} rules` : "";
        setStepResults((p) => ({
          ...p,
          entities: `${res.entityCount} entities, ${res.relationCount} relations (${modeLabel}${ontLabel})`,
        }));
      } else if (step === "graph") {
        const res = await buildGraph(caseId);
        setStepResults((p) => ({
          ...p,
          graph: res.relationsCreated > 0
            ? `+${res.relationsCreated} links added`
            : res.message || "No new links (save ontology first)",
        }));
      }
      await refreshGraph();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(null);
    }
  };

  const runFullPipeline = async () => {
    if (pipelineBusy.current) return;
    pipelineBusy.current = true;
    try {
      for (const step of STEPS) {
        const ok = await runStep(step.key);
        if (!ok) break;
      }
    } finally {
      pipelineBusy.current = false;
    }
  };

  const filteredData =
    filter === "ALL"
      ? graphData
      : {
          nodes: graphData.nodes.filter((n) => n.type === filter),
          links: graphData.links.filter((l) => {
            const srcNode = graphData.nodes.find((n) => n.id === l.source || n.id === l.source?.id);
            const tgtNode = graphData.nodes.find((n) => n.id === l.target || n.id === l.target?.id);
            return srcNode?.type === filter || tgtNode?.type === filter;
          }),
        };

  const entityTypes = [...new Set(graphData.nodes.map((n) => n.type))];

  const handleLogout = () => { logout(); navigate("/login", { replace: true }); };

  return (
    <div className="min-h-screen bg-[#0d0f1e] text-white px-6 py-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/cases/${caseId}`)}
              className="shrink-0 p-1.5 text-[#8b9cc8] hover:text-white rounded hover:bg-[#2a3060] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8b9cc8] truncate">{caseInfo?.name || "Case"} /</span>
                <h1 className="text-xl font-bold text-white truncate">Knowledge Graph</h1>
              </div>
              <p className="text-sm text-[#8b9cc8] mt-0.5">
                {files.length} file{files.length !== 1 ? "s" : ""} in this case
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {user && <span className="text-xs text-[#8b9cc8]">{user.email}</span>}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2340] border border-[#2a3060] hover:border-red-500/50 rounded-lg text-xs text-[#8b9cc8] hover:text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 flex items-start gap-3">
            <p className="text-red-300 text-sm flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* â”€â”€ Ontology Editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="bg-[#1e2340] border border-[#2a3060] rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Ontology Rules</h2>
              <p className="text-xs text-[#8b9cc8] mt-0.5">
                Define how entities relate in this case. The AI will use these rules when extracting relationships.
              </p>
            </div>
            <button
              onClick={handleSaveOntology}
              disabled={ontologySaving}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                ontologySaved
                  ? "bg-green-900/40 border border-green-500/40 text-green-400"
                  : "bg-[#4f7cff]/20 border border-[#4f7cff]/40 text-[#4f7cff] hover:bg-[#4f7cff]/30"
              }`}
            >
              {ontologySaving ? "Saving..." : ontologySaved ? "Saved!" : "Save Ontology"}
            </button>
          </div>

          {/* Preset templates */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#8b9cc8]">Templates:</span>
            {Object.keys(PRESETS).map((name) => (
              <button
                key={name}
                onClick={() => handleApplyPreset(name)}
                className="px-2.5 py-1 text-xs rounded-md bg-[#2a3060] border border-[#2a3060] hover:border-[#4f7cff]/50 text-[#8b9cc8] hover:text-white transition-colors"
              >
                {name}
              </button>
            ))}
            <button
              onClick={() => { setOntologyRules([]); setOntologySaved(false); }}
              className="px-2.5 py-1 text-xs rounded-md bg-[#2a3060] border border-[#2a3060] hover:border-red-500/50 text-[#8b9cc8] hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Rules list */}
          {ontologyRules.length > 0 ? (
            <div className="space-y-2">
              {ontologyRules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={rule.from}
                    onChange={(e) => handleUpdateRule(i, "from", e.target.value)}
                    className="px-2 py-1.5 bg-[#0d0f1e] border border-[#2a3060] rounded-lg text-xs text-white focus:outline-none focus:border-[#4f7cff] min-w-[130px]"
                  >
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-[#8b9cc8] text-xs shrink-0">--</span>
                  <input
                    type="text"
                    value={rule.relation}
                    onChange={(e) => handleUpdateRule(i, "relation", e.target.value)}
                    placeholder="relation name"
                    className="px-2 py-1.5 bg-[#0d0f1e] border border-[#2a3060] rounded-lg text-xs text-white placeholder-[#8b9cc8]/50 focus:outline-none focus:border-[#4f7cff] w-36"
                  />
                  <span className="text-[#8b9cc8] text-xs shrink-0">{'-->'}</span>
                  <select
                    value={rule.to}
                    onChange={(e) => handleUpdateRule(i, "to", e.target.value)}
                    className="px-2 py-1.5 bg-[#0d0f1e] border border-[#2a3060] rounded-lg text-xs text-white focus:outline-none focus:border-[#4f7cff] min-w-[130px]"
                  >
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button
                    onClick={() => handleRemoveRule(i)}
                    className="p-1.5 text-[#8b9cc8] hover:text-red-400 rounded hover:bg-red-900/20 transition-colors shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8b9cc8]/60 italic">
              No rules defined -- select a template or add rules manually. Without rules the AI uses its own judgment.
            </p>
          )}

          <button
            onClick={handleAddRule}
            className="flex items-center gap-1.5 text-xs text-[#8b9cc8] hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Rule
          </button>
        </div>

        {/* Pipeline Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((step) => (
            <div key={step.key} className="bg-[#1e2340] border border-[#2a3060] rounded-xl p-4 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-white">{step.label}</h3>
              <p className="text-xs text-[#8b9cc8]">{step.desc}</p>
              {stepResults[step.key] && (
                <p className="text-xs text-green-400">{stepResults[step.key]}</p>
              )}
              <button
                onClick={() => runStep(step.key)}
                disabled={loading !== null}
                className="mt-auto px-3 py-1.5 bg-[#4f7cff]/20 border border-[#4f7cff]/40 text-[#4f7cff] hover:bg-[#4f7cff]/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              >
                {loading === step.key ? "Processing..." : "Run"}
              </button>
            </div>
          ))}
        </div>

        {/* Run all + Refresh */}
        <div className="flex items-center gap-4">
          <button
            onClick={runFullPipeline}
            disabled={loading !== null || files.length === 0}
            className="px-4 py-2 bg-[#4f7cff] hover:bg-[#3d6ae8] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          >
            {loading ? "Processing..." : "Run Full Pipeline"}
          </button>
          <button
            onClick={() => navigate(`/cases/${caseId}/fact-check`)}
            className="px-4 py-2 bg-[#22c55e]/20 border border-[#22c55e]/40 hover:bg-[#22c55e]/30 text-[#22c55e] hover:text-white rounded-lg text-sm transition-colors"
          >
            Open Fact Checker
          </button>
          <button
            onClick={refreshGraph}
            className="px-4 py-2 bg-[#1e2340] border border-[#2a3060] hover:border-[#4f7cff] text-[#8b9cc8] hover:text-white rounded-lg text-sm transition-colors"
          >
            Refresh Graph
          </button>
          {stats && (
            <span className="text-xs text-[#8b9cc8]">
              {stats.uniqueNodes} nodes &middot; {stats.uniqueLinks} links
            </span>
          )}
        </div>

        {/* Entity type filter */}
        {entityTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filter === "ALL"
                  ? "bg-white/10 text-white border-white/30"
                  : "bg-[#1e2340] text-[#8b9cc8] border-[#2a3060] hover:border-white/30"
              }`}
            >
              All
            </button>
            {entityTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type === filter ? "ALL" : type)}
                className="px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors"
                style={{
                  color: ENTITY_COLORS[type] || "#6b7280",
                  background: filter === type ? `${ENTITY_COLORS[type] || "#6b7280"}22` : "rgba(30,35,64,1)",
                  borderColor: filter === type ? ENTITY_COLORS[type] || "#6b7280" : "rgba(42,48,96,1)",
                }}
              >
                {type} ({graphData.nodes.filter((n) => n.type === type).length})
              </button>
            ))}
          </div>
        )}

        {/* Graph Visualization */}
        <div
          ref={containerRef}
          className="bg-[#1e2340] border border-[#2a3060] rounded-xl overflow-hidden"
          style={{ height: 520 }}
        >
          {filteredData.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#8b9cc8]">
              <div className="text-center space-y-2">
                <svg className="w-12 h-12 mx-auto opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-sm">No graph data -- define ontology, save, then run the pipeline</p>
              </div>
            </div>
          ) : ForceGraph ? (
            <ForceGraph
              ref={fgRef}
              graphData={filteredData}
              width={containerRef.current?.clientWidth || 800}
              height={520}
              nodeLabel={(n) => `${n.type}: ${n.name}`}
              nodeColor={(n) => n.color || "#6b7280"}
              nodeRelSize={6}
              linkLabel={(l) => l.type}
              linkColor={() => "rgba(139,156,200,0.35)"}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              backgroundColor="#1e2340"
              nodeCanvasObject={(node, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 12 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                ctx.fillStyle = node.color || "#6b7280";
                ctx.beginPath();
                ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(label, node.x, node.y + 7);
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[#8b9cc8]">
              <p className="text-sm">Loading graph renderer...</p>
            </div>
          )}
        </div>

        {/* Entity Table */}
        {graphData.nodes.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">
              Extracted Entities
              <span className="text-[#8b9cc8] font-normal ml-1">({graphData.nodes.length})</span>
            </h2>
            <div className="bg-[#1e2340] border border-[#2a3060] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a3060] text-[#8b9cc8] text-xs uppercase tracking-wider sticky top-0 bg-[#1e2340]">
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.nodes.map((n, i) => (
                    <tr key={i} className="border-b border-[#2a3060]/50 last:border-0">
                      <td className="px-4 py-2">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            color: ENTITY_COLORS[n.type] || "#6b7280",
                            background: `${ENTITY_COLORS[n.type] || "#6b7280"}18`,
                          }}
                        >
                          {n.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-white">{n.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
