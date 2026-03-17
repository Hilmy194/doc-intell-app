-- ============================================================
-- Knowledge Graph Migration
-- Run this in Supabase SQL Editor AFTER supabase_migration_cases.sql
-- ============================================================

-- 1. file_chunks — persisted text chunks per file
CREATE TABLE IF NOT EXISTS file_chunks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id     UUID REFERENCES files(id) ON DELETE CASCADE,
  case_id     UUID REFERENCES cases(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  token_estimate INTEGER DEFAULT 0,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_case_id ON file_chunks(case_id);

-- 2. extracted_entities — entities found in chunks
CREATE TABLE IF NOT EXISTS extracted_entities (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id      UUID REFERENCES files(id) ON DELETE CASCADE,
  case_id      UUID REFERENCES cases(id) ON DELETE CASCADE,
  chunk_id     UUID REFERENCES file_chunks(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,
  entity_value TEXT NOT NULL,
  confidence   REAL DEFAULT 1.0,
  source       TEXT DEFAULT 'heuristic',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_entities_case_id ON extracted_entities(case_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_file_id ON extracted_entities(file_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_type    ON extracted_entities(entity_type);

-- 3. entity_relations — relationships between entities
CREATE TABLE IF NOT EXISTS entity_relations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
  source_entity   UUID REFERENCES extracted_entities(id) ON DELETE CASCADE,
  target_entity   UUID REFERENCES extracted_entities(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL,
  confidence      REAL DEFAULT 1.0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_relations_case_id ON entity_relations(case_id);
