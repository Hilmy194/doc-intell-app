-- ============================================================
-- Production Migration: Document Intelligence Core
-- Safe additive migration for classification, knowledge retrieval,
-- and fact-check run logging.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 1) Document classification runs per file
CREATE TABLE IF NOT EXISTS document_classifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  reasoning TEXT,
  classifier TEXT NOT NULL DEFAULT 'rule',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_classifications_case_id ON document_classifications(case_id);
CREATE INDEX IF NOT EXISTS idx_document_classifications_file_id ON document_classifications(file_id);

-- 2) Reusable extraction schemas
CREATE TABLE IF NOT EXISTS extraction_schemas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_mode TEXT NOT NULL CHECK (target_mode IN ('PER_DOC', 'PER_PAGE', 'PER_TABLE_ROW')),
  schema_json JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, name)
);

CREATE INDEX IF NOT EXISTS idx_extraction_schemas_case_id ON extraction_schemas(case_id);

-- 3) Extraction runs + structured outputs
CREATE TABLE IF NOT EXISTS extraction_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  schema_id UUID REFERENCES extraction_schemas(id) ON DELETE SET NULL,
  parser_tool TEXT,
  target_mode TEXT NOT NULL CHECK (target_mode IN ('PER_DOC', 'PER_PAGE', 'PER_TABLE_ROW')),
  status TEXT NOT NULL DEFAULT 'completed',
  extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_case_id ON extraction_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_extraction_runs_file_id ON extraction_runs(file_id);

-- 4) Knowledge index table backed by embeddings
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES file_chunks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  source_file_name TEXT,
  page_number INTEGER,
  chunk_index INTEGER,
  parser_tool TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_case_id ON knowledge_chunks(case_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_file_id ON knowledge_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_chunk_idx ON knowledge_chunks(chunk_index);

-- Optional ANN index. Choose one based on your Supabase plan/perf needs.
-- CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_ivfflat
--   ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- 5) Fact-check runs for history and observability
CREATE TABLE IF NOT EXISTS fact_check_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('supported', 'contradicted', 'mixed', 'insufficient_evidence')),
  confidence REAL NOT NULL DEFAULT 0,
  summary_reasoning TEXT NOT NULL,
  limitations TEXT,
  retrieved_context_count INTEGER NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fact_check_runs_case_id ON fact_check_runs(case_id);
