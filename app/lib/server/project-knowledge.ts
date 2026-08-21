import { normalizeCheckpoints } from '@/app/lib/checkpoints';
import { normalizeMilestones } from '@/app/lib/milestones';

import { isDatabaseConfigured, queryRows, withDbClient } from './db';
import {
  createEmbedding,
  formatVector,
  getEmbeddingSettings,
  hashContent,
  isEmbeddingConfigured,
} from './embeddings';
import {
  getProject,
  getProjectSpecChecklist,
  getProjectTasks,
  listProjects,
  type ProjectResponse,
  type ProjectSpecChecklistResponse,
  type ProjectTaskItem,
} from './projects';

export type KnowledgeChunkInput = {
  project_id: string;
  source_kind: string;
  source_ref: string;
  chunk_index: number;
  content: string;
  metadata?: Record<string, unknown>;
};

export type KnowledgeSearchResult = {
  id: number;
  project_id: string;
  source_kind: string;
  source_ref: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type ProjectKnowledgeProjectStatus = {
  id: string;
  name: string;
  expected_chunks: number;
  indexed_chunks: number;
  embedded_chunks: number;
  last_indexed_at: string | null;
  status: 'synced' | 'partial' | 'pending' | 'empty';
};

export type ProjectKnowledgeStatus = {
  enabled: boolean;
  database_configured: boolean;
  embedding_configured: boolean;
  embedding_provider: string;
  embedding_model: string;
  has_embedding_token: boolean;
  projects_total: number;
  projects_indexed: number;
  expected_chunks_total: number;
  indexed_chunks_total: number;
  embedded_chunks_total: number;
  progress_percent: number;
  last_indexed_at: string | null;
  projects: ProjectKnowledgeProjectStatus[];
};

export function isProjectKnowledgeEnabled(): boolean {
  return isDatabaseConfigured() && isEmbeddingConfigured();
}

export async function getProjectKnowledgeStatus(): Promise<ProjectKnowledgeStatus> {
  const embeddingSettings = getEmbeddingSettings();
  const { items } = listProjects(0, 500);

  const base: ProjectKnowledgeStatus = {
    enabled: isProjectKnowledgeEnabled(),
    database_configured: isDatabaseConfigured(),
    embedding_configured: isEmbeddingConfigured(),
    embedding_provider: embeddingSettings.provider,
    embedding_model: embeddingSettings.model,
    has_embedding_token: embeddingSettings.has_token,
    projects_total: items.length,
    projects_indexed: 0,
    expected_chunks_total: 0,
    indexed_chunks_total: 0,
    embedded_chunks_total: 0,
    progress_percent: 0,
    last_indexed_at: null,
    projects: [],
  };

  if (!isDatabaseConfigured()) {
    return base;
  }

  const indexedByProject = new Map<
    string,
    { indexed: number; embedded: number; last_indexed_at: string | null }
  >();

  try {
    const rows = await queryRows<{
      project_id: string;
      indexed_chunks: number;
      embedded_chunks: number;
      last_indexed_at: string | null;
    }>(
      `SELECT
        project_id,
        COUNT(*)::int AS indexed_chunks,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded_chunks,
        MAX(updated_at)::text AS last_indexed_at
      FROM project_knowledge
      GROUP BY project_id`,
    );

    for (const row of rows) {
      indexedByProject.set(row.project_id, {
        indexed: row.indexed_chunks,
        embedded: row.embedded_chunks,
        last_indexed_at: row.last_indexed_at,
      });
    }
  } catch (error) {
    console.error('Falha ao ler status do banco vetorial:', error);
    return base;
  }

  const projects: ProjectKnowledgeProjectStatus[] = [];

  for (const project of items) {
    const expectedChunks = await countExpectedChunks(project.id);
    const indexed = indexedByProject.get(project.id);
    const indexedChunks = indexed?.indexed ?? 0;
    const embeddedChunks = indexed?.embedded ?? 0;

    let status: ProjectKnowledgeProjectStatus['status'] = 'pending';
    if (expectedChunks === 0) {
      status = 'empty';
    } else if (embeddedChunks >= expectedChunks) {
      status = 'synced';
    } else if (embeddedChunks > 0 || indexedChunks > 0) {
      status = 'partial';
    }

    projects.push({
      id: project.id,
      name: project.name,
      expected_chunks: expectedChunks,
      indexed_chunks: indexedChunks,
      embedded_chunks: embeddedChunks,
      last_indexed_at: indexed?.last_indexed_at ?? null,
      status,
    });
  }

  const expectedChunksTotal = projects.reduce(
    (sum, project) => sum + project.expected_chunks,
    0,
  );
  const indexedChunksTotal = projects.reduce(
    (sum, project) => sum + project.indexed_chunks,
    0,
  );
  const embeddedChunksTotal = projects.reduce(
    (sum, project) => sum + project.embedded_chunks,
    0,
  );
  const projectsIndexed = projects.filter(
    (project) => project.status === 'synced',
  ).length;

  const progressDenominator = expectedChunksTotal || items.length;
  const progressNumerator =
    expectedChunksTotal > 0 ? embeddedChunksTotal : projectsIndexed;
  const progressPercent =
    progressDenominator > 0
      ? Math.min(100, Math.round((progressNumerator / progressDenominator) * 100))
      : 100;

  const lastIndexedAt = projects.reduce<string | null>((latest, project) => {
    if (!project.last_indexed_at) return latest;
    if (!latest || project.last_indexed_at > latest) {
      return project.last_indexed_at;
    }
    return latest;
  }, null);

  return {
    ...base,
    projects_indexed: projectsIndexed,
    expected_chunks_total: expectedChunksTotal,
    indexed_chunks_total: indexedChunksTotal,
    embedded_chunks_total: embeddedChunksTotal,
    progress_percent: progressPercent,
    last_indexed_at: lastIndexedAt,
    projects,
  };
}

async function countExpectedChunks(projectId: string): Promise<number> {
  const project = getProject(projectId);
  if (!project) return 0;

  try {
    const checklist = await getProjectSpecChecklist(projectId);
    const tasks = await getProjectTasks(projectId);
    return buildProjectKnowledgeChunks(project, checklist, tasks.items).length;
  } catch {
    return 0;
  }
}

export async function syncProjectKnowledge(projectId: string): Promise<void> {
  if (!isProjectKnowledgeEnabled()) return;

  const project = getProject(projectId);
  if (!project) return;

  const checklist = await getProjectSpecChecklist(projectId);
  const tasks = await getProjectTasks(projectId);
  const chunks = buildProjectKnowledgeChunks(project, checklist, tasks.items);

  await upsertProjectKnowledge(projectId, chunks);
}

export async function syncProjectsKnowledge(
  projectIds?: string[] | null,
): Promise<void> {
  if (!isProjectKnowledgeEnabled()) return;

  const { items } = listProjects(0, 500);
  const scoped =
    projectIds && projectIds.length > 0
      ? items.filter((project) => projectIds.includes(project.id))
      : items;

  for (const project of scoped) {
    try {
      await syncProjectKnowledge(project.id);
    } catch (error) {
      console.error(`Falha ao indexar conhecimento do projeto ${project.id}:`, error);
    }
  }
}

export async function searchProjectKnowledge(
  query: string,
  projectIds?: string[] | null,
  matchCount = 10,
): Promise<KnowledgeSearchResult[]> {
  if (!isProjectKnowledgeEnabled()) return [];

  const embedding = await createEmbedding(query);
  const vector = formatVector(embedding);
  const filter =
    projectIds && projectIds.length > 0 ? projectIds : null;

  const rows = await queryRows<{
    id: string;
    project_id: string;
    source_kind: string;
    source_ref: string;
    chunk_index: number;
    content: string;
    metadata: Record<string, unknown> | null;
    similarity: number;
  }>(
    `SELECT
      id::text,
      project_id,
      source_kind,
      source_ref,
      chunk_index,
      content,
      metadata,
      similarity
    FROM match_project_knowledge($1::vector, $2, $3::text[])`,
    [vector, matchCount, filter],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    project_id: row.project_id,
    source_kind: row.source_kind,
    source_ref: row.source_ref,
    chunk_index: row.chunk_index,
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: Number(row.similarity),
  }));
}

function buildProjectKnowledgeChunks(
  project: ProjectResponse,
  checklist: ProjectSpecChecklistResponse | null,
  tasks: ProjectTaskItem[],
): KnowledgeChunkInput[] {
  const chunks: KnowledgeChunkInput[] = [];
  const data = project.json_data ?? {};

  const overviewLines = [
    `Projeto: ${project.name} (id: ${project.id})`,
    `Cliente: ${typeof data.client === 'string' ? data.client : '—'}`,
    `Repositório: ${typeof data.repo === 'string' ? data.repo : project.github_repo_url ?? '—'}`,
    `Origem: ${project.source_type}`,
    typeof data.ai === 'string' && data.ai.trim()
      ? `Resumo IA: ${data.ai.trim()}`
      : null,
    typeof data.topDate === 'string' ? `Data destaque: ${data.topDate}` : null,
    typeof data.openDemands === 'number'
      ? `Demandas abertas: ${data.openDemands}`
      : null,
  ].filter(Boolean);

  chunks.push({
    project_id: project.id,
    source_kind: 'overview',
    source_ref: 'card',
    chunk_index: 0,
    content: overviewLines.join('\n'),
    metadata: { project_name: project.name },
  });

  const checkpoints = normalizeCheckpoints(
    data.checkpoints,
    typeof data.topDate === 'string' ? data.topDate : undefined,
  );

  checkpoints.forEach((checkpoint, index) => {
    const lines = [
      `Checkpoint: ${checkpoint.title}`,
      checkpoint.summary ? `Resumo: ${checkpoint.summary}` : null,
      checkpoint.description ? `Descrição: ${checkpoint.description}` : null,
      checkpoint.date ? `Data: ${checkpoint.date}` : null,
      checkpoint.documents.length > 0
        ? `Documentos: ${checkpoint.documents.map((doc) => doc.filename).join(', ')}`
        : null,
    ].filter(Boolean);

    if (lines.length === 0) return;

    chunks.push({
      project_id: project.id,
      source_kind: 'checkpoint',
      source_ref: String(index),
      chunk_index: 0,
      content: lines.join('\n'),
      metadata: { project_name: project.name, checkpoint_title: checkpoint.title },
    });
  });

  const milestones = normalizeMilestones(data.milestones);
  milestones.forEach((milestone, index) => {
    chunks.push({
      project_id: project.id,
      source_kind: 'milestone',
      source_ref: milestone.id || String(index),
      chunk_index: 0,
      content: [
        `Milestone: ${milestone.title}`,
        milestone.description ? `Descrição: ${milestone.description}` : null,
        milestone.targetDate ? `Data alvo: ${milestone.targetDate}` : null,
        milestone.specIds.length
          ? `Specs vinculadas: ${milestone.specIds.join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
      metadata: { project_name: project.name, milestone_id: milestone.id },
    });
  });

  tasks.forEach((task, index) => {
    chunks.push({
      project_id: project.id,
      source_kind: 'task',
      source_ref: task.id || String(index),
      chunk_index: 0,
      content: `Task: ${task.label}\nConcluída: ${task.done ? 'sim' : 'não'}`,
      metadata: { project_name: project.name, task_id: task.id },
    });
  });

  if (checklist?.specs?.length) {
    for (const spec of checklist.specs) {
      const specHeader = [
        `Spec ${spec.specId}: ${spec.title}`,
        checklist.project_name ? `Projeto checklist: ${checklist.project_name}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      chunks.push({
        project_id: project.id,
        source_kind: 'spec',
        source_ref: spec.specId,
        chunk_index: 0,
        content: specHeader,
        metadata: {
          project_name: project.name,
          spec_id: spec.specId,
          spec_title: spec.title,
        },
      });

      spec.checklist.forEach((item, acIndex) => {
        chunks.push({
          project_id: project.id,
          source_kind: 'ac',
          source_ref: `${spec.specId}:${item.ac}`,
          chunk_index: acIndex,
          content: [
            `Projeto: ${project.name}`,
            `Spec ${spec.specId} — ${spec.title}`,
            `AC ${item.ac}: ${item.description}`,
            `Status: ${item.status}`,
          ].join('\n'),
          metadata: {
            project_name: project.name,
            spec_id: spec.specId,
            ac: item.ac,
            status: item.status,
          },
        });
      });
    }
  }

  return chunks.filter((chunk) => chunk.content.trim().length > 0);
}

async function upsertProjectKnowledge(
  projectId: string,
  chunks: KnowledgeChunkInput[],
): Promise<void> {
  const existingHashes = new Map<string, string>();

  await withDbClient(async (client) => {
    const existing = await client.query<{
      source_kind: string;
      source_ref: string;
      chunk_index: number;
      content_hash: string;
    }>(
      `SELECT source_kind, source_ref, chunk_index, content_hash
       FROM project_knowledge
       WHERE project_id = $1`,
      [projectId],
    );

    for (const row of existing.rows) {
      const key = chunkKey(row.source_kind, row.source_ref, row.chunk_index);
      existingHashes.set(key, row.content_hash);
    }

    const seenKeys = new Set<string>();

    for (const chunk of chunks) {
      const key = chunkKey(chunk.source_kind, chunk.source_ref, chunk.chunk_index);
      seenKeys.add(key);

      const contentHash = hashContent(chunk.content);
      const previousHash = existingHashes.get(key);
      const metadata = JSON.stringify(chunk.metadata ?? {});

      if (previousHash === contentHash) {
        continue;
      }

      const embedding = await createEmbedding(chunk.content);
      const vector = formatVector(embedding);

      await client.query(
        `INSERT INTO project_knowledge (
          project_id, source_kind, source_ref, chunk_index,
          content, content_hash, metadata, embedding, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::vector, now())
        ON CONFLICT (project_id, source_kind, source_ref, chunk_index)
        DO UPDATE SET
          content = EXCLUDED.content,
          content_hash = EXCLUDED.content_hash,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding,
          updated_at = now()`,
        [
          chunk.project_id,
          chunk.source_kind,
          chunk.source_ref,
          chunk.chunk_index,
          chunk.content,
          contentHash,
          metadata,
          vector,
        ],
      );
    }

    const keysToDelete = [...existingHashes.keys()].filter((key) => !seenKeys.has(key));
    if (keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        const [sourceKind, sourceRef, chunkIndex] = key.split('::');
        await client.query(
          `DELETE FROM project_knowledge
           WHERE project_id = $1
             AND source_kind = $2
             AND source_ref = $3
             AND chunk_index = $4`,
          [projectId, sourceKind, sourceRef, Number(chunkIndex)],
        );
      }
    }
  });
}

function chunkKey(sourceKind: string, sourceRef: string, chunkIndex: number): string {
  return `${sourceKind}::${sourceRef}::${chunkIndex}`;
}

export function buildKnowledgeContext(
  results: KnowledgeSearchResult[],
  projectCatalog: Array<{ id: string; name: string }>,
): string {
  const catalog = projectCatalog
    .map((project) => `- ${project.name} (id: ${project.id})`)
    .join('\n');

  const snippets = results.map((result) => {
    const header = `[${result.project_id} · ${result.source_kind}${result.source_ref ? ` · ${result.source_ref}` : ''}]`;
    return `${header}\n${result.content}`;
  });

  return [
    'Catálogo de projetos (ids válidos para referenced_project_id):',
    catalog,
    '',
    'Trechos relevantes recuperados por similaridade:',
    snippets.join('\n\n'),
  ].join('\n');
}
