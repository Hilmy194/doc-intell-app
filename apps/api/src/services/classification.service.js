const { OpenAI } = require('openai');

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const RULES = [
  { type: 'invoice', patterns: [/invoice/i, /amount due/i, /bill to/i] },
  { type: 'contract', patterns: [/agreement/i, /party/i, /effective date/i, /clause/i] },
  { type: 'financial_report', patterns: [/balance sheet/i, /income statement/i, /cash flow/i] },
  { type: 'id_document', patterns: [/nik/i, /passport/i, /identity/i] },
  { type: 'watchlist', patterns: [/dttot/i, /watchlist/i, /alias/i, /kewarganegaraan/i] },
];

function classifyRuleBased({ filename, mime, textSample }) {
  const corpus = [filename || '', mime || '', textSample || ''].join('\n');

  for (const rule of RULES) {
    const matched = rule.patterns.filter((p) => p.test(corpus)).length;
    if (matched > 0) {
      return {
        docType: rule.type,
        confidence: Math.min(0.55 + matched * 0.12, 0.92),
        reasoning: `Rule-based match (${matched} keyword signals)`,
        classifier: 'rule',
      };
    }
  }

  return {
    docType: 'generic_document',
    confidence: 0.51,
    reasoning: 'No strong rule pattern matched',
    classifier: 'rule',
  };
}

async function classifyWithLLM({ filename, mime, textSample }) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000 });
  const prompt = `Classify this document into one concise type label (snake_case).\nReturn strict JSON:\n{"docType":"...","confidence":0.0-1.0,"reasoning":"..."}\n\nfilename: ${filename || ''}\nmime: ${mime || ''}\ntext_sample:\n${(textSample || '').slice(0, 2000)}`;

  const res = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a document classifier. Keep reasoning short and evidence-based only from provided sample.',
      },
      { role: 'user', content: prompt },
    ],
  });

  try {
    const parsed = JSON.parse(res.choices[0].message.content || '{}');
    const conf = Number(parsed.confidence);
    return {
      docType: String(parsed.docType || 'generic_document').trim().toLowerCase().replace(/\s+/g, '_'),
      confidence: Number.isFinite(conf) ? Math.max(0, Math.min(conf, 1)) : 0.7,
      reasoning: String(parsed.reasoning || 'LLM classification result').slice(0, 500),
      classifier: 'openai',
    };
  } catch {
    return null;
  }
}

async function classifyDocument(input) {
  const ruleResult = classifyRuleBased(input);
  try {
    const llmResult = await classifyWithLLM(input);
    return llmResult || ruleResult;
  } catch {
    return ruleResult;
  }
}

module.exports = {
  classifyDocument,
};
