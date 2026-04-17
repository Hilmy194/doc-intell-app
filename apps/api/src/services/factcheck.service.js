const { OpenAI } = require('openai');

const FACTCHECK_MODEL = process.env.FACTCHECK_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

function clamp01(x) {
  return Math.max(0, Math.min(1, Number(x) || 0));
}

function heuristicVerdict(claim, evidence) {
  if (!evidence.length) {
    return {
      verdict: 'insufficient_evidence',
      confidence: 0.2,
      summaryReasoning: 'No relevant indexed evidence found for the claim.',
      limitations: 'Knowledge index is empty or retrieval score is too low.',
      evidenceIndices: [],
    };
  }

  const best = evidence[0];
  if (best.score < 0.2) {
    return {
      verdict: 'insufficient_evidence',
      confidence: 0.28,
      summaryReasoning: 'Retrieved context has low relevance to the claim.',
      limitations: 'Low retrieval relevance.',
      evidenceIndices: [0],
    };
  }

  const text = `${claim} ${evidence.map((e) => e.content).join(' ')}`.toLowerCase();
  const hasConflictTerms = /(however|but|except|while|whereas|although)/.test(text);

  if (hasConflictTerms) {
    return {
      verdict: 'mixed',
      confidence: 0.55,
      summaryReasoning: 'Evidence appears to contain both supportive and conflicting signals.',
      limitations: 'Heuristic mode cannot robustly resolve nuanced contradictions.',
      evidenceIndices: [0, 1].filter((i) => evidence[i]),
    };
  }

  return {
    verdict: 'supported',
    confidence: clamp01(0.45 + best.score * 0.5),
    summaryReasoning: 'Top retrieved evidence is relevant and supports the claim context.',
    limitations: 'Heuristic mode may miss subtle contradictions.',
    evidenceIndices: [0, 1].filter((i) => evidence[i]),
  };
}

async function llmFactCheck(claim, evidence) {
  if (!process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45000 });

  const evidenceText = evidence
    .map((e, i) => `[#${i}] file=${e.fileName || 'unknown'} chunk=${e.chunkId} score=${e.score}\n${(e.content || '').slice(0, 1400)}`)
    .join('\n\n');

  const prompt = `You are a strict grounded fact-checking engine.\nUse ONLY the evidence snippets below.\nIf evidence is weak or missing, return insufficient_evidence.\nDo not use external/world knowledge.\n\nReturn strict JSON:\n{\n  "verdict": "supported|contradicted|mixed|insufficient_evidence",\n  "confidence": 0.0-1.0,\n  "summary_reasoning": "max 120 words",\n  "limitations": "short note",\n  "evidence_indices": [0,1]\n}\n\nClaim:\n${claim}\n\nEvidence:\n${evidenceText}`;

  const res = await client.chat.completions.create({
    model: FACTCHECK_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Grounded fact-check only. Never invent sources. Never use outside knowledge.',
      },
      { role: 'user', content: prompt },
    ],
  });

  try {
    const parsed = JSON.parse(res.choices[0].message.content || '{}');
    const allowed = new Set(['supported', 'contradicted', 'mixed', 'insufficient_evidence']);
    const verdict = allowed.has(parsed.verdict) ? parsed.verdict : 'insufficient_evidence';
    const evidenceIndices = Array.isArray(parsed.evidence_indices)
      ? parsed.evidence_indices.filter((i) => Number.isInteger(i) && i >= 0 && i < evidence.length)
      : [];

    return {
      verdict,
      confidence: clamp01(parsed.confidence),
      summaryReasoning: String(parsed.summary_reasoning || '').slice(0, 1200) || 'No reasoning provided.',
      limitations: String(parsed.limitations || '').slice(0, 600),
      evidenceIndices,
    };
  } catch {
    return null;
  }
}

async function evaluateClaimGrounded({ claim, evidence }) {
  const llm = await llmFactCheck(claim, evidence).catch(() => null);
  if (llm) return llm;
  return heuristicVerdict(claim, evidence);
}

module.exports = {
  evaluateClaimGrounded,
};
