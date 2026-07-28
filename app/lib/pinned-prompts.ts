export const PINNED_PROMPTS_STORAGE_KEY = 'pinned_prompt_ids';

export function readPinnedPromptIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PINNED_PROMPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function writePinnedPromptIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PINNED_PROMPTS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}
