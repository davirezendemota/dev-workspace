export const DEFAULT_AI_PROJECT_SUMMARY_PROMPT = `Você resume o estado atual de um projeto de software para um card de dashboard.
Use apenas os dados fornecidos. Não invente PRs, demandas ou datas.
Responda em português do Brasil, em tom direto e útil.
Máximo de 2 frases curtas (até ~200 caracteres no total).
Foque no que importa agora para este projeto: pendências, specs e critérios de aceite do bloco spec_checklist resolvido.
Não generalize para o repositório inteiro nem para outros projetos no mesmo spec-checklist.
Responda APENAS com o texto do resumo, sem JSON, markdown ou aspas extras.`;

export function resolveAiProjectSummaryPrompt(
  customPrompt: string | undefined | null,
): string {
  const trimmed = String(customPrompt ?? '').trim();
  return trimmed || DEFAULT_AI_PROJECT_SUMMARY_PROMPT;
}
