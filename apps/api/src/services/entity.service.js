// Entity extraction — OpenAI-first, heuristic fallback.
// Auto-detects: if OPENAI_API_KEY is set, uses LLM. Otherwise regex fallback.

let _openaiClient = null;

function getOpenAIClient() {
  if (_openaiClient) return _openaiClient;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const { OpenAI } = require('openai');
  _openaiClient = new OpenAI({ apiKey: key, timeout: 30000 });
  return _openaiClient;
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function getExtractorMode() {
  if (process.env.ENTITY_EXTRACTOR) return process.env.ENTITY_EXTRACTOR;
  return process.env.OPENAI_API_KEY ? 'openai' : 'heuristic';
}

// ── OpenAI extraction (entities + relations in one call) ─────────────────────

const BASE_PROMPT = `You are an expert document analyst and Named Entity Recognition system.

TASK: Analyze the text and extract meaningful entities and their relationships.

STEP 1 — Understand the document context. What is this text about?
STEP 2 — Extract ONLY entities that are meaningful and relevant to the document's purpose.
STEP 3 — Identify relationships between extracted entities.

Return ONLY valid JSON:
{
  "context": "Brief one-line description of what this text is about",
  "entities": [
    { "entityType": "PERSON", "entityValue": "Budi Santoso", "confidence": 0.95, "role": "signer" }
  ],
  "relations": [
    { "source": "Budi Santoso", "target": "PT Maju Jaya", "relationType": "works_at", "confidence": 0.9 }
  ]
}

ENTITY TYPES (use exactly these):
- PERSON       — Full names of people
- ORGANIZATION — Companies, institutions, government bodies
- LOCATION     — Cities, countries, addresses
- DATE         — Meaningful dates (contract dates, deadlines, birthdates)
- MONEY        — Financial amounts in context
- EMAIL        — Email addresses
- PHONE        — Phone numbers
- DOCUMENT_ID  — Important document/reference numbers (contract ID, invoice number)

CRITICAL RULES:
- DO NOT extract raw data dumps — return fewer but meaningful entities
- A 16-digit number is only a DOCUMENT_ID if clearly labeled as NIK/NPWP/reference
- PREFER quality over quantity — 5 meaningful entities > 50 noise entities
- entityValue must be the cleanest/canonical form
- Return empty arrays if text has no meaningful extractable content

MANDATORY FOR RELATIONS:
- "source" and "target" MUST be EXACTLY IDENTICAL (character-for-character) to an "entityValue" in your entities list
- Do NOT abbreviate, rephrase, or reformat entity names in relations
- ALWAYS create relations when entities co-occur in the same text`;

function buildSystemPrompt(ontologyRules = []) {
  if (!ontologyRules || ontologyRules.length === 0) {
    return BASE_PROMPT + '\n- Use your best judgment for relation types based on document context';
  }

  const rulesText = ontologyRules
    .map((r) => `  - ${r.from} --[${r.relation}]--> ${r.to}`)
    .join('\n');

  // Detect if ontology has watchlist/structured-record rules
  const relationNames = ontologyRules.map((r) => r.relation);
  const hasAliasRule = relationNames.some((r) => r.includes('alias'));
  const hasNationalityRule = relationNames.some((r) => r.includes('national') || r.includes('kewarganegaraan'));
  const hasAddressRule = relationNames.some((r) => r.includes('address') || r.includes('alamat'));

  let structuredHint = '';
  if (hasAliasRule || hasNationalityRule || hasAddressRule) {
    structuredHint = `\n\nSTRUCTURED RECORD PARSING INSTRUCTIONS:
This document may contain structured entries (numbered lists, watchlists, registries).
When you see a record like:
  "Nama : X; Nama alias : Y alias Z; Tempat tanggal lahir : A, B; Kewarganegaraan : C; Alamat : D"
You MUST:
1. Create ONE main entity (PERSON or ORGANIZATION) for the primary name.
2. Create SEPARATE entities for EACH alias (they are PERSON or ORGANIZATION depending on context).
3. Create SEPARATE entities for birth place (LOCATION), birth date (DATE), nationality (LOCATION as country), address (LOCATION).
4. Create relations for EVERY field: alias_of, born_in, birth_date, nationality, address_in, etc.
5. "alias" entries like "A alias B alias C" = 3 separate PERSON entities, each with alias_of relation to the main name.
6. Nationality = a LOCATION entity (the country name), connected via nationality relation.
7. If value is "-" or empty, skip that field completely.
8. Each numbered entry (1. Nama:, 2. Nama:, etc.) is a SEPARATE individual/entity.
9. Section headers like "I. ENTITAS" indicate organizations; "II. INDIVIDU" indicate persons.
10. Document IDs in parentheses like (E.D.Q.001) or (I.D.Q.001) should be extracted as DOCUMENT_ID.
`;
  }

  return BASE_PROMPT + `\n\nUSER-DEFINED ONTOLOGY FOR THIS CASE (follow strictly):\n${rulesText}${structuredHint}\n\nFor the "relations" array:\n- ONLY use relation types defined in the ontology above\n- For EVERY entity extracted, actively look for ALL possible relations from the ontology\n- A single person may have 5+ relations (alias, birthplace, birthdate, nationality, address, organization)\n- Do NOT invent relation types not listed in the ontology\n- Create as MANY relations as possible — every field-value pair is a relation`;
}

async function extractWithOpenAI(text, ontologyRules = []) {
  const client = getOpenAIClient();
  if (!client) throw new Error('OPENAI_API_KEY not configured');

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0,
    max_tokens: 4000,
    messages: [
      { role: 'system', content: buildSystemPrompt(ontologyRules) },
      { role: 'user', content: text.slice(0, 6000) },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content);
    const entities = (parsed.entities || []).map((e) => ({
      entityType: e.entityType,
      entityValue: e.entityValue,
      confidence: e.confidence ?? 0.85,
      role: e.role || null,
    }));
    const relations = (parsed.relations || []).map((r) => ({
      sourceName: r.source,
      targetName: r.target,
      relationType: r.relationType,
      confidence: r.confidence ?? 0.8,
    }));
    return { entities, relations, context: parsed.context || '' };
  } catch {
    return { entities: [], relations: [], context: '' };
  }
}

// ── Main exports ─────────────────────────────────────────────────────────────

async function extractEntitiesFromText(text) {
  const mode = getExtractorMode();

  if (mode === 'openai' || mode === 'hybrid') {
    try {
      const result = await extractWithOpenAI(text);
      return result.entities;
    } catch (err) {
      console.warn('OpenAI failed, falling back to heuristic:', err.message);
      return extractEntitiesHeuristic(text);
    }
  }

  return extractEntitiesHeuristic(text);
}

// Full extraction: returns { entities, relations, context }
async function extractFullFromText(text, ontologyRules = []) {
  const mode = getExtractorMode();

  if (mode === 'openai' || mode === 'hybrid') {
    try {
      return await extractWithOpenAI(text, ontologyRules);
    } catch (err) {
      console.warn('OpenAI failed, falling back to heuristic:', err.message);
      return { entities: extractEntitiesHeuristic(text), relations: [], context: '' };
    }
  }

  return { entities: extractEntitiesHeuristic(text), relations: [], context: '' };
}

// ── Name normalization for fuzzy matching ────────────────────────────────────

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

function findEntityId(name, byExact, byNorm, allEntities) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  // 1. Exact lowercase match
  if (byExact.has(lower)) return byExact.get(lower);
  // 2. Normalized match (no dots, collapsed spaces)
  const norm = normalize(name);
  if (byNorm.has(norm)) return byNorm.get(norm);
  // 3. Substring/contains match
  for (const e of allEntities) {
    const eNorm = normalize(e.entityValue);
    if (eNorm.includes(norm) || norm.includes(eNorm)) {
      return e.id;
    }
  }
  return null;
}

// Resolve named relations (from LLM "sourceName"/"targetName") to saved entity IDs
function resolveNamedRelations(namedRelations, savedEntities, caseId) {
  if (!namedRelations.length || !savedEntities.length) return [];

  const byExact = new Map();
  const byNorm = new Map();
  for (const e of savedEntities) {
    byExact.set(e.entityValue.toLowerCase().trim(), e.id);
    byNorm.set(normalize(e.entityValue), e.id);
  }

  const resolved = [];
  let matched = 0;
  let missed = 0;
  for (const r of namedRelations) {
    const srcId = findEntityId(r.sourceName, byExact, byNorm, savedEntities);
    const tgtId = findEntityId(r.targetName, byExact, byNorm, savedEntities);
    if (srcId && tgtId && srcId !== tgtId) {
      resolved.push({
        caseId,
        sourceEntity: srcId,
        targetEntity: tgtId,
        relationType: r.relationType || 'related_to',
        confidence: r.confidence ?? 0.8,
      });
      matched++;
    } else {
      missed++;
      if (missed <= 5) {
        console.warn(`[relation-resolve] MISS: "${r.sourceName}" → "${r.targetName}" (src=${!!srcId}, tgt=${!!tgtId})`);
      }
    }
  }
  console.log(`[relation-resolve] ${matched} matched, ${missed} missed out of ${namedRelations.length} total`);
  return resolved;
}

// ── Heuristic fallback ───────────────────────────────────────────────────────

const PATTERNS = {
  DATE: [
    /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g,
    /\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b/g,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{2,4}\b/gi,
  ],
  MONEY: [
    /(?:USD|EUR|GBP|IDR|Rp|RM|\$|€|£)\s?[\d.,]+(?:\s?(?:juta|ribu|million|billion))?/gi,
  ],
  EMAIL: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  ],
  ORGANIZATION: [
    /\bPT\.?\s+[A-Z][A-Za-z\s&.]+(?:Tbk\.?)?/g,
    /\bCV\.?\s+[A-Z][A-Za-z\s&.]+/g,
  ],
  PERSON: [
    /\b(?:Mr|Mrs|Ms|Dr|Prof|Ir|Drs)\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g,
  ],
};

function extractEntitiesHeuristic(text) {
  const found = [];
  const seen = new Set();
  for (const [type, regexes] of Object.entries(PATTERNS)) {
    for (const regex of regexes) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const value = match[0].trim();
        const key = `${type}::${value.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ entityType: type, entityValue: value, confidence: 0.7 });
      }
    }
  }
  return found;
}

// Default fallback rules when no user ontology is defined
const RELATION_RULES = [
  { pair: ['PERSON', 'ORGANIZATION'], relation: 'affiliated_with' },
  { pair: ['PERSON', 'LOCATION'], relation: 'located_in' },
  { pair: ['PERSON', 'DATE'], relation: 'associated_date' },
  { pair: ['ORGANIZATION', 'MONEY'], relation: 'financial_relation' },
  { pair: ['PERSON', 'MONEY'], relation: 'financial_relation' },
  { pair: ['PERSON', 'EMAIL'], relation: 'has_contact' },
  { pair: ['PERSON', 'PHONE'], relation: 'has_contact' },
  { pair: ['ORGANIZATION', 'LOCATION'], relation: 'located_in' },
  { pair: ['ORGANIZATION', 'DATE'], relation: 'associated_date' },
  { pair: ['PERSON', 'DOCUMENT_ID'], relation: 'identified_by' },
];

// Co-occurrence fallback — uses user ontology rules if defined, else hardcoded defaults
function buildRelationsFromChunkEntities(chunkEntities, ontologyRules = []) {
  const rules = ontologyRules.length > 0
    ? ontologyRules.map((r) => ({ pair: [r.from, r.to], relation: r.relation }))
    : RELATION_RULES;

  const relations = [];
  for (const rule of rules) {
    const [typeA, typeB] = rule.pair;
    // Skip same-type rules in co-occurrence (e.g. PERSON->PERSON alias_of)
    // These create too many false links — rely on LLM named relations instead
    if (typeA === typeB) continue;
    const groupA = chunkEntities.filter((e) => e.entityType === typeA);
    const groupB = chunkEntities.filter((e) => e.entityType === typeB);
    for (const a of groupA) {
      for (const b of groupB) {
        if (a.id === b.id) continue;
        relations.push({
          sourceEntity: a.id,
          targetEntity: b.id,
          relationType: rule.relation,
          confidence: Math.min(a.confidence, b.confidence) * 0.7,
        });
      }
    }
  }
  return relations;
}

module.exports = {
  extractEntitiesFromText,
  extractFullFromText,
  extractEntitiesHeuristic,
  buildRelationsFromChunkEntities,
  resolveNamedRelations,
  getExtractorMode,
};
