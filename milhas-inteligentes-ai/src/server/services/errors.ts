/** Erro de regra de negócio: a mensagem é segura para mostrar ao usuário. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionState = { ok: boolean; message?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

/** Converte qualquer erro em estado de formulário sem vazar detalhes internos. */
export function toActionError(e: unknown): NonNullable<ActionState> {
  if (e instanceof DomainError) return { ok: false, message: e.message };
  console.error(e);
  return { ok: false, message: "Não foi possível concluir a operação. Tente novamente." };
}
