import { ApiError } from './api-error';
import { listProjects } from './projects';
import { aiConfig, isAiConfigured } from './workspace-config';

export type ProjectAskResult = {
  answer: string;
  referenced_project_id: string | null;
};

type ProjectSummary = {
  id: string;
  name: string;
  client: string;
  repo: string;
  source_type: string;
  data: Record<string, unknown>;
};

export async function askAboutProjects(prompt: string): Promise<ProjectAskResult> {
  if (!isAiConfigured()) {
    throw new ApiError(
      400,
      'Configure o provedor, modelo e API token em Settings.',
    );
  }

  const userPrompt = prompt.trim();
  if (!userPrompt) {
    throw new ApiError(400, 'Informe uma pergunta.');
  }

  const { items } = listProjects(0, 100);
  const summaries = items.map((project) => summarizeProject(project));
  const validIds = summaries.map((project) => project.id);

  const systemPrompt = buildSystemPrompt(summaries);
  const raw = await completeChat(systemPrompt, userPrompt);

  return parseAiResponse(raw, validIds);
}

export async function completeChat(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (!isAiConfigured()) {
    throw new ApiError(
      400,
      'Configure o provedor, modelo e API token em Settings.',
    );
  }

  const { provider, model, apiToken } = aiConfig();
  return callProvider(provider, model, apiToken, systemPrompt, userPrompt);
}

function summarizeProject(project: {
  id: string;
  name: string;
  source_type: string;
  json_data: Record<string, unknown>;
}): ProjectSummary {
  const data = project.json_data ?? {};
  return {
    id: project.id,
    name: project.name,
    client: typeof data.client === 'string' ? data.client : '—',
    repo: typeof data.repo === 'string' ? data.repo : '—',
    source_type: project.source_type,
    data,
  };
}

function buildSystemPrompt(projects: ProjectSummary[]): string {
  return [
    'Você é um assistente que responde dúvidas sobre os projetos de um workspace.',
    'Use apenas as informações dos projetos fornecidos. Se não souber, diga que não encontrou a informação.',
    'Quando a pergunta for sobre um projeto específico, preencha referenced_project_id com o id exato desse projeto.',
    'Quando a pergunta for geral ou envolver vários projetos, use referenced_project_id como null.',
    'Responda em português do Brasil.',
    'Responda APENAS com JSON válido no formato:',
    '{"answer":"texto da resposta","referenced_project_id":"id-do-projeto ou null"}',
    '',
    'Projetos disponíveis:',
    JSON.stringify(projects, null, 2),
  ].join('\n');
}

async function callProvider(
  provider: string,
  model: string,
  apiToken: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  switch (provider) {
    case 'openai':
      return callOpenAiCompatible(
        'https://api.openai.com/v1/chat/completions',
        apiToken,
        model,
        systemPrompt,
        userPrompt,
      );
    case 'groq':
      return callOpenAiCompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        apiToken,
        model,
        systemPrompt,
        userPrompt,
      );
    case 'together':
      return callOpenAiCompatible(
        'https://api.together.xyz/v1/chat/completions',
        apiToken,
        model,
        systemPrompt,
        userPrompt,
      );
    case 'deepseek':
      return callOpenAiCompatible(
        'https://api.deepseek.com/chat/completions',
        apiToken,
        model,
        systemPrompt,
        userPrompt,
      );
    case 'mistral':
      return callOpenAiCompatible(
        'https://api.mistral.ai/v1/chat/completions',
        apiToken,
        model,
        systemPrompt,
        userPrompt,
      );
    case 'xai':
      return callOpenAiCompatible(
        'https://api.x.ai/v1/chat/completions',
        apiToken,
        model,
        systemPrompt,
        userPrompt,
      );
    case 'anthropic':
      return callAnthropic(apiToken, model, systemPrompt, userPrompt);
    case 'google':
      return callGoogleGemini(apiToken, model, systemPrompt, userPrompt);
    case 'cohere':
      return callCohere(apiToken, model, systemPrompt, userPrompt);
  }

  throw new ApiError(
    400,
    `O provedor "${provider}" ainda não é suportado para consultas sobre projetos.`,
  );
}

async function callOpenAiCompatible(
  url: string,
  apiToken: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  const body = await readJsonBody(response);
  if (!response.ok) {
    throw providerError(body, response.status);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new ApiError(502, 'A IA retornou uma resposta vazia.');
  }

  return content.trim();
}

async function callAnthropic(
  apiToken: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiToken,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
    }),
  });

  const body = await readJsonBody(response);
  if (!response.ok) {
    throw providerError(body, response.status);
  }

  const text = body?.content?.find(
    (item: { type?: string; text?: string }) => item.type === 'text',
  )?.text;

  if (typeof text !== 'string' || !text.trim()) {
    throw new ApiError(502, 'A IA retornou uma resposta vazia.');
  }

  return text.trim();
}

async function callGoogleGemini(
  apiToken: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    },
  );

  const body = await readJsonBody(response);
  if (!response.ok) {
    throw providerError(body, response.status);
  }

  const text = body?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new ApiError(502, 'A IA retornou uma resposta vazia.');
  }

  return text;
}

async function callCohere(
  apiToken: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  const body = await readJsonBody(response);
  if (!response.ok) {
    throw providerError(body, response.status);
  }

  const text = body?.message?.content
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new ApiError(502, 'A IA retornou uma resposta vazia.');
  }

  return text;
}

async function readJsonBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const data = await response.json();
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function providerError(body: Record<string, unknown>, status: number): ApiError {
  const nested = body.error;
  const nestedMessage =
    nested &&
    typeof nested === 'object' &&
    !Array.isArray(nested) &&
    typeof (nested as { message?: unknown }).message === 'string'
      ? (nested as { message: string }).message
      : null;

  const message =
  typeof body.detail === 'string'
    ? body.detail
    : typeof body.message === 'string'
      ? body.message
      : nestedMessage ?? `Falha na API de IA (HTTP ${status}).`;

  return new ApiError(status >= 400 && status < 600 ? status : 502, message);
}

function parseAiResponse(text: string, validIds: string[]): ProjectAskResult {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonCandidate = (fenced?.[1] ?? trimmed).trim();

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      answer?: unknown;
      referenced_project_id?: unknown;
    };
    const answer = String(parsed.answer ?? '').trim();
    let projectId =
      parsed.referenced_project_id === null ||
      parsed.referenced_project_id === undefined
        ? null
        : String(parsed.referenced_project_id).trim() || null;

    if (projectId && !validIds.includes(projectId)) {
      projectId = null;
    }

    if (answer) {
      return { answer, referenced_project_id: projectId };
    }
  } catch {
    /* fallback below */
  }

  return { answer: trimmed, referenced_project_id: null };
}
