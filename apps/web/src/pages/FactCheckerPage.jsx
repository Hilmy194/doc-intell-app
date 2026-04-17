import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { factCheckClaim } from '../lib/apiClient';

const VERDICT_STYLES = {
  supported: 'bg-green-900/30 text-green-300 border-green-500/40',
  contradicted: 'bg-red-900/30 text-red-300 border-red-500/40',
  mixed: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/40',
  insufficient_evidence: 'bg-slate-700/40 text-slate-200 border-slate-500/40',
};

function ConfidenceBar({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)));
  return (
    <div className="w-full bg-[#2a3060] rounded-full h-2 overflow-hidden">
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
    <div className="min-h-screen bg-[#0d0f1e] text-white px-6 py-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Fact Checker</h1>
            <p className="text-sm text-[#8b9cc8] mt-1">Grounded verification using indexed evidence from this case</p>
          </div>
          <button
            onClick={() => navigate(`/cases/${caseId}/knowledge-graph`)}
            className="px-3 py-1.5 text-xs border border-[#2a3060] rounded-lg text-[#8b9cc8] hover:text-white hover:border-[#4f7cff]"
          >
            Back to Knowledge Graph
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="bg-[#1e2340] border border-[#2a3060] rounded-xl p-5 space-y-4">
          <label className="block text-xs text-[#8b9cc8] uppercase tracking-wider">Claim / Statement</label>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            rows={5}
            placeholder="Example: PT ABC signed the contract on 10 January 2025 and paid IDR 2 billion."
            className="w-full bg-[#0d0f1e] border border-[#2a3060] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#4f7cff]"
          />

          <div className="flex items-center gap-3">
            <label className="text-xs text-[#8b9cc8]">Top-K Evidence</label>
            <input
              type="number"
              value={topK}
              min={3}
              max={20}
              onChange={(e) => setTopK(e.target.value)}
              className="w-24 bg-[#0d0f1e] border border-[#2a3060] rounded px-2 py-1 text-sm"
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

            <div className="bg-[#1e2340] border border-[#2a3060] rounded-xl p-4">
              <h2 className="text-sm font-semibold mb-3">Evidence ({result.retrieved_context_count})</h2>
              <div className="space-y-3">
                {(result.evidence || []).map((e, idx) => (
                  <details key={`${e.chunkId}-${idx}`} className="border border-[#2a3060] rounded-lg p-3 bg-[#141627]">
                    <summary className="cursor-pointer text-sm text-[#c9d5f5]">
                      [{idx + 1}] {e.fileName || 'Unknown file'} • chunk {e.chunkIndex ?? '-'} • score {Number(e.score || 0).toFixed(3)}
                    </summary>
                    <p className="text-xs text-[#8b9cc8] mt-2">chunkId: {e.chunkId}</p>
                    {e.page ? <p className="text-xs text-[#8b9cc8]">page: {e.page}</p> : null}
                    <pre className="whitespace-pre-wrap mt-2 text-sm text-[#d7e2ff]">{e.content}</pre>
                  </details>
                ))}
                {(!result.evidence || result.evidence.length === 0) && (
                  <p className="text-sm text-[#8b9cc8]">No strong evidence selected for this claim.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
