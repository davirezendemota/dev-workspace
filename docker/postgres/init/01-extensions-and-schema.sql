-- pgvector + schema for AI project query (RAG)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS project_knowledge (
    id BIGSERIAL PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_ref TEXT NOT NULL DEFAULT '',
    chunk_index INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_knowledge_unique_chunk
        UNIQUE (project_id, source_kind, source_ref, chunk_index)
);

CREATE INDEX IF NOT EXISTS project_knowledge_project_id_idx
    ON project_knowledge (project_id);

CREATE INDEX IF NOT EXISTS project_knowledge_content_hash_idx
    ON project_knowledge (project_id, content_hash);

CREATE INDEX IF NOT EXISTS project_knowledge_embedding_idx
    ON project_knowledge
    USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_project_knowledge(
    query_embedding vector(1536),
    match_count INTEGER DEFAULT 8,
    filter_project_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    project_id TEXT,
    source_kind TEXT,
    source_ref TEXT,
    chunk_index INTEGER,
    content TEXT,
    metadata JSONB,
    similarity DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
    SELECT
        pk.id,
        pk.project_id,
        pk.source_kind,
        pk.source_ref,
        pk.chunk_index,
        pk.content,
        pk.metadata,
        1 - (pk.embedding <=> query_embedding) AS similarity
    FROM project_knowledge pk
    WHERE pk.embedding IS NOT NULL
      AND (
        filter_project_ids IS NULL
        OR cardinality(filter_project_ids) = 0
        OR pk.project_id = ANY(filter_project_ids)
      )
    ORDER BY pk.embedding <=> query_embedding
    LIMIT GREATEST(match_count, 1);
$$;
