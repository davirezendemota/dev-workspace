import { createHash } from 'node:crypto';

import { ApiError } from './api-error';
import { aiConfig } from './workspace-config';

const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

type EmbeddingProviderConfig = {
  url: string;
  model: string;
};

function embeddingProviderConfig(): EmbeddingProviderConfig | null {
  const provider = process.env.AI_EMBEDDING_PROVIDER?.trim() || 'openai';

  if (provider !== 'openai') {
    return null;
  }

  return {
    url: 'https://api.openai.com/v1/embeddings',
    model: process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
  };
}

export function isEmbeddingConfigured(): boolean {
  if (!embeddingProviderConfig()) return false;

  const embeddingToken = process.env.AI_EMBEDDING_API_TOKEN?.trim();
  if (embeddingToken) return true;

  const { provider, apiToken } = aiConfig();
  return provider === 'openai' && Boolean(apiToken);
}

export function getEmbeddingSettings(): {
  provider: string;
  model: string;
  has_token: boolean;
} {
  const config = embeddingProviderConfig();
  const embeddingToken = process.env.AI_EMBEDDING_API_TOKEN?.trim();
  const { provider, apiToken } = aiConfig();

  return {
    provider: process.env.AI_EMBEDDING_PROVIDER?.trim() || 'openai',
    model: config?.model ?? DEFAULT_EMBEDDING_MODEL,
    has_token: Boolean(embeddingToken || (provider === 'openai' && apiToken)),
  };
}

export function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export async function createEmbedding(text: string): Promise<number[]> {
  const config = embeddingProviderConfig();
  if (!config) {
    throw new ApiError(
      400,
      'Embeddings exigem AI_EMBEDDING_PROVIDER=openai (ou chat com openai) e token compatível.',
    );
  }

  const { apiToken } = aiConfig();
  const token = process.env.AI_EMBEDDING_API_TOKEN?.trim() || apiToken;
  if (!token) {
    throw new ApiError(400, 'Configure o API token em Settings para gerar embeddings.');
  }

  const input = text.trim();
  if (!input) {
    throw new ApiError(400, 'Texto vazio para embedding.');
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: config.model,
      input,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    data?: Array<{ embedding?: number[] }>;
    error?: { message?: string };
    message?: string;
  };

  if (!response.ok) {
    const message =
      body.error?.message ||
      body.message ||
      `Falha ao gerar embedding (HTTP ${response.status}).`;
    throw new ApiError(response.status >= 400 && response.status < 600 ? response.status : 502, message);
  }

  const embedding = body.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new ApiError(502, 'A API de embedding retornou um vetor vazio.');
  }

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new ApiError(
      502,
      `Embedding com ${embedding.length} dimensões; esperado ${EMBEDDING_DIMENSIONS}. Ajuste o modelo ou o schema do Postgres.`,
    );
  }

  return embedding;
}

export function formatVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
