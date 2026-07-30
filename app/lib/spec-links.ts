/**
 * Wikilinks estilo Obsidian para relações documentais entre specs.
 * Sintaxe: [[002]], [[002-settings]], [[002#AC5]], [[002|Settings]]
 */

export type SpecWikilink = {
  raw: string;
  specId: string;
  anchor?: string;
  label?: string;
  /** Índice 0-based do início do match no markdown */
  index: number;
  line?: number;
};

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Extrai specId (3 dígitos) e âncora opcional de um target wikilink.
 * Ex.: "002-settings" → { specId: "002" }
 *      "002#AC5" → { specId: "002", anchor: "AC5" }
 *      "002-settings#RF3" → { specId: "002", anchor: "RF3" }
 */
export function parseWikilinkTarget(
  target: string,
): { specId: string; anchor?: string } | null {
  const trimmed = target.trim();
  if (!trimmed) return null;

  const hashIdx = trimmed.indexOf('#');
  const pathPart = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  const anchorRaw = hashIdx >= 0 ? trimmed.slice(hashIdx + 1).trim() : '';

  const idMatch = pathPart.match(/^(\d{3})(?:[-_]|$)/);
  if (!idMatch) {
    // Apenas "002" sem slug
    const bare = pathPart.match(/^(\d{3})$/);
    if (!bare) return null;
    return {
      specId: bare[1],
      ...(anchorRaw ? { anchor: normalizeAnchor(anchorRaw) } : {}),
    };
  }

  return {
    specId: idMatch[1],
    ...(anchorRaw ? { anchor: normalizeAnchor(anchorRaw) } : {}),
  };
}

function normalizeAnchor(anchor: string): string {
  return anchor.replace(/^#+/, '').trim();
}

function lineAtIndex(markdown: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < markdown.length; i++) {
    if (markdown[i] === '\n') line++;
  }
  return line;
}

/**
 * Extrai todos os wikilinks válidos (com specId resolvível) do markdown.
 * Não valida se a spec existe no checklist — isso fica no builder do grafo.
 */
export function extractWikilinks(markdown: string): SpecWikilink[] {
  const results: SpecWikilink[] = [];
  const re = new RegExp(WIKILINK_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    const raw = match[0];
    const target = match[1] ?? '';
    const label = match[2]?.trim() || undefined;
    const parsed = parseWikilinkTarget(target);
    if (!parsed) continue;
    results.push({
      raw,
      specId: parsed.specId,
      ...(parsed.anchor ? { anchor: parsed.anchor } : {}),
      ...(label ? { label } : {}),
      index: match.index,
      line: lineAtIndex(markdown, match.index),
    });
  }
  return results;
}

/**
 * Substitui `[[...]]` por links markdown internos `spec:NNN` / `spec:NNN#anchor`
 * para o ReactMarkdown renderizar com componente custom de `a`.
 */
export function preprocessWikilinksForMarkdown(markdown: string): string {
  return markdown.replace(WIKILINK_RE, (full, target: string, label?: string) => {
    const parsed = parseWikilinkTarget(target);
    if (!parsed) return full;
    const href = parsed.anchor
      ? `spec:${parsed.specId}#${parsed.anchor}`
      : `spec:${parsed.specId}`;
    const text = (label?.trim() || target.trim() || parsed.specId).replace(
      /[\[\]]/g,
      '',
    );
    return `[${text}](${href})`;
  });
}

/**
 * Extrai o "módulo" do specFile para coloração no grafo.
 * Ex.: "features/003-projects.md" → "projects"
 *      "features/001-projects_ai-input.md" → "projects"
 */
export function moduleFromSpecFile(specFile: string): string {
  const base = specFile.split('/').pop() ?? specFile;
  const withoutExt = base.replace(/\.md$/i, '');
  const match = withoutExt.match(/^\d{3}-([a-z0-9]+)(?:_.*)?$/i);
  return match?.[1]?.toLowerCase() ?? 'other';
}

/**
 * Parseia href interno `spec:002` ou `spec:002#AC5`.
 */
export function parseSpecHref(
  href: string,
): { specId: string; anchor?: string } | null {
  if (!href.startsWith('spec:')) return null;
  const rest = href.slice('spec:'.length);
  const hashIdx = rest.indexOf('#');
  const specId = (hashIdx >= 0 ? rest.slice(0, hashIdx) : rest).trim();
  const anchor = hashIdx >= 0 ? rest.slice(hashIdx + 1).trim() : undefined;
  if (!/^\d{3}$/.test(specId)) return null;
  return {
    specId,
    ...(anchor ? { anchor } : {}),
  };
}
