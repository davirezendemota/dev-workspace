import {
  getAgent,
  listAgents,
  type AgentResponse,
} from './agents';

/** Prompt da aba Prompts do DW — leitura via `/api/prompts` (edição só em `/api/agents`). */
export type PromptResponse = AgentResponse;

export function listPrompts(skip = 0, limit = 100, query?: string) {
  const result = listAgents(skip, limit);
  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    return result;
  }

  const q = trimmedQuery.toLowerCase();
  const items = result.items.filter(
    (prompt) =>
      prompt.name.toLowerCase().includes(q) ||
      prompt.id.toLowerCase().includes(q) ||
      prompt.content.toLowerCase().includes(q),
  );

  return {
    items,
    total: items.length,
    skip,
    limit,
  };
}

export function getPrompt(id: string): PromptResponse | null {
  return getAgent(id);
}
