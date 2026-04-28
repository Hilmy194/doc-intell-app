import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { factCheckClaim } from '../lib/apiClient';
import ThemeToggle from '../components/ThemeToggle';

const VERDICT_STYLES = {
  supported: 'bg-green-900/30 text-green-300 border-green-500/40',
  contradicted: 'bg-red-900/30 text-red-300 border-red-500/40',
  mixed: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/40',
  insufficient_evidence: 'bg-slate-700/40 text-slate-200 border-slate-500/40',
};

function ConfidenceBar({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)));
  return (
    <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: "var(--border-color)" }}>
      <div className="h-full bg-[#4f7cff]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function FactCheckerPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [claim, setClaim] = useState('');
  const [topK, setTopK] = useState(8);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const verdictClass = useMemo(() => {
    if (!result?.verdict) return VERDICT_STYLES.insufficient_evidence;
    return VERDICT_STYLES[result.verdict] || VERDICT_STYLES.insufficient_evidence;
  }, [result]);

  const onRun = async () => {
    setError(null);
    setRunning(true);
    try {
      const res = await factCheckClaim(caseId, claim, { topK: Number(topK) || 8, minScore: 0.1 });
      setResult(res.data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="min-h-screen px-6 py-8 font-sans"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (caseId ? navigate(`/cases/${caseId}`) : navigate(-1))}
              className="shrink-0 p-1.5 rounded transition-colors"
              style={{ color: "var(--text-secondary)" }}
              title="Back"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">Fact Checker</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Grounded verification using indexed evidence from this case</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "var(--text-primary)" }}>
            {error}
          </div>
        )}

        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <label className="block text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Claim / Statement</label>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            rows={5}
            placeholder="Example: PT ABC signed the contract on 10 January 2025 and paid IDR 2 billion."
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
          />

          <div className="flex items-center gap-3">
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>Top-K Evidence</label>
            <input
              type="number"
              value={topK}
              min={3}
              max={20}
              onChange={(e) => setTopK(e.target.value)}
              className="w-24 rounded px-2 py-1 text-sm"
              style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
            <button
              onClick={onRun}
              disabled={running || !claim.trim()}
              className="ml-auto px-4 py-2 bg-[#4f7cff] hover:bg-[#3d68e8] disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              {running ? 'Checking...' : 'Run Fact Check'}
            </button>
          </div>
        </div>

        {result && (
          <div className="space-y-4">
            <div className={`border rounded-xl p-4 ${verdictClass}`}>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-80">Verdict</p>
                  <p className="text-lg font-semibold">{result.verdict}</p>
                </div>
                <div className="w-64">
                  <p className="text-xs mb-1">Confidence: {Math.round((result.confidence || 0) * 100)}%</p>
                  <ConfidenceBar value={result.confidence} />
                </div>
              </div>
              <p className="text-sm leading-relaxed">{result.summary_reasoning}</p>
              {result.limitations && (
                <p className="text-xs mt-2 opacity-90">Limitations: {result.limitations}</p>
              )}
            </div>

            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <h2 className="text-sm font-semibold mb-3">Evidence ({result.retrieved_context_count})</h2>
              <div className="space-y-3">
                {(result.evidence || []).map((e, idx) => (
                  <details key={`${e.chunkId}-${idx}`} className="border rounded-lg p-3" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-base)" }}>
                    <summary className="cursor-pointer text-sm" style={{ color: "var(--text-primary)" }}>
                      [{idx + 1}] {e.fileName || 'Unknown file'} • chunk {e.chunkIndex ?? '-'} • score {Number(e.score || 0).toFixed(3)}
                    </summary>
                    <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>chunkId: {e.chunkId}</p>
                    {e.page ? <p className="text-xs" style={{ color: "var(--text-secondary)" }}>page: {e.page}</p> : null}
                    <pre className="whitespace-pre-wrap mt-2 text-sm" style={{ color: "var(--text-primary)" }}>{e.content}</pre>
                  </details>
                ))}
                {(!result.evidence || result.evidence.length === 0) && (
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No strong evidence selected for this claim.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
