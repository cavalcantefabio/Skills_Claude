/** Tamanho máximo da pergunta preparada que viaja na URL (?q=). */
export const ASK_MAX_LENGTH = 500;

/** Link para o agente com uma pergunta preparada (não é enviada sozinha). */
export function askAgentHref(question: string) {
  return `/agente?q=${encodeURIComponent(question.slice(0, ASK_MAX_LENGTH))}`;
}
