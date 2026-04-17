const { OpenAI } = require('openai');

const EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBED_DIM = 1536;

function normalizeText(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function tokenize(text = '') {
  return normalizeText(text).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
}

function cosine(a, b) {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function hashEmbedding(text, dim = EMBED_DIM) {
  const vec = new Array(dim).fill(0);
  const toks = tokenize(text);
  for (const t of toks) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i += 1) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

async function embedText(text) {
  const input = normalizeText(text).slice(0, 8000);
  if (!input) return hashEmbedding('');

  if (!process.env.OPENAI_API_KEY) {
    return hashEmbedding(input);
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000 });
    const res = await client.embeddings.create({
      model: EMBED_MODEL,
      input,
    });
    const v = res.data?.[0]?.embedding;
    if (Array.isArray(v) && v.length > 0) return v;
    return hashEmbedding(input);
  } catch {
    return hashEmbedding(input);
  }
}

function keywordOverlapScore(query, text) {
  const q = new Set(tokenize(query));
  if (!q.size) return 0;
  const t = new Set(tokenize(text));
  let hit = 0;
  for (const tok of q) {
    if (t.has(tok)) hit += 1;
  }
  return hit / q.size;
}

async function rankKnowledge(query, knowledgeRows, topK = 8, minScore = 0) {
  const qEmbedding = await embedText(query);

  const scored = knowledgeRows.map((row) => {
    const emb = Array.isArray(row.embedding) && row.embedding.length > 0
      ? row.embedding
      : hashEmbedding(row.content || '');

    const semantic = cosine(qEmbedding, emb);
    const keyword = keywordOverlapScore(query, row.content || '');
    const score = semantic * 0.8 + keyword * 0.2;

    return {
      ...row,
      score,
      semanticScore: semantic,
      keywordScore: keyword,
    };
  });

  const dedup = new Map();
  for (const item of scored.sort((a, b) => b.score - a.score)) {
    const key = String(item.chunkId);
    if (!dedup.has(key)) dedup.set(key, item);
  }

  return Array.from(dedup.values())
    .filter((r) => r.score >= minScore)
    .slice(0, topK);
}

module.exports = {
  embedText,
  rankKnowledge,
};
